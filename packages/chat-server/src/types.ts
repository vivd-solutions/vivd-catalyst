import type { HmacSessionTokenIssuer, StandaloneAuthRuntime } from "@agent-chat-platform/auth";
import type {
  AgentRuntime,
  AuditEventStore,
  ClientInstanceId,
  ConversationStore
} from "@agent-chat-platform/core";
import type { AuditRecorder } from "@agent-chat-platform/core";
import type { AuthAdapter } from "@agent-chat-platform/auth";
import type { ClientInstanceConfig } from "@agent-chat-platform/config-schema";
import type { ModelUsageGovernance } from "@agent-chat-platform/usage-governance";

export interface ChatServerOptions {
  config: ClientInstanceConfig;
  clientInstanceId: ClientInstanceId;
  authAdapter: AuthAdapter;
  conversationStore: ConversationStore;
  auditEventStore: AuditEventStore;
  usageGovernance: ModelUsageGovernance;
  auditRecorder: AuditRecorder;
  agentRuntime: AgentRuntime;
  corsOrigin?: string | string[];
  standaloneAuth?: Pick<StandaloneAuthRuntime, "handleRequest" | "baseUrl">;
  sessionToken?: {
    issuer: HmacSessionTokenIssuer;
    serverCredential: string;
  };
}
