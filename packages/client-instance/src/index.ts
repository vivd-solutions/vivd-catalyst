import type { FastifyInstance } from "fastify";
import { LocalAgentRuntime } from "@agent-chat-platform/agent-runtime";
import { StoreBackedAuditRecorder } from "@agent-chat-platform/audit";
import { createChatServer } from "@agent-chat-platform/chat-server";
import { AppError } from "@agent-chat-platform/chat-core";
import {
  type ClientInstanceConfig,
  getAgentConfig,
  getClientInstanceId,
  getEnabledToolNames,
  loadClientInstanceConfigFromFile
} from "@agent-chat-platform/config-schema";
import { createModelProviderRegistry } from "@agent-chat-platform/model-provider";
import { InProcessToolExecution, ToolRegistry } from "@agent-chat-platform/tool-execution";
import type { AnyToolDefinition } from "@agent-chat-platform/tool-sdk";
import { ModelUsageGovernance } from "@agent-chat-platform/usage-governance";
import { assertClientAssemblyValid } from "./assembly-validation";
import { createClientInstanceAuth } from "./auth";
import type { ClientInstanceEnv } from "./env";
import { createPlatformStore } from "./store";

export type { ClientInstanceEnv } from "./env";

export interface CreateClientInstanceAppInput {
  config?: ClientInstanceConfig;
  configPath?: string;
  env?: ClientInstanceEnv;
  tools: AnyToolDefinition[];
  corsOrigin?: string | string[];
}

export interface ClientInstanceApp {
  readonly config: ClientInstanceConfig;
  readonly server: FastifyInstance;
  listen(input?: { host?: string; port?: number }): Promise<void>;
  close(): Promise<void>;
}

export async function createClientInstanceApp(
  input: CreateClientInstanceAppInput
): Promise<ClientInstanceApp> {
  const env = input.env ?? process.env;
  const config = input.config ?? (await loadConfig(input.configPath));
  assertClientAssemblyValid({
    config,
    tools: input.tools
  });
  const clientInstanceId = getClientInstanceId(config);
  const store = await createPlatformStore(env);
  const auditRecorder = new StoreBackedAuditRecorder({
    clientInstanceId,
    store
  });
  const usageGovernance = new ModelUsageGovernance({
    store,
    limits: config.usage.limits,
    pricing: config.usage.pricing
  });
  const toolRegistry = new ToolRegistry({
    tools: input.tools,
    enabledToolNames: getEnabledToolNames(config)
  });
  const toolExecution = new InProcessToolExecution({
    registry: toolRegistry,
    getAgentToolNames(agentName) {
      return getAgentConfig(config, agentName).toolNames;
    },
    auditRecorder
  });
  const modelProvider = createModelProviderRegistry({
    configs: config.modelProviders,
    env
  });
  const agentRuntime = new LocalAgentRuntime({
    config,
    modelProvider,
    toolRegistry,
    toolExecution,
    usageGovernance
  });
  const { authAdapter, standaloneAuth, sessionToken } = await createClientInstanceAuth({
    config,
    env,
    clientInstanceId,
    corsOrigin: input.corsOrigin
  });
  const server = await createChatServer({
    config,
    clientInstanceId,
    authAdapter,
    conversationStore: store,
    auditEventStore: store,
    usageGovernance,
    auditRecorder,
    agentRuntime,
    corsOrigin: input.corsOrigin,
    standaloneAuth,
    sessionToken
  });

  return {
    config,
    server,
    async listen(listenInput = {}) {
      await server.listen({
        host: listenInput.host ?? env.HOST ?? "127.0.0.1",
        port: Number(listenInput.port ?? env.PORT ?? 4100)
      });
    },
    async close() {
      await server.close();
      await standaloneAuth?.close();
      await store.close?.();
    }
  };
}

async function loadConfig(configPath: string | undefined): Promise<ClientInstanceConfig> {
  if (!configPath) {
    throw new AppError("VALIDATION_FAILED", "A client instance config path is required");
  }
  return loadClientInstanceConfigFromFile(configPath);
}
