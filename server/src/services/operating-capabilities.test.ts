import { describe, expect, it } from "vitest";
import { matchesOperatingDomain } from "./operating-capabilities.js";

describe("matchesOperatingDomain", () => {
  it("matches MCP and skill descriptions to an operating domain", () => {
    expect(matchesOperatingDomain("hubspot crm contacts", ["crm", "sales"])).toBe(true);
    expect(matchesOperatingDomain("stripe payment balance", ["bank", "payment"])).toBe(true);
  });

  it("fails closed when no domain term is present", () => {
    expect(matchesOperatingDomain("generic file reader", ["crm", "sales"])).toBe(false);
  });
});
