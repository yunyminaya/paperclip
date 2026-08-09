import { and, desc, eq } from "drizzle-orm";
import {
  agentTaskSessions,
  agents,
  documents,
  issueDocuments,
  issueThreadInteractions,
  issues,
  issueWorkProducts,
  type Db,
} from "@paperclipai/db";
import {
  agentAutonomyConfigSchema,
  operationalOutcomeMetadataSchema,
  type AgentOperationalIntelligenceConfig,
  type IssueOperationalIntelligencePolicy,
  type OperationalIntelligenceContext,
  type OperationalTaskClass,
} from "@paperclipai/shared";

const DEFAULT_CONFIG: AgentOperationalIntelligenceConfig = {
  enabled: false,
  planningBeforeDelegation: true,
  reuseTaskSession: true,
  outcomeMemoryLimit: 5,
  routingPolicy: "conservative",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readConfig(runtimeConfig: unknown): AgentOperationalIntelligenceConfig {
  const raw = asRecord(asRecord(runtimeConfig).operationalIntelligence);
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_CONFIG.enabled,
    compactRolePrompt: typeof raw.compactRolePrompt === "string" ? raw.compactRolePrompt.trim().slice(0, 800) : null,
    planningBeforeDelegation: typeof raw.planningBeforeDelegation === "boolean"
      ? raw.planningBeforeDelegation
      : DEFAULT_CONFIG.planningBeforeDelegation,
    reuseTaskSession: typeof raw.reuseTaskSession === "boolean" ? raw.reuseTaskSession : DEFAULT_CONFIG.reuseTaskSession,
    outcomeMemoryLimit: typeof raw.outcomeMemoryLimit === "number"
      ? Math.max(0, Math.min(10, Math.trunc(raw.outcomeMemoryLimit)))
      : DEFAULT_CONFIG.outcomeMemoryLimit,
    routingPolicy: raw.routingPolicy === "manual" ? "manual" : "conservative",
  };
}

function readIssuePolicy(executionPolicy: unknown): IssueOperationalIntelligencePolicy {
  const raw = asRecord(asRecord(executionPolicy).operationalIntelligence);
  const taskClass = typeof raw.taskClass === "string" ? raw.taskClass : "implementation";
  const supported = new Set<OperationalTaskClass>([
    "classification", "control", "routine", "research", "implementation", "decision",
  ]);
  return {
    taskClass: supported.has(taskClass as OperationalTaskClass)
      ? taskClass as OperationalTaskClass
      : "implementation",
    requireApprovedPlan: raw.requireApprovedPlan === true,
  };
}

function planTargeted(payload: unknown, input: {
  issueId: string;
  documentId: string;
  revisionId: string | null;
}): boolean {
  const target = asRecord(asRecord(payload).target);
  return target.type === "issue_document" &&
    target.key === "plan" &&
    target.issueId === input.issueId &&
    target.documentId === input.documentId &&
    Boolean(input.revisionId) &&
    target.revisionId === input.revisionId;
}

function compactRole(input: {
  configured: string | null | undefined;
  title: string | null;
  role: string;
  capabilities: string | null;
}): string | null {
  if (input.configured?.trim()) return input.configured.trim().slice(0, 800);
  const identity = input.title?.trim() || input.role.trim();
  const capabilities = input.capabilities?.trim();
  const value = capabilities ? `${identity}: ${capabilities}` : identity;
  return value ? value.slice(0, 800) : null;
}

export function resolveOperationalRouting(input: {
  enabled: boolean;
  policy: "manual" | "conservative";
  taskClass: OperationalTaskClass;
  requestedLane: "primary" | "cheap";
  cheapAvailable: boolean;
}) {
  const economyEligible = input.taskClass === "classification" || input.taskClass === "control";
  const appliedLane = (input.requestedLane === "cheap" && input.cheapAvailable) || (
    input.enabled && input.policy === "conservative" && economyEligible && input.cheapAvailable
  ) ? "cheap" as const : "primary" as const;
  const reason = input.requestedLane === "cheap" && input.cheapAvailable
    ? "Task explicitly requests the cheap model profile."
    : input.requestedLane === "cheap"
      ? "Primary model retained because the requested cheap profile is unavailable."
    : appliedLane === "cheap"
      ? `Conservative routing allows the cheap profile for ${input.taskClass} work.`
      : economyEligible && input.policy === "conservative" && !input.cheapAvailable
        ? "Primary model retained because the agent has no enabled cheap profile."
        : `Primary model retained for ${input.taskClass} work.`;
  return { appliedLane, reason };
}

export function operationalIntelligenceService(db: Db) {
  return {
    buildContext: async (input: {
      companyId: string;
      issueId: string;
      agentId: string;
      explicitModelLane?: "primary" | "cheap" | null;
    }): Promise<OperationalIntelligenceContext | null> => {
      const row = await db
        .select({
          issueId: issues.id,
          projectId: issues.projectId,
          workMode: issues.workMode,
          executionPolicy: issues.executionPolicy,
          assigneeAdapterOverrides: issues.assigneeAdapterOverrides,
          agentId: agents.id,
          agentRole: agents.role,
          agentTitle: agents.title,
          agentCapabilities: agents.capabilities,
          agentRuntimeConfig: agents.runtimeConfig,
        })
        .from(issues)
        .innerJoin(agents, and(eq(agents.id, input.agentId), eq(agents.companyId, input.companyId)))
        .where(and(eq(issues.id, input.issueId), eq(issues.companyId, input.companyId)))
        .then((rows) => rows[0] ?? null);
      if (!row) return null;

      const config = readConfig(row.agentRuntimeConfig);
      const issuePolicy = readIssuePolicy(row.executionPolicy);
      const autonomyParsed = agentAutonomyConfigSchema.safeParse(asRecord(row.agentRuntimeConfig).autonomy);
      const autonomy = autonomyParsed.success && autonomyParsed.data.enabled ? autonomyParsed.data : null;
      if (!config.enabled) {
        return {
          version: 1,
          enabled: false,
          compactRolePrompt: null,
          taskClass: issuePolicy.taskClass,
          planning: { required: false, hasPlan: false, approved: false },
          routing: {
            policy: config.routingPolicy,
            requestedLane: "primary",
            appliedLane: "primary",
            reason: "Operational intelligence is disabled for this agent.",
          },
          session: { reuseEnabled: false, reusable: false, displayId: null },
          memory: [],
          autonomy,
        };
      }
      const plan = await db
        .select({
          id: issueDocuments.id,
          documentId: issueDocuments.documentId,
          latestRevisionId: documents.latestRevisionId,
        })
        .from(issueDocuments)
        .innerJoin(documents, and(eq(documents.id, issueDocuments.documentId), eq(documents.companyId, input.companyId)))
        .where(and(
          eq(issueDocuments.companyId, input.companyId),
          eq(issueDocuments.issueId, input.issueId),
          eq(issueDocuments.key, "plan"),
        ))
        .limit(1)
        .then((rows) => rows[0] ?? null);
      const acceptedPlan = await db
        .select({ payload: issueThreadInteractions.payload })
        .from(issueThreadInteractions)
        .where(and(
          eq(issueThreadInteractions.companyId, input.companyId),
          eq(issueThreadInteractions.issueId, input.issueId),
          eq(issueThreadInteractions.kind, "request_confirmation"),
          eq(issueThreadInteractions.status, "accepted"),
        ))
        .orderBy(desc(issueThreadInteractions.resolvedAt))
        .then((rows) => plan ? rows.some((candidate) => planTargeted(candidate.payload, {
          issueId: input.issueId,
          documentId: plan.documentId,
          revisionId: plan.latestRevisionId,
        })) : false);

      const session = config.reuseTaskSession
        ? await db
            .select({ displayId: agentTaskSessions.sessionDisplayId })
            .from(agentTaskSessions)
            .where(and(
              eq(agentTaskSessions.companyId, input.companyId),
              eq(agentTaskSessions.agentId, input.agentId),
              eq(agentTaskSessions.taskKey, input.issueId),
            ))
            .orderBy(desc(agentTaskSessions.updatedAt))
            .limit(1)
            .then((rows) => rows[0] ?? null)
        : null;

      const outcomeRows = config.outcomeMemoryLimit > 0
        ? await db
            .select({
              id: issueWorkProducts.id,
              issueId: issueWorkProducts.issueId,
              title: issueWorkProducts.title,
              summary: issueWorkProducts.summary,
              metadata: issueWorkProducts.metadata,
              createdAt: issueWorkProducts.createdAt,
            })
            .from(issueWorkProducts)
            .innerJoin(issues, and(
              eq(issues.id, issueWorkProducts.issueId),
              eq(issues.companyId, input.companyId),
            ))
            .where(and(
              eq(issueWorkProducts.companyId, input.companyId),
              eq(issueWorkProducts.type, "outcome"),
              row.projectId ? eq(issues.projectId, row.projectId) : eq(issues.id, input.issueId),
            ))
            .orderBy(desc(issueWorkProducts.createdAt))
            .limit(Math.max(config.outcomeMemoryLimit * 5, config.outcomeMemoryLimit))
        : [];
      const memory = outcomeRows.flatMap((outcome) => {
        const parsed = operationalOutcomeMetadataSchema.safeParse(outcome.metadata);
        return parsed.success && parsed.data.taskClass === issuePolicy.taskClass
          ? [{ ...outcome, metadata: parsed.data }]
          : [];
      }).slice(0, config.outcomeMemoryLimit);

      const storedOverride = asRecord(row.assigneeAdapterOverrides).modelProfile === "cheap" ? "cheap" : null;
      const requestedLane = input.explicitModelLane ?? storedOverride ?? "primary";
      const cheapProfile = asRecord(asRecord(row.agentRuntimeConfig).modelProfiles).cheap;
      const cheapAvailable = asRecord(cheapProfile).enabled !== false && Object.keys(asRecord(cheapProfile)).length > 0;
      const routing = resolveOperationalRouting({
        enabled: config.enabled,
        policy: config.routingPolicy,
        taskClass: issuePolicy.taskClass,
        requestedLane,
        cheapAvailable,
      });
      const planningRequired = issuePolicy.requireApprovedPlan || (
        config.enabled && config.planningBeforeDelegation && row.workMode === "planning"
      );

      return {
        version: 1,
        enabled: config.enabled,
        compactRolePrompt: compactRole({
          configured: config.compactRolePrompt,
          title: row.agentTitle,
          role: row.agentRole,
          capabilities: row.agentCapabilities,
        }),
        taskClass: issuePolicy.taskClass,
        planning: {
          required: planningRequired,
          hasPlan: Boolean(plan),
          approved: acceptedPlan,
        },
        routing: {
          policy: config.routingPolicy,
          requestedLane,
          appliedLane: routing.appliedLane,
          reason: routing.reason,
        },
        session: {
          reuseEnabled: config.reuseTaskSession,
          reusable: Boolean(session),
          displayId: session?.displayId ?? null,
        },
        memory,
        autonomy,
      };
    },
  };
}
