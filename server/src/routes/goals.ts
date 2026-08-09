import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { agents } from "@paperclipai/db";
import { and, eq, ilike, inArray } from "drizzle-orm";
import { createGoalSchema, updateGoalSchema, createGoalMetricObservationSchema } from "@paperclipai/shared";
import { trackGoalCreated } from "@paperclipai/shared/telemetry";
import { validate } from "../middleware/validate.js";
import { goalService, issueService, logActivity, operatingCapabilityService } from "../services/index.js";
import { assertCompanyAccess, getAccessibleResource, getActorInfo } from "./authz.js";
import { getTelemetryClient } from "../telemetry.js";
import { queueIssueAssignmentWakeup, type IssueAssignmentWakeupDeps } from "../services/issue-assignment-wakeup.js";

export function goalRoutes(db: Db, opts: { heartbeat?: IssueAssignmentWakeupDeps | null } = {}) {
  const router = Router();
  const svc = goalService(db);

  router.get("/companies/:companyId/goals", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const result = await svc.list(companyId);
    res.json(result);
  });

  router.get("/goals/:id", async (req, res) => {
    const id = req.params.id as string;
    const goal = await getAccessibleResource(req, res, svc.getById(id), "Goal not found");
    if (!goal) return;
    res.json(goal);
  });

  router.get("/companies/:companyId/operating-loop/scorecard", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json(await svc.scorecard(companyId));
  });

  router.get("/companies/:companyId/operating-loop/capabilities", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json(await operatingCapabilityService(db).inventory(companyId));
  });

  router.post("/companies/:companyId/operating-loop/run", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const scorecard = await svc.scorecard(companyId);
    const capabilityInventory = await operatingCapabilityService(db).inventory(companyId);
    const ceo = await db.select().from(agents).where(and(
      eq(agents.companyId, companyId),
      ilike(agents.role, "ceo"),
      inArray(agents.status, ["active", "idle", "running"]),
    )).then((rows) => rows[0] ?? null);
    if (!ceo) return res.status(422).json({ error: "An enabled CEO agent is required" });
    if (req.actor.type === "agent" && req.actor.agentId !== ceo.id) {
      return res.status(403).json({ error: "Only the company's CEO agent can run the operating loop" });
    }
    const day = new Date().toISOString().slice(0, 10);
    const issue = await issueService(db).create(companyId, {
      title: `Daily operating review — ${day}`,
      description: `Evaluate the company scorecard and act on deviations.\n\nCompany state: ${scorecard.status}. Behind: ${scorecard.behindCount}.\nMCP + skill readiness: ${capabilityInventory.summary.ready}/${capabilityInventory.domains.length} domains ready. Incomplete: ${capabilityInventory.domains.filter((domain) => domain.status !== "ready").map((domain) => `${domain.label} (${domain.status})`).join(", ") || "none"}.\n\nFor every off-track objective: identify the highest-return next action, select an available MCP tool and compatible skill, decide continue/change/stop, create governed child tasks, require independent verification, and report expected return and cost to the CEO. If a required capability is incomplete, create setup work instead of pretending the action can execute.`,
      status: "todo", priority: scorecard.behindCount ? "high" : "medium", assigneeAgentId: ceo.id,
      goalId: scorecard.items.find((item) => item.status === "off_track")?.goal.id ?? null,
      originKind: "autonomous_operating_loop", originId: day,
      idempotencyKey: `operating-loop:${companyId}:${day}`,
    });
    const actor = getActorInfo(req);
    const executionQueued = opts.heartbeat ? Boolean(await queueIssueAssignmentWakeup({
      heartbeat: opts.heartbeat,
      issue,
      reason: "autonomous_operating_loop_assigned",
      mutation: "operating_loop.ran",
      contextSource: "autonomous_operating_loop",
      requestedByActorType: actor.actorType === "user" ? "user" : "agent",
      requestedByActorId: actor.actorId,
      taskKey: `operating-loop:${companyId}:${day}`,
    })) : false;
    await logActivity(db, { companyId, actorType: actor.actorType, actorId: actor.actorId, agentId: actor.agentId, action: "operating_loop.ran", entityType: "issue", entityId: issue.id, details: { scorecardStatus: scorecard.status, behindCount: scorecard.behindCount } });
    res.status(201).json({ scorecard, issue, executionQueued });
  });

  router.get("/goals/:id/observations", async (req, res) => {
    const goal = await getAccessibleResource(req, res, svc.getById(req.params.id as string), "Goal not found");
    if (!goal) return;
    res.json(await svc.listObservations(goal.companyId, goal.id));
  });

  router.post("/goals/:id/observations", validate(createGoalMetricObservationSchema), async (req, res) => {
    const goal = await getAccessibleResource(req, res, svc.getById(req.params.id as string), "Goal not found");
    if (!goal) return;
    if (!goal.metricKey || goal.targetValue == null) {
      return res.status(422).json({ error: "Goal must define metricKey and targetValue before recording observations" });
    }
    const actor = getActorInfo(req);
    const observation = await svc.addObservation(goal.companyId, goal.id, {
      ...req.body,
      source: actor.agentId ? "agent_report" : req.body.source,
      reportedByAgentId: actor.agentId,
      heartbeatRunId: actor.runId,
    });
    await logActivity(db, { companyId: goal.companyId, actorType: actor.actorType, actorId: actor.actorId, agentId: actor.agentId, action: "goal.metric_observed", entityType: "goal", entityId: goal.id, details: { value: observation.value, source: observation.source } });
    res.status(201).json(observation);
  });

  router.post("/companies/:companyId/goals", validate(createGoalSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const goal = await svc.create(companyId, req.body);
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "goal.created",
      entityType: "goal",
      entityId: goal.id,
      details: { title: goal.title },
    });
    const telemetryClient = getTelemetryClient();
    if (telemetryClient) {
      trackGoalCreated(telemetryClient, { goalLevel: goal.level });
    }
    res.status(201).json(goal);
  });

  router.patch("/goals/:id", validate(updateGoalSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await getAccessibleResource(req, res, svc.getById(id), "Goal not found");
    if (!existing) return;
    const mergedValidation = createGoalSchema.safeParse({ ...existing, ...req.body });
    if (!mergedValidation.success) {
      return res.status(422).json({ error: "Invalid goal update", details: mergedValidation.error.flatten() });
    }
    const goal = await svc.update(id, req.body);
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: goal.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "goal.updated",
      entityType: "goal",
      entityId: goal.id,
      details: req.body,
    });

    res.json(goal);
  });

  router.delete("/goals/:id", async (req, res) => {
    const id = req.params.id as string;
    const existing = await getAccessibleResource(req, res, svc.getById(id), "Goal not found");
    if (!existing) return;
    const goal = await svc.remove(id);
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: goal.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "goal.deleted",
      entityType: "goal",
      entityId: goal.id,
    });

    res.json(goal);
  });

  return router;
}
