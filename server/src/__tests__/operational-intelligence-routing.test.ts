import { describe, expect, it } from "vitest";
import { resolveOperationalRouting } from "../services/operational-intelligence.js";

describe("operational intelligence routing", () => {
  it("uses the cheap lane for conservative classification only when available", () => {
    expect(resolveOperationalRouting({
      enabled: true,
      policy: "conservative",
      taskClass: "classification",
      requestedLane: "primary",
      cheapAvailable: true,
    }).appliedLane).toBe("cheap");
  });

  it("keeps difficult decisions on the primary lane", () => {
    expect(resolveOperationalRouting({
      enabled: true,
      policy: "conservative",
      taskClass: "decision",
      requestedLane: "primary",
      cheapAvailable: true,
    }).appliedLane).toBe("primary");
  });

  it("does not claim an unavailable explicit cheap profile", () => {
    expect(resolveOperationalRouting({
      enabled: true,
      policy: "manual",
      taskClass: "implementation",
      requestedLane: "cheap",
      cheapAvailable: false,
    }).appliedLane).toBe("primary");
  });
});
