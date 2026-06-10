import { and, asc, desc, eq, gte, lt, sql as drizzleSql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { Notice, Sql } from "postgres";
import {
  AppError,
  type AuditEvent,
  type AuditEventInput,
  type AuditEventStore,
  type ChatMessage,
  type ClientInstanceId,
  type Conversation,
  type ConversationId,
  type ConversationStore,
  type CreateConversationInput,
  type CreateMessageInput,
  type ModelUsageEvent,
  type ModelUsageEventInput,
  type ModelUsageEventStore,
  type ModelUsageWindowSummary,
  createPlatformId
} from "@agent-chat-platform/core";
import { runPostgresMigrations } from "./migrations";
import { mapAuditEvent, mapConversation, mapMessage, mapModelUsageEvent } from "./rows";
import { auditEvents, conversations, messages, modelUsageEvents, schema } from "./schema";

export interface PostgresPlatformStoreOptions {
  databaseUrl: string;
  runMigrations?: boolean;
}

const DUPLICATE_RELATION_NOTICE_CODE = "42P07";
type PostgresDatabase = PostgresJsDatabase<typeof schema>;

function handlePostgresNotice(notice: Notice): void {
  if (
    notice.code === DUPLICATE_RELATION_NOTICE_CODE &&
    notice.message?.includes("already exists, skipping")
  ) {
    return;
  }

  console.warn(notice);
}

export class PostgresPlatformStore implements ConversationStore, AuditEventStore, ModelUsageEventStore {
  private readonly sql: Sql;
  private readonly db: PostgresDatabase;

  private constructor(sql: Sql) {
    this.sql = sql;
    this.db = drizzle(sql, { schema });
  }

  static async connect(options: PostgresPlatformStoreOptions): Promise<PostgresPlatformStore> {
    const sql = postgres(options.databaseUrl, {
      max: 10,
      idle_timeout: 30,
      onnotice: handlePostgresNotice
    });
    const store = new PostgresPlatformStore(sql);
    if (options.runMigrations ?? true) {
      await store.migrate();
    }
    return store;
  }

  async close(): Promise<void> {
    await this.sql.end();
  }

  async migrate(): Promise<void> {
    await runPostgresMigrations(this.sql);
  }

  async createConversation(input: CreateConversationInput): Promise<Conversation> {
    const id = createPlatformId<"ConversationId">("conv");
    const now = new Date();
    const [row] = await this.db
      .insert(conversations)
      .values({
        id,
        clientInstanceId: input.clientInstanceId,
        ownerUserId: input.ownerUserId,
        ownerExternalUserId: input.ownerExternalUserId,
        title: input.title,
        status: "active",
        createdAt: now,
        updatedAt: now,
        retainedUntil: new Date(input.retainedUntil)
      })
      .returning();
    return mapConversation(row);
  }

  async getConversation(
    clientInstanceId: ClientInstanceId,
    conversationId: ConversationId
  ): Promise<Conversation | undefined> {
    const [row] = await this.db
      .select()
      .from(conversations)
      .where(and(eq(conversations.clientInstanceId, clientInstanceId), eq(conversations.id, conversationId)))
      .limit(1);
    return row ? mapConversation(row) : undefined;
  }

  async listConversationsForUser(input: {
    clientInstanceId: ClientInstanceId;
    ownerExternalUserId: string;
  }): Promise<Conversation[]> {
    const rows = await this.db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.clientInstanceId, input.clientInstanceId),
          eq(conversations.ownerExternalUserId, input.ownerExternalUserId),
          eq(conversations.status, "active")
        )
      )
      .orderBy(desc(conversations.updatedAt));
    return rows.map(mapConversation);
  }

  async appendMessage(input: CreateMessageInput): Promise<ChatMessage> {
    const conversation = await this.getConversation(input.clientInstanceId, input.conversationId);
    if (!conversation || conversation.status !== "active") {
      throw new AppError("NOT_FOUND", "Conversation is not available");
    }

    const id = createPlatformId<"MessageId">("msg");
    const createdAt = new Date();
    const [row] = await this.db
      .insert(messages)
      .values({
        id,
        clientInstanceId: input.clientInstanceId,
        conversationId: input.conversationId,
        role: input.role,
        text: input.text,
        createdAt,
        metadata: input.metadata ?? {}
      })
      .returning();
    await this.db
      .update(conversations)
      .set({ updatedAt: createdAt })
      .where(
        and(
          eq(conversations.clientInstanceId, input.clientInstanceId),
          eq(conversations.id, input.conversationId)
        )
      );
    return mapMessage(row);
  }

  async listMessages(input: {
    clientInstanceId: ClientInstanceId;
    conversationId: ConversationId;
  }): Promise<ChatMessage[]> {
    const conversation = await this.getConversation(input.clientInstanceId, input.conversationId);
    if (!conversation || conversation.status !== "active") {
      throw new AppError("NOT_FOUND", "Conversation is not available");
    }

    const rows = await this.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.clientInstanceId, input.clientInstanceId),
          eq(messages.conversationId, input.conversationId)
        )
      )
      .orderBy(asc(messages.createdAt));
    return rows.map(mapMessage);
  }

  async listRecentMessages(input: {
    clientInstanceId: ClientInstanceId;
    conversationId: ConversationId;
    limit: number;
  }): Promise<ChatMessage[]> {
    const conversation = await this.getConversation(input.clientInstanceId, input.conversationId);
    if (!conversation || conversation.status !== "active") {
      throw new AppError("NOT_FOUND", "Conversation is not available");
    }

    const rows = await this.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.clientInstanceId, input.clientInstanceId),
          eq(messages.conversationId, input.conversationId)
        )
      )
      .orderBy(desc(messages.createdAt))
      .limit(input.limit);
    return rows.map(mapMessage).reverse();
  }

  async deleteConversation(input: {
    clientInstanceId: ClientInstanceId;
    conversationId: ConversationId;
    deletedAt: string;
  }): Promise<Conversation> {
    await this.db
      .delete(messages)
      .where(
        and(
          eq(messages.clientInstanceId, input.clientInstanceId),
          eq(messages.conversationId, input.conversationId)
        )
      );
    const deletedAt = new Date(input.deletedAt);
    const [row] = await this.db
      .update(conversations)
      .set({
        status: "deleted",
        deletedAt,
        updatedAt: deletedAt
      })
      .where(
        and(
          eq(conversations.clientInstanceId, input.clientInstanceId),
          eq(conversations.id, input.conversationId)
        )
      )
      .returning();
    if (!row) {
      throw new AppError("NOT_FOUND", "Conversation is not available");
    }
    return mapConversation(row);
  }

  async appendAuditEvent(input: AuditEventInput): Promise<AuditEvent> {
    const id = createPlatformId<"AuditEventId">("audit");
    const [row] = await this.db
      .insert(auditEvents)
      .values({
        id,
        clientInstanceId: input.clientInstanceId,
        type: input.type,
        status: input.status,
        actor: input.actor ?? null,
        subject: input.subject ?? null,
        reason: input.reason ?? null,
        correlationId: input.correlationId,
        createdAt: new Date(),
        metadata: input.metadata ?? {}
      })
      .returning();
    return mapAuditEvent(row);
  }

  async listAuditEvents(input: {
    clientInstanceId: ClientInstanceId;
    limit?: number;
    type?: string;
  }): Promise<AuditEvent[]> {
    const limit = input.limit ?? 100;
    const filters = input.type
      ? and(eq(auditEvents.clientInstanceId, input.clientInstanceId), eq(auditEvents.type, input.type))
      : eq(auditEvents.clientInstanceId, input.clientInstanceId);
    const rows = await this.db
      .select()
      .from(auditEvents)
      .where(filters)
      .orderBy(desc(auditEvents.createdAt))
      .limit(limit);
    return rows.map(mapAuditEvent);
  }

  async appendModelUsageEvent(input: ModelUsageEventInput): Promise<ModelUsageEvent> {
    const id = createPlatformId<"ModelUsageEventId">("usage");
    const [row] = await this.db
      .insert(modelUsageEvents)
      .values({
        id,
        clientInstanceId: input.clientInstanceId,
        conversationId: input.conversationId,
        agentRunId: input.agentRunId,
        agentName: input.agentName,
        providerId: input.providerId,
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        totalTokens: input.totalTokens,
        source: input.source,
        correlationId: input.correlationId,
        createdAt: new Date()
      })
      .returning();
    return mapModelUsageEvent(row);
  }

  async summarizeModelUsageEvents(input: {
    clientInstanceId: ClientInstanceId;
    start?: string;
    end?: string;
  }): Promise<ModelUsageWindowSummary> {
    const [row] = await this.db
      .select({
        modelCallCount: drizzleSql<number>`count(*)::int`,
        inputTokens: drizzleSql<number>`coalesce(sum(${modelUsageEvents.inputTokens}), 0)::int`,
        outputTokens: drizzleSql<number>`coalesce(sum(${modelUsageEvents.outputTokens}), 0)::int`,
        totalTokens: drizzleSql<number>`coalesce(sum(${modelUsageEvents.totalTokens}), 0)::int`
      })
      .from(modelUsageEvents)
      .where(and(...modelUsageFilters(input)));

    return {
      start: input.start,
      end: input.end,
      modelCallCount: row?.modelCallCount ?? 0,
      inputTokens: row?.inputTokens ?? 0,
      outputTokens: row?.outputTokens ?? 0,
      totalTokens: row?.totalTokens ?? 0
    };
  }

  async listModelUsageEvents(input: {
    clientInstanceId: ClientInstanceId;
    start?: string;
    end?: string;
    limit?: number;
  }): Promise<ModelUsageEvent[]> {
    const query = this.db
      .select()
      .from(modelUsageEvents)
      .where(and(...modelUsageFilters(input)))
      .orderBy(desc(modelUsageEvents.createdAt));
    const rows = input.limit === undefined ? await query : await query.limit(input.limit);
    return rows.map(mapModelUsageEvent);
  }
}

function modelUsageFilters(input: {
  clientInstanceId: ClientInstanceId;
  start?: string;
  end?: string;
}) {
  return [
    eq(modelUsageEvents.clientInstanceId, input.clientInstanceId),
    ...(input.start ? [gte(modelUsageEvents.createdAt, new Date(input.start))] : []),
    ...(input.end ? [lt(modelUsageEvents.createdAt, new Date(input.end))] : [])
  ];
}
