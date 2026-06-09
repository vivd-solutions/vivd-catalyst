import type { FastifyInstance } from "fastify";
import { LocalAgentRuntime } from "@agent-chat-platform/agent-runtime";
import {
  CompositeAuthAdapter,
  DevelopmentAuthAdapter,
  HmacSessionTokenAuthAdapter,
  HmacSessionTokenIssuer,
  type AuthAdapter
} from "@agent-chat-platform/auth";
import { StoreBackedAuditRecorder } from "@agent-chat-platform/audit";
import { createChatServer } from "@agent-chat-platform/chat-server";
import {
  AppError,
  type AuditEventStore,
  type ConversationStore
} from "@agent-chat-platform/chat-core";
import {
  type ClientInstanceConfig,
  getAgentConfig,
  getClientInstanceId,
  getEnabledToolNames,
  loadClientInstanceConfigFromFile
} from "@agent-chat-platform/config-schema";
import { InMemoryPlatformStore } from "@agent-chat-platform/memory-store";
import { createModelProviderRegistry } from "@agent-chat-platform/model-provider";
import { PostgresPlatformStore } from "@agent-chat-platform/postgres-store";
import { InProcessToolExecution, ToolRegistry } from "@agent-chat-platform/tool-execution";
import type { AnyToolDefinition } from "@agent-chat-platform/tool-sdk";

export type ClientInstanceEnv = Record<string, string | undefined>;

export type PlatformStore = ConversationStore &
  AuditEventStore & {
    close?: () => Promise<void>;
  };

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
  const clientInstanceId = getClientInstanceId(config);
  const store = await createStore(env);
  const auditRecorder = new StoreBackedAuditRecorder({
    clientInstanceId,
    store
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
    toolExecution
  });
  const { authAdapter, sessionToken } = createAuth({
    config,
    env,
    clientInstanceId
  });
  const server = await createChatServer({
    config,
    clientInstanceId,
    authAdapter,
    conversationStore: store,
    auditEventStore: store,
    auditRecorder,
    agentRuntime,
    corsOrigin: input.corsOrigin,
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

async function createStore(env: ClientInstanceEnv): Promise<PlatformStore> {
  if (env.DATABASE_URL) {
    return PostgresPlatformStore.connect({
      databaseUrl: env.DATABASE_URL,
      runMigrations: env.RUN_MIGRATIONS !== "false"
    });
  }
  return new InMemoryPlatformStore();
}

function createAuth(input: {
  config: ClientInstanceConfig;
  env: ClientInstanceEnv;
  clientInstanceId: ReturnType<typeof getClientInstanceId>;
}): {
  authAdapter: AuthAdapter;
  sessionToken?: {
    issuer: HmacSessionTokenIssuer;
    serverCredential: string;
  };
} {
  const adapters: AuthAdapter[] = [];
  const development = input.config.auth.development;
  if (development?.enabled) {
    adapters.push(
      new DevelopmentAuthAdapter({
        enabled: development.enabled,
        user: development.user
      })
    );
  }

  const tokenSecret = input.env.CHAT_SESSION_TOKEN_SECRET;
  const serverCredential = input.env.CHAT_SERVER_CREDENTIAL;
  if (tokenSecret && serverCredential && input.config.auth.sessionToken) {
    const tokenOptions = {
      secret: tokenSecret,
      clientInstanceId: input.clientInstanceId,
      issuer: input.config.auth.sessionToken.issuer,
      ttlSeconds: input.config.auth.sessionToken.ttlSeconds
    };
    adapters.push(new HmacSessionTokenAuthAdapter(tokenOptions));
    return {
      authAdapter: new CompositeAuthAdapter(adapters),
      sessionToken: {
        issuer: new HmacSessionTokenIssuer(tokenOptions),
        serverCredential
      }
    };
  }

  if (adapters.length === 0) {
    throw new AppError("VALIDATION_FAILED", "No auth adapter is configured");
  }

  return {
    authAdapter: new CompositeAuthAdapter(adapters)
  };
}

