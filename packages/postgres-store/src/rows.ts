import {
  AppError,
  type AuditEvent,
  type ChatMessage,
  type ClientInstanceId,
  type Conversation,
  type ModelUsageEvent,
  asConversationId,
  asMessageId
} from "@agent-chat-platform/chat-core";

export interface ConversationRow {
  id: string;
  client_instance_id: string;
  owner_user_id: string;
  owner_external_user_id: string;
  title: string;
  status: Conversation["status"];
  created_at: Date;
  updated_at: Date;
  retained_until: Date;
  deleted_at: Date | null;
}

export interface MessageRow {
  id: string;
  client_instance_id: string;
  conversation_id: string;
  role: ChatMessage["role"];
  text: string;
  created_at: Date;
  metadata: ChatMessage["metadata"];
}

export interface AuditEventRow {
  id: string;
  client_instance_id: string;
  type: string;
  status: AuditEvent["status"];
  actor: AuditEvent["actor"] | null;
  subject: string | null;
  reason: string | null;
  correlation_id: string;
  created_at: Date;
  metadata: AuditEvent["metadata"];
}

export interface ModelUsageEventRow {
  id: string;
  client_instance_id: string;
  conversation_id: string;
  agent_run_id: string;
  agent_name: string;
  provider_id: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  source: ModelUsageEvent["source"];
  correlation_id: string;
  created_at: Date;
}

export function mapConversation(row: ConversationRow | undefined): Conversation {
  if (!row) {
    throw new AppError("INTERNAL", "Expected conversation row");
  }
  return {
    id: asConversationId(row.id),
    clientInstanceId: row.client_instance_id as ClientInstanceId,
    ownerUserId: row.owner_user_id,
    ownerExternalUserId: row.owner_external_user_id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    retainedUntil: row.retained_until.toISOString(),
    deletedAt: row.deleted_at?.toISOString()
  };
}

export function mapMessage(row: MessageRow | undefined): ChatMessage {
  if (!row) {
    throw new AppError("INTERNAL", "Expected message row");
  }
  return {
    id: asMessageId(row.id),
    clientInstanceId: row.client_instance_id as ClientInstanceId,
    conversationId: asConversationId(row.conversation_id),
    role: row.role,
    text: row.text,
    createdAt: row.created_at.toISOString(),
    metadata: row.metadata
  };
}

export function mapAuditEvent(row: AuditEventRow | undefined): AuditEvent {
  if (!row) {
    throw new AppError("INTERNAL", "Expected audit event row");
  }
  return {
    id: row.id as AuditEvent["id"],
    clientInstanceId: row.client_instance_id as ClientInstanceId,
    type: row.type,
    status: row.status,
    actor: row.actor ?? undefined,
    subject: row.subject ?? undefined,
    reason: row.reason ?? undefined,
    correlationId: row.correlation_id,
    createdAt: row.created_at.toISOString(),
    metadata: row.metadata
  };
}

export function mapModelUsageEvent(row: ModelUsageEventRow | undefined): ModelUsageEvent {
  if (!row) {
    throw new AppError("INTERNAL", "Expected model usage event row");
  }
  return {
    id: row.id as ModelUsageEvent["id"],
    clientInstanceId: row.client_instance_id as ClientInstanceId,
    conversationId: asConversationId(row.conversation_id),
    agentRunId: row.agent_run_id as ModelUsageEvent["agentRunId"],
    agentName: row.agent_name,
    providerId: row.provider_id,
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    totalTokens: row.total_tokens,
    source: row.source,
    correlationId: row.correlation_id,
    createdAt: row.created_at.toISOString()
  };
}
