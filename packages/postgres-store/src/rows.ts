import {
  AppError,
  type AuditEvent,
  type ChatMessage,
  type ClientInstanceId,
  type Conversation,
  type ModelUsageEvent,
  asConversationId,
  asMessageId
} from "@agent-chat-platform/core";
import type { auditEvents, conversations, messages, modelUsageEvents } from "./schema";

export type ConversationRow = typeof conversations.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type AuditEventRow = typeof auditEvents.$inferSelect;
export type ModelUsageEventRow = typeof modelUsageEvents.$inferSelect;

export function mapConversation(row: ConversationRow | undefined): Conversation {
  if (!row) {
    throw new AppError("INTERNAL", "Expected conversation row");
  }
  return {
    id: asConversationId(row.id),
    clientInstanceId: row.clientInstanceId as ClientInstanceId,
    ownerUserId: row.ownerUserId,
    ownerExternalUserId: row.ownerExternalUserId,
    title: row.title,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    retainedUntil: row.retainedUntil.toISOString(),
    deletedAt: row.deletedAt?.toISOString()
  };
}

export function mapMessage(row: MessageRow | undefined): ChatMessage {
  if (!row) {
    throw new AppError("INTERNAL", "Expected message row");
  }
  return {
    id: asMessageId(row.id),
    clientInstanceId: row.clientInstanceId as ClientInstanceId,
    conversationId: asConversationId(row.conversationId),
    role: row.role,
    text: row.text,
    createdAt: row.createdAt.toISOString(),
    metadata: row.metadata
  };
}

export function mapAuditEvent(row: AuditEventRow | undefined): AuditEvent {
  if (!row) {
    throw new AppError("INTERNAL", "Expected audit event row");
  }
  return {
    id: row.id as AuditEvent["id"],
    clientInstanceId: row.clientInstanceId as ClientInstanceId,
    type: row.type,
    status: row.status,
    actor: row.actor ?? undefined,
    subject: row.subject ?? undefined,
    reason: row.reason ?? undefined,
    correlationId: row.correlationId,
    createdAt: row.createdAt.toISOString(),
    metadata: row.metadata
  };
}

export function mapModelUsageEvent(row: ModelUsageEventRow | undefined): ModelUsageEvent {
  if (!row) {
    throw new AppError("INTERNAL", "Expected model usage event row");
  }
  return {
    id: row.id as ModelUsageEvent["id"],
    clientInstanceId: row.clientInstanceId as ClientInstanceId,
    conversationId: asConversationId(row.conversationId),
    agentRunId: row.agentRunId as ModelUsageEvent["agentRunId"],
    agentName: row.agentName,
    providerId: row.providerId,
    model: row.model,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    totalTokens: row.totalTokens,
    source: row.source,
    correlationId: row.correlationId,
    createdAt: row.createdAt.toISOString()
  };
}
