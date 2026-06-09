import { auditActorFromUser } from "@agent-chat-platform/audit";
import {
  AppError,
  type AppErrorCode,
  type AgentRunId,
  type AgentRuntimeEvent,
  type AuthenticatedUser,
  type ChatMessage,
  type Conversation,
  type ConversationId,
  type RuntimeCallContext,
  addDays
} from "@agent-chat-platform/chat-core";
import type { ChatServerOptions } from "./types";

export interface CreateConversationCommand {
  title?: string;
}

export interface SendConversationMessageCommand {
  agentName?: string;
  text: string;
}

export interface SendConversationMessageResult {
  userMessage: ChatMessage;
  assistantMessages: ChatMessage[];
  events: AgentRuntimeEvent[];
}

export interface StartedConversationMessageRun {
  userMessage: ChatMessage;
  runId: AgentRunId;
}

export class ConversationWorkflow {
  private readonly options: ChatServerOptions;

  constructor(options: ChatServerOptions) {
    this.options = options;
  }

  async listConversations(user: AuthenticatedUser): Promise<Conversation[]> {
    return this.options.conversationStore.listConversationsForUser({
      clientInstanceId: this.options.clientInstanceId,
      ownerExternalUserId: user.externalUserId
    });
  }

  async createConversation(
    user: AuthenticatedUser,
    context: RuntimeCallContext,
    command: CreateConversationCommand
  ): Promise<Conversation> {
    const conversation = await this.options.conversationStore.createConversation({
      clientInstanceId: this.options.clientInstanceId,
      ownerUserId: user.id,
      ownerExternalUserId: user.externalUserId,
      title: command.title ?? "New conversation",
      retainedUntil: addDays(new Date(), this.options.config.retention.conversationDays).toISOString()
    });

    await this.options.auditRecorder.record({
      type: "conversation.created",
      status: "success",
      actor: auditActorFromUser(user),
      subject: conversation.id,
      correlationId: context.correlationId,
      metadata: {
        retainedUntil: conversation.retainedUntil
      }
    });
    return conversation;
  }

  async listMessages(
    conversationId: ConversationId,
    user: AuthenticatedUser
  ): Promise<ChatMessage[]> {
    await this.requireOwnedActiveConversation(conversationId, user);
    return this.options.conversationStore.listMessages({
      clientInstanceId: this.options.clientInstanceId,
      conversationId
    });
  }

  async sendMessage(
    conversationId: ConversationId,
    user: AuthenticatedUser,
    context: RuntimeCallContext,
    command: SendConversationMessageCommand
  ): Promise<SendConversationMessageResult> {
    const { userMessage, runId } = await this.startMessageRun(conversationId, user, context, command);
    const result = await this.collectAgentRun(conversationId, runId, context);
    if (result.runFailure) {
      await this.recordRunFailed(conversationId, user, context, runId, result.assistantMessages.length, result.runFailure);
      throw appErrorFromRunFailure(result.runFailure);
    }

    await this.recordRunCompleted(conversationId, user, context, runId, result.assistantMessages.length);

    return {
      userMessage,
      assistantMessages: result.assistantMessages,
      events: result.events
    };
  }

  async startMessageRun(
    conversationId: ConversationId,
    user: AuthenticatedUser,
    context: RuntimeCallContext,
    command: SendConversationMessageCommand
  ): Promise<StartedConversationMessageRun> {
    await this.requireOwnedActiveConversation(conversationId, user);
    const userMessage = await this.options.conversationStore.appendMessage({
      clientInstanceId: this.options.clientInstanceId,
      conversationId,
      role: "user",
      text: command.text
    });

    await this.options.auditRecorder.record({
      type: "message.created",
      status: "success",
      actor: auditActorFromUser(user),
      subject: userMessage.id,
      correlationId: context.correlationId,
      metadata: {
        conversationId
      }
    });

    const run = await this.options.agentRuntime.start(
      {
        agentName: command.agentName ?? this.options.config.defaultAgentName,
        conversationId,
        message: {
          text: command.text
        }
      },
      context
    );

    return {
      userMessage,
      runId: run.runId
    };
  }

  observeRun(runId: AgentRunId, context: RuntimeCallContext): AsyncIterable<AgentRuntimeEvent> {
    return this.options.agentRuntime.observe(runId, context);
  }

  async persistAssistantMessage(
    conversationId: ConversationId,
    event: Extract<AgentRuntimeEvent, { type: "message_completed" }>
  ): Promise<ChatMessage> {
    return this.options.conversationStore.appendMessage({
      clientInstanceId: this.options.clientInstanceId,
      conversationId,
      role: "assistant",
      text: event.message.text,
      metadata: event.message.domainUi ? { domainUi: event.message.domainUi } : undefined
    });
  }

  async recordRunCompleted(
    conversationId: ConversationId,
    user: AuthenticatedUser,
    context: RuntimeCallContext,
    runId: AgentRunId,
    assistantMessageCount: number
  ): Promise<void> {
    await this.options.auditRecorder.record({
      type: "message.completed",
      status: "success",
      actor: auditActorFromUser(user),
      subject: conversationId,
      correlationId: context.correlationId,
      metadata: {
        assistantMessageCount,
        runId
      }
    });
  }

  async recordRunFailed(
    conversationId: ConversationId,
    user: AuthenticatedUser,
    context: RuntimeCallContext,
    runId: AgentRunId,
    assistantMessageCount: number,
    event: Extract<AgentRuntimeEvent, { type: "run_failed" }>
  ): Promise<void> {
    await this.options.auditRecorder.record({
      type: "message.failed",
      status: "failed",
      actor: auditActorFromUser(user),
      subject: conversationId,
      correlationId: context.correlationId,
      metadata: {
        assistantMessageCount,
        errorCode: event.error.code,
        runId
      }
    });
  }

  async deleteConversation(
    conversationId: ConversationId,
    user: AuthenticatedUser,
    context: RuntimeCallContext
  ): Promise<Conversation> {
    if (!this.options.config.retention.allowUserDelete) {
      throw new AppError("FORBIDDEN", "User conversation deletion is disabled for this client instance");
    }
    await this.requireOwnedActiveConversation(conversationId, user);
    const deleted = await this.options.conversationStore.deleteConversation({
      clientInstanceId: this.options.clientInstanceId,
      conversationId,
      deletedAt: new Date().toISOString()
    });
    await this.options.auditRecorder.record({
      type: "conversation.deleted",
      status: "success",
      actor: auditActorFromUser(user),
      subject: deleted.id,
      correlationId: context.correlationId
    });
    return deleted;
  }

  private async requireOwnedActiveConversation(
    conversationId: ConversationId,
    user: AuthenticatedUser
  ): Promise<Conversation> {
    const conversation = await this.options.conversationStore.getConversation(
      this.options.clientInstanceId,
      conversationId
    );
    if (!conversation || conversation.status !== "active") {
      throw new AppError("NOT_FOUND", "Conversation is not available");
    }
    if (conversation.ownerExternalUserId !== user.externalUserId) {
      throw new AppError("FORBIDDEN", "Conversation belongs to another user");
    }
    return conversation;
  }

  private async collectAgentRun(
    conversationId: ConversationId,
    runId: AgentRunId,
    context: RuntimeCallContext
  ): Promise<{
    assistantMessages: ChatMessage[];
    events: AgentRuntimeEvent[];
    runFailure?: Extract<AgentRuntimeEvent, { type: "run_failed" }>;
  }> {
    const assistantMessages: ChatMessage[] = [];
    const events: AgentRuntimeEvent[] = [];
    let runFailure: Extract<AgentRuntimeEvent, { type: "run_failed" }> | undefined;

    for await (const event of this.options.agentRuntime.observe(runId, context)) {
      events.push(event);
      if (event.type === "run_failed") {
        runFailure = event;
      }
      if (event.type === "message_completed") {
        assistantMessages.push(await this.persistAssistantMessage(conversationId, event));
      }
    }

    return {
      assistantMessages,
      events,
      runFailure
    };
  }
}

const appErrorCodes = new Set<AppErrorCode>([
  "BAD_REQUEST",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "TIMEOUT",
  "VALIDATION_FAILED",
  "INTERNAL"
]);

function appErrorFromRunFailure(
  event: Extract<AgentRuntimeEvent, { type: "run_failed" }>
): AppError {
  const code = appErrorCodes.has(event.error.code as AppErrorCode)
    ? (event.error.code as AppErrorCode)
    : "INTERNAL";
  return new AppError(code, event.error.message);
}
