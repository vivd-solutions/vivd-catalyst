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
} from "./index";

export class InMemoryPlatformStore implements ConversationStore, AuditEventStore, ModelUsageEventStore {
  private readonly conversations = new Map<string, Conversation>();
  private readonly messages = new Map<string, ChatMessage[]>();
  private readonly auditEvents: AuditEvent[] = [];
  private readonly modelUsageEvents: ModelUsageEvent[] = [];

  async createConversation(input: CreateConversationInput): Promise<Conversation> {
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id: createPlatformId("conv"),
      clientInstanceId: input.clientInstanceId,
      ownerUserId: input.ownerUserId,
      ownerExternalUserId: input.ownerExternalUserId,
      title: input.title,
      status: "active",
      createdAt: now,
      updatedAt: now,
      retainedUntil: input.retainedUntil
    };
    this.conversations.set(conversation.id, conversation);
    this.messages.set(conversation.id, []);
    return conversation;
  }

  async getConversation(
    clientInstanceId: ClientInstanceId,
    conversationId: ConversationId
  ): Promise<Conversation | undefined> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation || conversation.clientInstanceId !== clientInstanceId) {
      return undefined;
    }
    return conversation;
  }

  async listConversationsForUser(input: {
    clientInstanceId: ClientInstanceId;
    ownerExternalUserId: string;
  }): Promise<Conversation[]> {
    return [...this.conversations.values()]
      .filter(
        (conversation) =>
          conversation.clientInstanceId === input.clientInstanceId &&
          conversation.ownerExternalUserId === input.ownerExternalUserId &&
          conversation.status === "active"
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async appendMessage(input: CreateMessageInput): Promise<ChatMessage> {
    const conversation = await this.getConversation(input.clientInstanceId, input.conversationId);
    if (!conversation || conversation.status !== "active") {
      throw new AppError("NOT_FOUND", "Conversation is not available");
    }

    const message: ChatMessage = {
      id: createPlatformId("msg"),
      clientInstanceId: input.clientInstanceId,
      conversationId: input.conversationId,
      role: input.role,
      text: input.text,
      createdAt: new Date().toISOString(),
      metadata: input.metadata
    };
    const messages = this.messages.get(input.conversationId) ?? [];
    messages.push(message);
    this.messages.set(input.conversationId, messages);
    this.conversations.set(input.conversationId, {
      ...conversation,
      updatedAt: message.createdAt
    });
    return message;
  }

  async listMessages(input: {
    clientInstanceId: ClientInstanceId;
    conversationId: ConversationId;
  }): Promise<ChatMessage[]> {
    const conversation = await this.getConversation(input.clientInstanceId, input.conversationId);
    if (!conversation || conversation.status !== "active") {
      throw new AppError("NOT_FOUND", "Conversation is not available");
    }
    return [...(this.messages.get(input.conversationId) ?? [])].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
    );
  }

  async listRecentMessages(input: {
    clientInstanceId: ClientInstanceId;
    conversationId: ConversationId;
    limit: number;
  }): Promise<ChatMessage[]> {
    const messages = await this.listMessages(input);
    return messages.slice(-input.limit);
  }

  async deleteConversation(input: {
    clientInstanceId: ClientInstanceId;
    conversationId: ConversationId;
    deletedAt: string;
  }): Promise<Conversation> {
    const conversation = await this.getConversation(input.clientInstanceId, input.conversationId);
    if (!conversation) {
      throw new AppError("NOT_FOUND", "Conversation is not available");
    }

    const deleted: Conversation = {
      ...conversation,
      status: "deleted",
      deletedAt: input.deletedAt,
      updatedAt: input.deletedAt
    };
    this.conversations.set(input.conversationId, deleted);
    this.messages.set(input.conversationId, []);
    return deleted;
  }

  async appendAuditEvent(input: AuditEventInput): Promise<AuditEvent> {
    const event: AuditEvent = {
      ...input,
      id: createPlatformId("audit"),
      createdAt: new Date().toISOString()
    };
    this.auditEvents.push(event);
    return event;
  }

  async listAuditEvents(input: {
    clientInstanceId: ClientInstanceId;
    limit?: number;
    type?: string;
  }): Promise<AuditEvent[]> {
    const limit = input.limit ?? 100;
    return this.auditEvents
      .filter(
        (event) =>
          event.clientInstanceId === input.clientInstanceId &&
          (!input.type || event.type === input.type)
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }

  async appendModelUsageEvent(input: ModelUsageEventInput): Promise<ModelUsageEvent> {
    const event: ModelUsageEvent = {
      ...input,
      id: createPlatformId("usage"),
      createdAt: new Date().toISOString()
    };
    this.modelUsageEvents.push(event);
    return event;
  }

  async summarizeModelUsageEvents(input: {
    clientInstanceId: ClientInstanceId;
    start?: string;
    end?: string;
  }): Promise<ModelUsageWindowSummary> {
    const events = this.modelUsageEvents.filter(
      (event) =>
        event.clientInstanceId === input.clientInstanceId &&
        (!input.start || event.createdAt >= input.start) &&
        (!input.end || event.createdAt < input.end)
    );
    return summarizeEvents(events, input.start, input.end);
  }

  async listModelUsageEvents(input: {
    clientInstanceId: ClientInstanceId;
    start?: string;
    end?: string;
    limit?: number;
  }): Promise<ModelUsageEvent[]> {
    const events = this.modelUsageEvents
      .filter(
        (event) =>
          event.clientInstanceId === input.clientInstanceId &&
          (!input.start || event.createdAt >= input.start) &&
          (!input.end || event.createdAt < input.end)
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    return input.limit === undefined ? events : events.slice(0, input.limit);
  }
}

function summarizeEvents(
  events: ModelUsageEvent[],
  start: string | undefined,
  end: string | undefined
): ModelUsageWindowSummary {
  return events.reduce<ModelUsageWindowSummary>(
    (summary, event) => ({
      ...summary,
      modelCallCount: summary.modelCallCount + 1,
      inputTokens: summary.inputTokens + event.inputTokens,
      outputTokens: summary.outputTokens + event.outputTokens,
      totalTokens: summary.totalTokens + event.totalTokens
    }),
    {
      start,
      end,
      modelCallCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0
    }
  );
}
