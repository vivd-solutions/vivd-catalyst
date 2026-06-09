import postgres from "postgres";
import type { Sql } from "postgres";
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
  asConversationId,
  asMessageId,
  createPlatformId
} from "@agent-chat-platform/chat-core";

export interface PostgresPlatformStoreOptions {
  databaseUrl: string;
  runMigrations?: boolean;
}

export class PostgresPlatformStore implements ConversationStore, AuditEventStore {
  private readonly sql: Sql;

  constructor(sql: Sql) {
    this.sql = sql;
  }

  static async connect(options: PostgresPlatformStoreOptions): Promise<PostgresPlatformStore> {
    const sql = postgres(options.databaseUrl, {
      max: 10,
      idle_timeout: 30
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
    await this.sql`
      create table if not exists conversations (
        id text primary key,
        client_instance_id text not null,
        owner_user_id text not null,
        owner_external_user_id text not null,
        title text not null,
        status text not null,
        created_at timestamptz not null,
        updated_at timestamptz not null,
        retained_until timestamptz not null,
        deleted_at timestamptz
      )
    `;
    await this.sql`
      create index if not exists conversations_owner_idx
      on conversations (client_instance_id, owner_external_user_id, updated_at desc)
    `;
    await this.sql`
      create table if not exists messages (
        id text primary key,
        client_instance_id text not null,
        conversation_id text not null references conversations(id) on delete cascade,
        role text not null,
        text text not null,
        created_at timestamptz not null,
        metadata jsonb not null default '{}'::jsonb
      )
    `;
    await this.sql`
      create index if not exists messages_conversation_idx
      on messages (client_instance_id, conversation_id, created_at asc)
    `;
    await this.sql`
      create table if not exists audit_events (
        id text primary key,
        client_instance_id text not null,
        type text not null,
        status text not null,
        actor jsonb,
        subject text,
        reason text,
        correlation_id text not null,
        created_at timestamptz not null,
        metadata jsonb not null default '{}'::jsonb
      )
    `;
    await this.sql`
      create index if not exists audit_events_client_created_idx
      on audit_events (client_instance_id, created_at desc)
    `;
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
}

interface ConversationRow {
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

interface MessageRow {
  id: string;
  client_instance_id: string;
  conversation_id: string;
  role: ChatMessage["role"];
  text: string;
  created_at: Date;
  metadata: ChatMessage["metadata"];
}

interface AuditEventRow {
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

function mapConversation(row: ConversationRow | undefined): Conversation {
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

function mapMessage(row: MessageRow | undefined): ChatMessage {
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

function mapAuditEvent(row: AuditEventRow | undefined): AuditEvent {
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
