import { AppError } from "@agent-chat-platform/chat-core";
import { clientInstanceConfigSchema, type ClientInstanceConfig } from "./schemas";

export function parseClientInstanceConfig(input: unknown): ClientInstanceConfig {
  const parsed = clientInstanceConfigSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_FAILED", "Client instance config is invalid", {
      issues: parsed.error.issues
    });
  }

  assertConfigReferences(parsed.data);
  return parsed.data;
}

function assertConfigReferences(config: ClientInstanceConfig): void {
  const agentNames = new Set(config.agents.map((agent) => agent.name));
  if (!agentNames.has(config.defaultAgentName)) {
    throw new AppError(
      "VALIDATION_FAILED",
      `Default agent '${config.defaultAgentName}' is not defined`
    );
  }

  const providerIds = new Set(config.modelProviders.map((provider) => provider.id));
  for (const agent of config.agents) {
    if (agent.modelProviderId && !providerIds.has(agent.modelProviderId)) {
      throw new AppError(
        "VALIDATION_FAILED",
        `Agent '${agent.name}' references missing model provider '${agent.modelProviderId}'`
      );
    }
  }
}
