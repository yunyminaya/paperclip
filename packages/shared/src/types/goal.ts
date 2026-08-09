import type { GoalLevel, GoalStatus } from "../constants.js";

export interface Goal {
  id: string;
  companyId: string;
  title: string;
  description: string | null;
  level: GoalLevel;
  status: GoalStatus;
  parentId: string | null;
  ownerAgentId: string | null;
  metricKey?: string | null;
  metricUnit?: string | null;
  targetValue?: number | null;
  targetOperator?: "at_least" | "at_most" | null;
  startsAt?: Date | null;
  dueAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoalMetricObservation {
  id: string; companyId: string; goalId: string; value: number; observedAt: Date;
  source: string; note: string | null; reportedByAgentId: string | null;
  heartbeatRunId: string | null; metadata: Record<string, unknown> | null; createdAt: Date;
}
