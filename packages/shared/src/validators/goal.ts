import { z } from "zod";
import { GOAL_LEVELS, GOAL_STATUSES } from "../constants.js";

const goalFieldsSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  level: z.enum(GOAL_LEVELS).optional().default("task"),
  status: z.enum(GOAL_STATUSES).optional().default("planned"),
  parentId: z.string().uuid().optional().nullable(),
  ownerAgentId: z.string().uuid().optional().nullable(),
  metricKey: z.string().min(1).max(100).optional().nullable(),
  metricUnit: z.string().min(1).max(40).optional().nullable(),
  targetValue: z.number().finite().optional().nullable(),
  targetOperator: z.enum(["at_least", "at_most"]).optional().nullable(),
  startsAt: z.coerce.date().optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
});

export const createGoalSchema = goalFieldsSchema.refine((value) => value.targetValue == null || value.metricKey != null, { message: "metricKey is required when targetValue is set", path: ["metricKey"] });

export type CreateGoal = z.infer<typeof createGoalSchema>;

export const updateGoalSchema = goalFieldsSchema.partial();

export type UpdateGoal = z.infer<typeof updateGoalSchema>;

export const createGoalMetricObservationSchema = z.object({
  value: z.number().finite(),
  observedAt: z.coerce.date().optional().default(() => new Date()),
  source: z.enum(["manual", "agent_report", "connector", "finance", "system"]).optional().default("manual"),
  note: z.string().max(2000).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});
