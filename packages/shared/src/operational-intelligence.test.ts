import { describe, expect, it } from "vitest";
import {
  createOperationalOutcomeSchema,
  issueExecutionPolicySchema,
} from "./index.js";
import { agentRuntimeConfigSchema } from "./validators/agent.js";

const AGENT_ID = "00000000-0000-4000-8000-000000000001";

describe("operational intelligence contracts", () => {
  it("applies conservative defaults to an opted-in agent", () => {
    const parsed = agentRuntimeConfigSchema.parse({ operationalIntelligence: {} });
    expect(parsed.operationalIntelligence).toEqual({
      enabled: true,
      planningBeforeDelegation: true,
      reuseTaskSession: true,
      outcomeMemoryLimit: 5,
      routingPolicy: "conservative",
    });
  });

  it("accepts plan approval policy as part of the existing execution policy", () => {
    const parsed = issueExecutionPolicySchema.parse({
      stages: [],
      operationalIntelligence: { taskClass: "decision", requireApprovedPlan: true },
    });
    expect(parsed.operationalIntelligence?.taskClass).toBe("decision");
    expect(parsed.operationalIntelligence?.requireApprovedPlan).toBe(true);
  });

  it("validates structured outcomes and rejects invalid learning scores", () => {
    const outcome = {
      title: "Repository classification completed",
      summary: "Classified the repository without changing it.",
      metadata: {
        version: 1,
        kind: "operational_outcome",
        taskClass: "classification",
        status: "succeeded",
        agentId: AGENT_ID,
        modelLane: "cheap",
        skillKeys: ["repo-triage"],
        score: 5,
        lessons: ["Use the package graph before reading leaf modules."],
      },
    } as const;
    expect(createOperationalOutcomeSchema.safeParse(outcome).success).toBe(true);
    expect(createOperationalOutcomeSchema.safeParse({
      ...outcome,
      metadata: { ...outcome.metadata, score: 6 },
    }).success).toBe(false);
  });

  it("validates a compact executive autonomy mandate", () => {
    const parsed = agentRuntimeConfigSchema.parse({
      autonomy: {
        enabled: true,
        executiveMandate: "Run approved sales operations end to end and report outcomes.",
        allowSkillAcquisition: true,
        allowToolDiscovery: true,
        allowAgentHiring: false,
      },
    });
    expect(parsed.autonomy?.enabled).toBe(true);
    expect(parsed.autonomy?.allowAgentHiring).toBe(false);
    expect(agentRuntimeConfigSchema.safeParse({
      autonomy: {
        enabled: true,
        executiveMandate: "",
        allowSkillAcquisition: true,
        allowToolDiscovery: true,
        allowAgentHiring: false,
      },
    }).success).toBe(false);
  });
});
