import type { Goal } from "@paperclipai/shared";
import { api } from "./client";

export const goalsApi = {
  list: (companyId: string) => api.get<Goal[]>(`/companies/${companyId}/goals`),
  get: (id: string) => api.get<Goal>(`/goals/${id}`),
  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<Goal>(`/companies/${companyId}/goals`, data),
  update: (id: string, data: Record<string, unknown>) => api.patch<Goal>(`/goals/${id}`, data),
  remove: (id: string) => api.delete<Goal>(`/goals/${id}`),
  scorecard: (companyId: string) => api.get<{ generatedAt: string; status: "losing" | "on_track" | "unknown"; behindCount: number; items: Array<{ goal: Goal; observation: { value: number } | null; status: string }> }>(`/companies/${companyId}/operating-loop/scorecard`),
  addObservation: (id: string, data: { value: number; source?: string; note?: string }) => api.post(`/goals/${id}/observations`, data),
  capabilities: (companyId: string) => api.get<{ generatedAt: string; summary: { ready: number; incomplete: number; activeMcpTools: number; compatibleSkills: number }; domains: Array<{ key: string; label: string; status: "ready" | "missing_skill" | "missing_mcp" | "missing"; tools: Array<{ id: string; name: string }>; skills: Array<{ id: string; key: string; name: string }> }> }>(`/companies/${companyId}/operating-loop/capabilities`),
};
