import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { companySkills, toolApplications, toolCatalogEntries, toolConnections } from "@paperclipai/db";
import { isToolConnectionAttentionHealth } from "@paperclipai/shared";

export const OPERATING_CAPABILITY_DOMAINS = [
  { key: "sales_crm", label: "Sales & CRM", terms: ["crm", "sales", "lead", "pipeline", "hubspot", "apollo"] },
  { key: "finance_banking", label: "Banking & cash", terms: ["bank", "banking", "cash", "payment", "stripe", "revenue"] },
  { key: "accounting_tax", label: "Accounting & tax", terms: ["account", "ledger", "invoice", "tax", "irs", "bookkeep"] },
  { key: "communications", label: "Communications", terms: ["phone", "call", "email", "gmail", "outlook", "calendar", "meeting"] },
  { key: "analytics", label: "Analytics", terms: ["analytic", "metric", "kpi", "conversion", "churn", "report"] },
] as const;

function searchable(...values: Array<unknown>): string {
  return values.flatMap((value) => Array.isArray(value) ? value : [value]).filter((value): value is string => typeof value === "string").join(" ").toLowerCase();
}

export function matchesOperatingDomain(text: string, terms: readonly string[]): boolean {
  return terms.some((term) => text.includes(term));
}

export function operatingCapabilityService(db: Db) {
  return {
    inventory: async (companyId: string) => {
      const [applications, connections, catalog, skills] = await Promise.all([
        db.select().from(toolApplications).where(eq(toolApplications.companyId, companyId)),
        db.select().from(toolConnections).where(eq(toolConnections.companyId, companyId)),
        db.select().from(toolCatalogEntries).where(eq(toolCatalogEntries.companyId, companyId)),
        db.select().from(companySkills).where(eq(companySkills.companyId, companyId)),
      ]);
      const connectionById = new Map(connections.map((connection) => [connection.id, connection]));
      const applicationById = new Map(applications.map((application) => [application.id, application]));
      const usableTools = catalog.filter((tool) => {
        const connection = connectionById.get(tool.connectionId);
        return tool.status === "active" && connection?.enabled === true && connection.status === "active" && !isToolConnectionAttentionHealth(connection.healthStatus);
      });
      const domains = OPERATING_CAPABILITY_DOMAINS.map((domain) => {
        const tools = usableTools.filter((tool) => matchesOperatingDomain(searchable(tool.name, tool.toolName, tool.title, tool.description, tool.annotations, applicationById.get(tool.applicationId ?? "")?.name), domain.terms));
        const matchingSkills = skills.filter((skill) => skill.compatibility === "compatible" && matchesOperatingDomain(searchable(skill.name, skill.description, skill.categories, skill.markdown.slice(0, 1000)), domain.terms));
        const status = tools.length > 0 && matchingSkills.length > 0 ? "ready" : tools.length > 0 ? "missing_skill" : matchingSkills.length > 0 ? "missing_mcp" : "missing";
        return {
          key: domain.key, label: domain.label, status,
          tools: tools.map((tool) => ({ id: tool.id, name: tool.title ?? tool.name, riskLevel: tool.riskLevel, connectionId: tool.connectionId })),
          skills: matchingSkills.map((skill) => ({ id: skill.id, key: skill.key, name: skill.name, trustLevel: skill.trustLevel })),
        };
      });
      return {
        generatedAt: new Date(), domains,
        summary: {
          ready: domains.filter((domain) => domain.status === "ready").length,
          incomplete: domains.filter((domain) => domain.status !== "ready").length,
          activeMcpTools: usableTools.length,
          compatibleSkills: skills.filter((skill) => skill.compatibility === "compatible").length,
        },
      };
    },
  };
}
