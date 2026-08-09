export const OPERATIONAL_TASK_CLASSES = [
  "classification",
  "control",
  "routine",
  "research",
  "implementation",
  "decision",
] as const;

export type OperationalTaskClass = (typeof OPERATIONAL_TASK_CLASSES)[number];

export type OperationalRoutingPolicy = "manual" | "conservative";
export type OperationalModelLane = "primary" | "cheap";

export interface AgentOperationalIntelligenceConfig {
  enabled: boolean;
  compactRolePrompt?: string | null;
  planningBeforeDelegation: boolean;
  reuseTaskSession: boolean;
  outcomeMemoryLimit: number;
  routingPolicy: OperationalRoutingPolicy;
}

export interface AgentAutonomyConfig {
  enabled: boolean;
  executiveMandate: string;
  allowSkillAcquisition: boolean;
  allowToolDiscovery: boolean;
  allowAgentHiring: boolean;
  toolProfileId?: string | null;
}

export interface IssueOperationalIntelligencePolicy {
  taskClass: OperationalTaskClass;
  requireApprovedPlan: boolean;
}

export interface OperationalOutcomeMetadata {
  version: 1;
  kind: "operational_outcome";
  taskClass: OperationalTaskClass;
  status: "succeeded" | "partial" | "failed";
  agentId: string;
  modelLane: OperationalModelLane;
  model?: string | null;
  skillKeys: string[];
  repository?: string | null;
  score?: number | null;
  lessons: string[];
}

export interface OperationalOutcomeMemoryItem {
  id: string;
  issueId: string;
  title: string;
  summary: string | null;
  metadata: OperationalOutcomeMetadata;
  createdAt: Date | string;
}

export interface OperationalIntelligenceContext {
  version: 1;
  enabled: boolean;
  compactRolePrompt: string | null;
  taskClass: OperationalTaskClass;
  planning: {
    required: boolean;
    hasPlan: boolean;
    approved: boolean;
  };
  routing: {
    policy: OperationalRoutingPolicy;
    requestedLane: OperationalModelLane;
    appliedLane: OperationalModelLane;
    reason: string;
  };
  session: {
    reuseEnabled: boolean;
    reusable: boolean;
    displayId: string | null;
  };
  memory: OperationalOutcomeMemoryItem[];
  autonomy?: AgentAutonomyConfig | null;
}
