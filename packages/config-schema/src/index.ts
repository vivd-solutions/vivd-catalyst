import { readFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import yaml from "js-yaml";
import { z } from "zod";
import { AppError, asClientInstanceId } from "@agent-chat-platform/chat-core";

const userIdentitySchema = z.object({
  id: z.string().min(1).default("dev-user"),
  externalUserId: z.string().min(1).default("dev-user"),
  displayLabel: z.string().min(1).default("Development User"),
  email: z.string().email().optional(),
  roles: z.array(z.string().min(1)).default(["user", "admin"]),
  permissionRefs: z.array(z.string().min(1)).default(["demo-tools"]),
  authSource: z.string().min(1).default("development")
});

const deterministicModelProviderSchema = z.object({
  id: z.string().min(1),
  type: z.literal("deterministic"),
  model: z.string().min(1).default("deterministic-local")
});

const openAiCompatibleModelProviderSchema = z.object({
  id: z.string().min(1),
  type: z.literal("openai-compatible"),
  model: z.string().min(1),
  baseUrl: z.string().url().default("https://api.openai.com/v1"),
  apiKeyEnvName: z.string().min(1).default("OPENAI_API_KEY"),
  organizationEnvName: z.string().min(1).optional()
});

export const modelProviderConfigSchema = z.discriminatedUnion("type", [
  deterministicModelProviderSchema,
  openAiCompatibleModelProviderSchema
]);

export const agentConfigSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  instructions: z.string().min(1),
  modelProviderId: z.string().min(1).optional(),
  toolNames: z.array(z.string().min(1)).default([])
});

export const clientInstanceConfigSchema = z.object({
  version: z.literal(1).default(1),
  clientInstance: z.object({
    id: z.string().min(1),
    displayName: z.string().min(1),
    environment: z.enum(["development", "production"]).default("development")
  }),
  auth: z
    .object({
      development: z
        .object({
          enabled: z.boolean().default(false),
          user: userIdentitySchema.default({
            id: "dev-user",
            externalUserId: "dev-user",
            displayLabel: "Development User",
            roles: ["user", "admin"],
            permissionRefs: ["demo-tools"],
            authSource: "development"
          })
        })
        .optional(),
      sessionToken: z
        .object({
          issuer: z.string().min(1).default("agent-chat-platform"),
          ttlSeconds: z.number().int().positive().max(3600).default(900)
        })
        .optional()
    })
    .default({}),
  retention: z
    .object({
      conversationDays: z.number().int().positive().max(3650).default(30),
      auditDays: z.number().int().positive().max(3650).default(365),
      allowUserDelete: z.boolean().default(true)
    })
    .default({
      conversationDays: 30,
      auditDays: 365,
      allowUserDelete: true
    }),
  modelProviders: z
    .array(modelProviderConfigSchema)
    .min(1)
    .default([{ id: "local", type: "deterministic", model: "deterministic-local" }]),
  defaultAgentName: z.string().min(1),
  agents: z.array(agentConfigSchema).min(1),
  tools: z
    .array(
      z.object({
        name: z.string().min(1),
        enabled: z.boolean().default(true)
      })
    )
    .default([]),
  ui: z
    .object({
      title: z.string().min(1).default("Agent Chat"),
      welcomeMessage: z.string().min(1).default("How can I help?"),
      accentColor: z.string().min(1).default("#0f766e")
    })
    .default({
      title: "Agent Chat",
      welcomeMessage: "How can I help?",
      accentColor: "#0f766e"
    })
});

const clientInstanceConfigFileSchema = clientInstanceConfigSchema
  .omit({
    agents: true
  })
  .extend({
    agents: z.array(agentConfigSchema).default([]),
    agentFiles: z.array(z.string().min(1)).default([])
  });

export type UserIdentityConfig = z.infer<typeof userIdentitySchema>;
export type ModelProviderConfig = z.infer<typeof modelProviderConfigSchema>;
export type AgentConfig = z.infer<typeof agentConfigSchema>;
export type ClientInstanceConfig = z.infer<typeof clientInstanceConfigSchema>;

export function parseClientInstanceConfig(input: unknown): ClientInstanceConfig {
  const parsed = clientInstanceConfigSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_FAILED", "Client instance config is invalid", {
      issues: parsed.error.issues
    });
  }

  const agentNames = new Set(parsed.data.agents.map((agent) => agent.name));
  if (!agentNames.has(parsed.data.defaultAgentName)) {
    throw new AppError(
      "VALIDATION_FAILED",
      `Default agent '${parsed.data.defaultAgentName}' is not defined`
    );
  }

  const providerIds = new Set(parsed.data.modelProviders.map((provider) => provider.id));
  for (const agent of parsed.data.agents) {
    if (agent.modelProviderId && !providerIds.has(agent.modelProviderId)) {
      throw new AppError(
        "VALIDATION_FAILED",
        `Agent '${agent.name}' references missing model provider '${agent.modelProviderId}'`
      );
    }
  }

  return parsed.data;
}

export async function loadClientInstanceConfigFromFile(
  path: string
): Promise<ClientInstanceConfig> {
  const raw = await readStructuredFile(path);
  const parsed = clientInstanceConfigFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("VALIDATION_FAILED", "Client instance config is invalid", {
      issues: parsed.error.issues
    });
  }

  const baseDir = dirname(path);
  const fileAgents = await Promise.all(
    parsed.data.agentFiles.map(async (agentFile) => {
      const agentPath = resolve(baseDir, agentFile);
      const agentRaw = await readStructuredFile(agentPath);
      const agent = agentConfigSchema.safeParse(agentRaw);
      if (!agent.success) {
        throw new AppError("VALIDATION_FAILED", `Agent config '${agentFile}' is invalid`, {
          issues: agent.error.issues
        });
      }
      return agent.data;
    })
  );

  return parseClientInstanceConfig({
    ...parsed.data,
    agents: [...parsed.data.agents, ...fileAgents]
  });
}

export function getClientInstanceId(config: ClientInstanceConfig) {
  return asClientInstanceId(config.clientInstance.id);
}

export function getAgentConfig(config: ClientInstanceConfig, agentName: string): AgentConfig {
  const agent = config.agents.find((candidate) => candidate.name === agentName);
  if (!agent) {
    throw new AppError("NOT_FOUND", `Agent '${agentName}' is not defined`);
  }
  return agent;
}

export function getModelProviderForAgent(
  config: ClientInstanceConfig,
  agent: AgentConfig
): ModelProviderConfig {
  const providerId = agent.modelProviderId ?? config.modelProviders[0]?.id;
  const provider = config.modelProviders.find((candidate) => candidate.id === providerId);
  if (!provider) {
    throw new AppError("NOT_FOUND", `Model provider '${providerId}' is not defined`);
  }
  return provider;
}

export function getEnabledToolNames(config: ClientInstanceConfig): Set<string> {
  return new Set(config.tools.filter((tool) => tool.enabled).map((tool) => tool.name));
}

export function createSafeConfigView(config: ClientInstanceConfig) {
  return {
    clientInstance: {
      id: config.clientInstance.id,
      displayName: config.clientInstance.displayName,
      environment: config.clientInstance.environment
    },
    retention: config.retention,
    defaultAgentName: config.defaultAgentName,
    agents: config.agents.map((agent) => ({
      name: agent.name,
      displayName: agent.displayName
    })),
    ui: config.ui
  };
}

async function readStructuredFile(path: string): Promise<unknown> {
  const contents = await readFile(path, "utf8");
  const extension = extname(path).toLowerCase();
  return extension === ".json" ? JSON.parse(contents) : yaml.load(contents);
}
