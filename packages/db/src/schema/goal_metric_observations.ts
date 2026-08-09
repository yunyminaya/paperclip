import { pgTable, uuid, text, timestamp, doublePrecision, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { goals } from "./goals.js";
import { agents } from "./agents.js";
import { heartbeatRuns } from "./heartbeat_runs.js";

export const goalMetricObservations = pgTable("goal_metric_observations", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  goalId: uuid("goal_id").notNull().references(() => goals.id, { onDelete: "cascade" }),
  value: doublePrecision("value").notNull(),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  source: text("source").notNull().default("manual"),
  note: text("note"),
  reportedByAgentId: uuid("reported_by_agent_id").references(() => agents.id),
  heartbeatRunId: uuid("heartbeat_run_id").references(() => heartbeatRuns.id),
  metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  companyGoalObservedIdx: index("goal_metric_observations_company_goal_observed_idx").on(table.companyId, table.goalId, table.observedAt),
}));
