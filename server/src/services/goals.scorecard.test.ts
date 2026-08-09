import { describe, expect, it } from "vitest";
import { evaluateGoalMetric } from "./goals.js";

const now = new Date("2026-08-09T12:00:00.000Z");
const base = {
  targetValue: 100,
  targetOperator: "at_least",
  startsAt: new Date("2026-08-01T00:00:00.000Z"),
  dueAt: new Date("2026-08-17T00:00:00.000Z"),
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
};

describe("evaluateGoalMetric", () => {
  it("fails closed when an at-most limit is exceeded", () => {
    expect(evaluateGoalMetric({ ...base, targetOperator: "at_most" }, 101, now)).toBe("off_track");
    expect(evaluateGoalMetric({ ...base, targetOperator: "at_most" }, 99, now)).toBe("achieved");
  });

  it("marks missing evidence and overdue targets correctly", () => {
    expect(evaluateGoalMetric(base, null, now)).toBe("missing_data");
    expect(evaluateGoalMetric({ ...base, dueAt: new Date("2026-08-08T00:00:00.000Z") }, 90, now)).toBe("off_track");
  });

  it("compares positive progress targets with elapsed time", () => {
    expect(evaluateGoalMetric(base, 20, now)).toBe("off_track");
    expect(evaluateGoalMetric(base, 60, now)).toBe("on_track");
    expect(evaluateGoalMetric(base, 100, now)).toBe("achieved");
  });
});
