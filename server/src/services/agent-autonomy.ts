import type { Db } from "@paperclipai/db";
import type {
  Agent,
  AgentAutonomyConfig,
  AgentAutonomyMandateResult,
  ConfigureAgentAutonomy,
} from "@paperclipai/shared";
import { agentService } from "./agents.js";
import { toolAccessService } from "./tool-access.js";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function autonomyProfileKey(agentId: string) {
  return `executive-autonomy-${agentId}`;
}

export function agentAutonomyService(db: Db) {
  const agents = agentService(db);
  const tools = toolAccessService(db);

  return {
    configure: async (input: {
      agentId: string;
      companyId: string;
      mandate: ConfigureAgentAutonomy;
      actor: { actorType?: "agent" | "user" | "system"; actorId?: string | null };
    }): Promise<AgentAutonomyMandateResult | null> => {
      const current = await agents.getById(input.agentId);
      if (!current || current.companyId !== input.companyId) return null;

      const profiles = await tools.listProfiles(input.companyId);
      const profileKey = autonomyProfileKey(current.id);
      let profile = profiles.find((candidate) => candidate.profileKey === profileKey) ?? null;

      if (input.mandate.enabled) {
        const profileInput = {
          profileKey,
          name: `Executive autonomy · ${current.name}`,
          description: "Allows every connected company tool while tool policies, approvals, budgets, and audit remain authoritative.",
          status: "active" as const,
          defaultAction: "allow" as const,
          metadata: {
            kind: "executive_autonomy",
            autonomyAgentId: current.id,
          },
        };
        profile = profile
          ? await tools.updateProfile(profile.id, profileInput)
          : await tools.createProfile(input.companyId, profileInput);
        if (!profile.bindings.some((binding) => binding.targetType === "agent" && binding.targetId === current.id)) {
          await tools.bindProfile(profile.id, {
            targetType: "agent",
            targetId: current.id,
            priority: 10_000,
            metadata: { kind: "executive_autonomy" },
          }, input.actor);
          profile = await tools.getProfile(profile.id, input.companyId);
        }
      } else if (profile) {
        await tools.unbindProfile(profile.id, { targetType: "agent", targetId: current.id });
        profile = await tools.getProfile(profile.id, input.companyId);
      }

      const autonomy: AgentAutonomyConfig = {
        ...input.mandate,
        allowSkillAcquisition: input.mandate.enabled && input.mandate.allowSkillAcquisition,
        allowToolDiscovery: input.mandate.enabled && input.mandate.allowToolDiscovery,
        allowAgentHiring: input.mandate.enabled && input.mandate.allowAgentHiring,
        toolProfileId: input.mandate.enabled ? profile?.id ?? null : null,
      };
      const runtimeConfig = asRecord(current.runtimeConfig);
      const operational = asRecord(runtimeConfig.operationalIntelligence);
      const permissions = asRecord(current.permissions);
      const currentAutonomy = asRecord(runtimeConfig.autonomy);
      const savedPermissions = currentAutonomy.enabled === true
        ? asRecord(runtimeConfig.autonomyPriorPermissions)
        : {
            canCreateAgents: permissions.canCreateAgents === true,
            canCreateSkills: permissions.canCreateSkills !== false,
          };
      const updated = await agents.update(current.id, {
        runtimeConfig: {
          ...runtimeConfig,
          autonomy,
          autonomyPriorPermissions: input.mandate.enabled ? savedPermissions : undefined,
          operationalIntelligence: {
            ...operational,
            enabled: input.mandate.enabled || operational.enabled === true,
            planningBeforeDelegation: true,
            reuseTaskSession: true,
            outcomeMemoryLimit: typeof operational.outcomeMemoryLimit === "number"
              ? operational.outcomeMemoryLimit
              : 5,
            routingPolicy: operational.routingPolicy === "manual" ? "manual" : "conservative",
          },
        },
        permissions: {
          ...permissions,
          canCreateAgents: input.mandate.enabled
            ? autonomy.allowAgentHiring
            : savedPermissions.canCreateAgents === true,
          canCreateSkills: input.mandate.enabled
            ? autonomy.allowSkillAcquisition
            : savedPermissions.canCreateSkills !== false,
        },
      });
      if (!updated) return null;

      const effective = await tools.getEffectiveProfilesForAgent(input.companyId, current.id);
      return {
        agent: updated as Agent,
        autonomy,
        toolProfile: profile ? {
          id: profile.id,
          profileKey: profile.profileKey,
          name: profile.name,
          defaultAction: profile.defaultAction,
          status: profile.status,
        } : null,
        allowedToolCount: effective.allowedTools.length,
      };
    },
  };
}
