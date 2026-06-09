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
} from "@agent-chat-platform/chat-core";
import { runPostgresMigrations } from "./migrations";
import {
  type AuditEventRow,
  type ConversationRow,
  type MessageRow,
  type ModelUsageEventRow,
  mapAuditEvent,
  mapConversation,
  mapMessage,
  mapModelUsageEvent
} from "./rows";

export interface PostgresPlatformStoreOptions {
  databaseUrl: string;
  runMigrations?: boolean;
}

const DUPLICATE_RELATION_NOTICE_CODE = "42P07";

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

  constructor(sql: Sql) {
    this.sql = sql;
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
    const now = new Date().toISOString();
    const [row] = await this.sql<ConversationRow[]>`
      insert into conversations (
        id,
        client_instance_id,
        owner_user_id,
        owner_external_user_id,
        title,
        status,
        created_at,
        updated_at,
        retained_until
      )
      values (
        ${id},
        ${input.clientInstanceId},
        ${input.ownerUserId},
        ${input.ownerExternalUserId},
        ${input.title},
        'active',
        ${now},
        ${now},
        ${input.retainedUntil}
      )
      returning *
    `;
    return mapConversation(row);
  }

  async getConversation(
    clientInstanceId: ClientInstanceId,
    conversationId: ConversationId
  ): Promise<Conversation | undefined> {
    const [row] = await this.sql<ConversationRow[]>`
      select * from conversations
      where client_instance_id = ${clientInstanceId}
        and id = ${conversationId}
      limit 1
    `;
    return row ? mapConversation(row) : undefined;
  }

  async listConversationsForUser(input: {
    clientInstanceId: ClientInstanceId;
    ownerExternalUserId: string;
  }): Promise<Conversation[]> {
    const rows = await this.sql<ConversationRow[]>`
      select * from conversations
      where client_instance_id = ${input.clientInstanceId}
        and owner_external_user_id = ${input.ownerExternalUserId}
        and status = 'active'
      order by updated_at desc
    `;
    return rows.map(mapConversation);
  }

  async appendMessage(input: CreateMessageInput): Promise<ChatMessage> {
    const conversation = await this.getConversation(input.clientInstanceId, input.conversationId);
    if (!conversation || conversation.status !== "active") {
      throw new AppError("NOT_FOUND", "Conversation is not available");
    }

    const id = createPlatformId<"MessageId">("msg");
    const createdAt = new Date().toISOString();
    const [row] = await this.sql<MessageRow[]>`
      insert into messages (
        id,
        client_instance_id,
        conversation_id,
        role,
        text,
        created_at,
        metadata
      )
      values (
        ${id},
        ${input.clientInstanceId},
        ${input.conversationId},
        ${input.role},
        ${input.text},
        ${createdAt},
        ${this.sql.json(input.metadata ?? {})}
      )
      returning *
    `;
    await this.sql`
      update conversations
      set updated_at = ${createdAt}
      where client_instance_id = ${input.clientInstanceId}
        and id = ${input.conversationId}
    `;
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

    const rows = await this.sql<MessageRow[]>`
      select * from messages
      where client_instance_id = ${input.clientInstanceId}
        and conversation_id = ${input.conversationId}
      order by created_at asc
    `;
    return rows.map(mapMessage);
  }

  async deleteConversation(input: {
    clientInstanceId: ClientInstanceId;
    conversationId: ConversationId;
    deletedAt: string;
  }): Promise<Conversation> {
    await this.sql`
      delete from messages
      where client_instance_id = ${input.clientInstanceId}
        and conversation_id = ${input.conversationId}
    `;
    const [row] = await this.sql<ConversationRow[]>`
      update conversations
      set status = 'deleted',
          deleted_at = ${input.deletedAt},
          updated_at = ${input.deletedAt}
      where client_instance_id = ${input.clientInstanceId}
        and id = ${input.conversationId}
      returning *
    `;
    if (!row) {
      throw new AppError("NOT_FOUND", "Conversation is not available");
    }
    return mapConversation(row);
  }

  async appendAuditEvent(input: AuditEventInput): Promise<AuditEvent> {
    const id = createPlatformId<"AuditEventId">("audit");
    const createdAt = new Date().toISOString();
    const [row] = await this.sql<AuditEventRow[]>`
      insert into audit_events (
        id,
        client_instance_id,
        type,
        status,
        actor,
        subject,
        reason,
        correlation_id,
        created_at,
        metadata
      )
      values (
        ${id},
        ${input.clientInstanceId},
        ${input.type},
        ${input.status},
        ${input.actor ? this.sql.json(JSON.parse(JSON.stringify(input.actor))) : null},
        ${input.subject ?? null},
        ${input.reason ?? null},
        ${input.correlationId},
        ${createdAt},
        ${this.sql.json(input.metadata ?? {})}
      )
      returning *
    `;
    return mapAuditEvent(row);
  }

  async listAuditEvents(input: {
    clientInstanceId: ClientInstanceId;
    limit?: number;
    type?: string;
  }): Promise<AuditEvent[]> {
    const limit = input.limit ?? 100;
    const rows = input.type
      ? await this.sql<AuditEventRow[]>`
          select * from audit_events
          where client_instance_id = ${input.clientInstanceId}
            and type = ${input.type}
          order by created_at desc
          limit ${limit}
        `
      : await this.sql<AuditEventRow[]>`
          select * from audit_events
          where client_instance_id = ${input.clientInstanceId}
          order by created_at desc
          limit ${limit}
        `;
    return rows.map(mapAuditEvent);
  }

  async appendModelUsageEvent(input: ModelUsageEventInput): Promise<ModelUsageEvent> {
    const id = createPlatformId<"ModelUsageEventId">("usage");
    const createdAt = new Date().toISOString();
    const [row] = await this.sql<ModelUsageEventRow[]>`
      insert into model_usage_events (
        id,
        client_instance_id,
        conversation_id,
        agent_run_id,
        agent_name,
        provider_id,
        model,
        input_tokens,
        output_tokens,
        total_tokens,
        source,
        correlation_id,
        created_at
      )
      values (
        ${id},
        ${input.clientInstanceId},
        ${input.conversationId},
        ${input.agentRunId},
        ${input.agentName},
        ${input.providerId},
        ${input.model},
        ${input.inputTokens},
        ${input.outputTokens},
        ${input.totalTokens},
        ${input.source},
        ${input.correlationId},
        ${createdAt}
      )
      returning *
    `;
    return mapModelUsageEvent(row);
  }

  async summarizeModelUsageEvents(input: {
    clientInstanceId: ClientInstanceId;
    start?: string;
    end?: string;
  }): Promise<ModelUsageWindowSummary> {
    const [row] = await this.sql<
      Array<{
        model_call_count: number;
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
      }>
    >`
      select
        count(*)::int as model_call_count,
        coalesce(sum(input_tokens), 0)::int as input_tokens,
        coalesce(sum(output_tokens), 0)::int as output_tokens,
        coalesce(sum(total_tokens), 0)::int as total_tokens
      from model_usage_events
      where client_instance_id = ${input.clientInstanceId}
        and (${input.start ?? null}::timestamptz is null or created_at >= ${input.start ?? null})
        and (${input.end ?? null}::timestamptz is null or created_at < ${input.end ?? null})
    `;

    return {
      start: input.start,
      end: input.end,
      modelCallCount: row?.model_call_count ?? 0,
      inputTokens: row?.input_tokens ?? 0,
      outputTokens: row?.output_tokens ?? 0,
      totalTokens: row?.total_tokens ?? 0
    };
  }

  async listModelUsageEvents(input: {
    clientInstanceId: ClientInstanceId;
    start?: string;
    end?: string;
    limit?: number;
  }): Promise<ModelUsageEvent[]> {
    const rows =
      input.limit === undefined
        ? await this.sql<ModelUsageEventRow[]>`
            select * from model_usage_events
            where client_instance_id = ${input.clientInstanceId}
              and (${input.start ?? null}::timestamptz is null or created_at >= ${input.start ?? null})
              and (${input.end ?? null}::timestamptz is null or created_at < ${input.end ?? null})
            order by created_at desc
          `
        : await this.sql<ModelUsageEventRow[]>`
            select * from model_usage_events
            where client_instance_id = ${input.clientInstanceId}
              and (${input.start ?? null}::timestamptz is null or created_at >= ${input.start ?? null})
              and (${input.end ?? null}::timestamptz is null or created_at < ${input.end ?? null})
            order by created_at desc
            limit ${input.limit}
          `;
    return rows.map(mapModelUsageEvent);
  }
}
