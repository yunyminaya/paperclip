import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { goals, goalMetricObservations } from "@paperclipai/db";

type GoalReader = Pick<Db, "select">;

export async function getDefaultCompanyGoal(db: GoalReader, companyId: string) {
  const activeRootGoal = await db
    .select()
    .from(goals)
    .where(
      and(
        eq(goals.companyId, companyId),
        eq(goals.level, "company"),
        eq(goals.status, "active"),
        isNull(goals.parentId),
      ),
    )
    .orderBy(asc(goals.createdAt))
    .then((rows) => rows[0] ?? null);
  if (activeRootGoal) return activeRootGoal;

  const anyRootGoal = await db
    .select()
    .from(goals)
    .where(
      and(
        eq(goals.companyId, companyId),
        eq(goals.level, "company"),
        isNull(goals.parentId),
      ),
    )
    .orderBy(asc(goals.createdAt))
    .then((rows) => rows[0] ?? null);
  if (anyRootGoal) return anyRootGoal;

  return db
    .select()
    .from(goals)
    .where(and(eq(goals.companyId, companyId), eq(goals.level, "company")))
    .orderBy(asc(goals.createdAt))
    .then((rows) => rows[0] ?? null);
}

export function goalService(db: Db) {
  return {
    list: (companyId: string) => db.select().from(goals).where(eq(goals.companyId, companyId)),

    getById: (id: string) =>
      db
        .select()
        .from(goals)
        .where(eq(goals.id, id))
        .then((rows) => rows[0] ?? null),

    getDefaultCompanyGoal: (companyId: string) => getDefaultCompanyGoal(db, companyId),

    listObservations: (companyId: string, goalId: string) => db.select().from(goalMetricObservations)
      .where(and(eq(goalMetricObservations.companyId, companyId), eq(goalMetricObservations.goalId, goalId)))
      .orderBy(desc(goalMetricObservations.observedAt)),

    addObservation: (companyId: string, goalId: string, data: Omit<typeof goalMetricObservations.$inferInsert, "companyId" | "goalId">) =>
      db.insert(goalMetricObservations).values({ ...data, companyId, goalId }).returning().then((rows) => rows[0]),

    scorecard: async (companyId: string, now = new Date()) => {
      const measurable = await db.select().from(goals).where(and(eq(goals.companyId, companyId), eq(goals.status, "active")));
      const observations = await db.select().from(goalMetricObservations)
        .where(eq(goalMetricObservations.companyId, companyId)).orderBy(desc(goalMetricObservations.observedAt));
      const latest = new Map<string, typeof observations[number]>();
      for (const item of observations) if (!latest.has(item.goalId)) latest.set(item.goalId, item);
      const items = measurable.filter((goal) => goal.metricKey && goal.targetValue != null).map((goal) => {
        const observation = latest.get(goal.id) ?? null;
        const value = observation?.value ?? null;
        const achieved = value != null && (goal.targetOperator === "at_most" ? value <= goal.targetValue! : value >= goal.targetValue!);
        const overdue = Boolean(goal.dueAt && goal.dueAt.getTime() < now.getTime() && !achieved);
        let status: "achieved" | "on_track" | "off_track" | "missing_data" = achieved ? "achieved" : value == null ? "missing_data" : overdue ? "off_track" : "on_track";
        if (!achieved && value != null && goal.targetOperator !== "at_most" && goal.dueAt) {
          const start = goal.startsAt ?? goal.createdAt;
          const elapsed = Math.max(0, now.getTime() - start.getTime());
          const total = Math.max(1, goal.dueAt.getTime() - start.getTime());
          if (value / goal.targetValue! + 0.05 < Math.min(1, elapsed / total)) status = "off_track";
        }
        return { goal, observation, status };
      });
      const behind = items.filter((item) => item.status === "off_track");
      return { generatedAt: now, status: behind.length ? "losing" : items.length ? "on_track" : "unknown", items, behindCount: behind.length };
    },

    create: (companyId: string, data: Omit<typeof goals.$inferInsert, "companyId">) =>
      db
        .insert(goals)
        .values({ ...data, companyId })
        .returning()
        .then((rows) => rows[0]),

    update: (id: string, data: Partial<typeof goals.$inferInsert>) =>
      db
        .update(goals)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(goals.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    remove: (id: string) =>
      db
        .delete(goals)
        .where(eq(goals.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),
  };
}
