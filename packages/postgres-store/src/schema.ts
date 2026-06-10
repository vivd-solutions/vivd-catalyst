import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type {
  AuditEvent,
  ChatMessage,
  Conversation,
  ModelUsageEvent
} from "@agent-chat-platform/core";

export const conversations = pgTable("conversations", {
  id: text("id").primaryKey(),
  clientInstanceId: text("client_instance_id").notNull(),
  ownerUserId: text("owner_user_id").notNull(),
  ownerExternalUserId: text("owner_external_user_id").notNull(),
  title: text("title").notNull(),
  status: text("status").$type<Conversation["status"]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  retainedUntil: timestamp("retained_until", { withTimezone: true }).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true })
});

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  clientInstanceId: text("client_instance_id").notNull(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").$type<ChatMessage["role"]>().notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  metadata: jsonb("metadata").$type<NonNullable<ChatMessage["metadata"]>>().notNull()
});

export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  clientInstanceId: text("client_instance_id").notNull(),
  type: text("type").notNull(),
  status: text("status").$type<AuditEvent["status"]>().notNull(),
  actor: jsonb("actor").$type<AuditEvent["actor"]>(),
  subject: text("subject"),
  reason: text("reason"),
  correlationId: text("correlation_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  metadata: jsonb("metadata").$type<NonNullable<AuditEvent["metadata"]>>().notNull()
});

export const modelUsageEvents = pgTable("model_usage_events", {
  id: text("id").primaryKey(),
  clientInstanceId: text("client_instance_id").notNull(),
  conversationId: text("conversation_id").notNull(),
  agentRunId: text("agent_run_id").notNull(),
  agentName: text("agent_name").notNull(),
  providerId: text("provider_id").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  totalTokens: integer("total_tokens").notNull(),
  source: text("source").$type<ModelUsageEvent["source"]>().notNull(),
  correlationId: text("correlation_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
});

export const schema = {
  conversations,
  messages,
  auditEvents,
  modelUsageEvents
};
