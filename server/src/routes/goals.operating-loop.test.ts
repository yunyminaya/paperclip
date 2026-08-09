import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createIssue = vi.fn();
const logActivity = vi.fn();

vi.mock("../services/index.js", () => ({
  goalService: () => ({ scorecard: async () => ({ status: "losing", behindCount: 1, missingDataCount: 0, items: [] }) }),
  issueService: () => ({ create: createIssue }),
  operatingCapabilityService: () => ({
    inventory: async () => ({ summary: { ready: 1 }, domains: [{ label: "Sales & CRM", status: "ready" }] }),
  }),
  logActivity,
}));

const companyId = "00000000-0000-4000-8000-000000000001";
const ceoId = "00000000-0000-4000-8000-000000000002";

function createDb() {
  return {
    select: () => ({
      from: () => ({ where: () => Promise.resolve([{ id: ceoId, companyId, role: "ceo", status: "active" }]) }),
    }),
  } as any;
}

async function createTestApp(actor: Record<string, unknown>, wakeup = vi.fn(async () => ({ id: "run-1" }))) {
  const { goalRoutes } = await import("./goals.js");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as any).actor = actor; next(); });
  app.use("/api", goalRoutes(createDb(), { heartbeat: { wakeup } }));
  return { app, wakeup };
}

describe("operating loop route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createIssue.mockResolvedValue({ id: "issue-1", assigneeAgentId: ceoId, status: "todo" });
  });

  it("creates and queues the idempotent CEO review for a board actor", async () => {
    const { app, wakeup } = await createTestApp({ type: "board", source: "local_implicit", userId: "board" });
    const response = await request(app).post(`/api/companies/${companyId}/operating-loop/run`).expect(201);
    expect(response.body.executionQueued).toBe(true);
    expect(createIssue).toHaveBeenCalledWith(companyId, expect.objectContaining({
      assigneeAgentId: ceoId,
      idempotencyKey: expect.stringContaining(`operating-loop:${companyId}:`),
    }));
    expect(wakeup).toHaveBeenCalledWith(ceoId, expect.objectContaining({ source: "assignment" }));
  });

  it("rejects a non-CEO agent", async () => {
    const { app } = await createTestApp({ type: "agent", source: "agent_key", agentId: "00000000-0000-4000-8000-000000000099", companyId });
    await request(app).post(`/api/companies/${companyId}/operating-loop/run`).expect(403);
    expect(createIssue).not.toHaveBeenCalled();
  });
});
