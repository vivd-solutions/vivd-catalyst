import cors from "@fastify/cors";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { z } from "zod";
import {
  createConversationRequestSchema,
  issueSessionTokenRequestSchema,
  sendMessageRequestSchema
} from "@agent-chat-platform/api-client";
import { auditActorFromUser, type AuditRecorder } from "@agent-chat-platform/audit";
import type { AuthAdapter, HmacSessionTokenIssuer } from "@agent-chat-platform/auth";
import {
  AppError,
  type AgentRuntime,
  type AuditEventStore,
  type AuthenticatedUser,
  type ChatMessage,
  type ClientInstanceId,
  type Conversation,
  type ConversationId,
  type ConversationStore,
  type RuntimeCallContext,
  addDays,
  asConversationId,
  createPlatformId,
  isAppError
} from "@agent-chat-platform/chat-core";
import { createSafeConfigView, type ClientInstanceConfig } from "@agent-chat-platform/config-schema";

export interface ChatServerOptions {
  config: ClientInstanceConfig;
  clientInstanceId: ClientInstanceId;
  authAdapter: AuthAdapter;
  conversationStore: ConversationStore;
  auditEventStore: AuditEventStore;
  auditRecorder: AuditRecorder;
  agentRuntime: AgentRuntime;
  corsOrigin?: string | string[];
  sessionToken?: {
    issuer: HmacSessionTokenIssuer;
    serverCredential: string;
  };
}

export async function createChatServer(options: ChatServerOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true
  });

  await app.register(cors, {
    origin: options.corsOrigin ?? true
  });

  app.setErrorHandler((error, _request, reply) => {
    if (isAppError(error)) {
      void reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      });
      return;
    }

    app.log.error(error);
    void reply.status(500).send({
      error: {
        code: "INTERNAL",
        message: "Internal server error"
      }
    });
  });

  app.get("/health", async () => ({
    status: "ok",
    clientInstanceId: options.clientInstanceId,
    time: new Date().toISOString()
  }));

  app.post("/auth/session-token", async (request) => {
    if (!options.sessionToken) {
      throw new AppError("NOT_FOUND", "Session token issuing is not configured");
    }
    const credential = request.headers["x-server-credential"];
    if (credential !== options.sessionToken.serverCredential) {
      throw new AppError("FORBIDDEN", "Invalid server credential");
    }
    const body = parseBody(issueSessionTokenRequestSchema, request.body);
    const issued = options.sessionToken.issuer.issue(body);
    await options.auditRecorder.record({
      type: "auth.session_token_issued",
      status: "success",
      subject: body.externalUserId,
      correlationId: body.correlationId ?? createCorrelationId(request),
      metadata: {
        roles: body.roles ?? [],
        permissionRefs: body.permissionRefs ?? []
      }
    });
    return issued;
  });

  app.get("/api/me", async (request) => {
    const { user } = await authenticate(options, request);
    return user;
  });

  app.get("/api/config", async (request) => {
    await authenticate(options, request);
    return createSafeConfigView(options.config);
  });

  app.get("/api/conversations", async (request) => {
    const { user } = await authenticate(options, request);
    return options.conversationStore.listConversationsForUser({
      clientInstanceId: options.clientInstanceId,
      ownerExternalUserId: user.externalUserId
    });
  });

  app.post("/api/conversations", async (request) => {
    const { user, context } = await authenticate(options, request);
    const body = parseBody(createConversationRequestSchema, request.body);
    const conversation = await options.conversationStore.createConversation({
      clientInstanceId: options.clientInstanceId,
      ownerUserId: user.id,
      ownerExternalUserId: user.externalUserId,
      title: body.title ?? "New conversation",
      retainedUntil: addDays(new Date(), options.config.retention.conversationDays).toISOString()
    });

    await options.auditRecorder.record({
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
  });

  app.get("/api/conversations/:conversationId/messages", async (request) => {
    const { user } = await authenticate(options, request);
    const conversationId = getConversationId(request);
    await assertConversationOwner(options, conversationId, user);
    return options.conversationStore.listMessages({
      clientInstanceId: options.clientInstanceId,
      conversationId
    });
  });

  app.post("/api/conversations/:conversationId/messages", async (request) => {
    const { user, context } = await authenticate(options, request);
    const conversationId = getConversationId(request);
    await assertConversationOwner(options, conversationId, user);
    const body = parseBody(sendMessageRequestSchema, request.body);
    const userMessage = await options.conversationStore.appendMessage({
      clientInstanceId: options.clientInstanceId,
      conversationId,
      role: "user",
      text: body.text
    });

    await options.auditRecorder.record({
      type: "message.created",
      status: "success",
      actor: auditActorFromUser(user),
      subject: userMessage.id,
      correlationId: context.correlationId,
      metadata: {
        conversationId
      }
    });

    const run = await options.agentRuntime.start(
      {
        agentName: body.agentName ?? options.config.defaultAgentName,
        conversationId,
        message: {
          text: body.text
        }
      },
      context
    );

    const assistantMessages: ChatMessage[] = [];
    const events = [];
    for await (const event of options.agentRuntime.observe(run.runId, context)) {
      events.push(event);
      if (event.type === "message_completed") {
        assistantMessages.push(
          await options.conversationStore.appendMessage({
            clientInstanceId: options.clientInstanceId,
            conversationId,
            role: "assistant",
            text: event.message.text,
            metadata: event.message.domainUi ? { domainUi: event.message.domainUi } : undefined
          })
        );
      }
    }

    await options.auditRecorder.record({
      type: "message.completed",
      status: "success",
      actor: auditActorFromUser(user),
      subject: conversationId,
      correlationId: context.correlationId,
      metadata: {
        assistantMessageCount: assistantMessages.length,
        runId: run.runId
      }
    });

    return {
      userMessage,
      assistantMessages,
      events
    };
  });

  app.delete("/api/conversations/:conversationId", async (request) => {
    const { user, context } = await authenticate(options, request);
    if (!options.config.retention.allowUserDelete) {
      throw new AppError("FORBIDDEN", "User conversation deletion is disabled for this client instance");
    }
    const conversationId = getConversationId(request);
    await assertConversationOwner(options, conversationId, user);
    const deleted = await options.conversationStore.deleteConversation({
      clientInstanceId: options.clientInstanceId,
      conversationId,
      deletedAt: new Date().toISOString()
    });
    await options.auditRecorder.record({
      type: "conversation.deleted",
      status: "success",
      actor: auditActorFromUser(user),
      subject: deleted.id,
      correlationId: context.correlationId
    });
    return deleted;
  });

  app.get("/api/audit-events", async (request) => {
    const { user } = await authenticate(options, request);
    if (!user.roles.includes("admin") && !user.roles.includes("superadmin")) {
      throw new AppError("FORBIDDEN", "Audit events require a governance role");
    }
    return options.auditEventStore.listAuditEvents({
      clientInstanceId: options.clientInstanceId,
      limit: 100
    });
  });

  return app;
}

async function authenticate(
  options: ChatServerOptions,
  request: FastifyRequest
): Promise<{ user: AuthenticatedUser; context: RuntimeCallContext }> {
  const correlationId = createCorrelationId(request);
  const user = await options.authAdapter.authenticate({
    headers: request.headers,
    clientInstanceId: options.clientInstanceId,
    correlationId
  });

  await options.auditRecorder.record({
    type: "auth.authenticated",
    status: "success",
    actor: auditActorFromUser(user),
    correlationId,
    metadata: {
      authSource: user.authSource
    }
  });

  return {
    user,
    context: {
      user,
      clientInstanceId: options.clientInstanceId,
      correlationId
    }
  };
}

async function assertConversationOwner(
  options: ChatServerOptions,
  conversationId: ConversationId,
  user: AuthenticatedUser
): Promise<Conversation> {
  const conversation = await options.conversationStore.getConversation(
    options.clientInstanceId,
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

function getConversationId(request: FastifyRequest): ConversationId {
  const params = request.params as { conversationId?: string };
  if (!params.conversationId) {
    throw new AppError("BAD_REQUEST", "Missing conversation id");
  }
  return asConversationId(params.conversationId);
}

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new AppError("VALIDATION_FAILED", "Request body is invalid", {
      issues: parsed.error.issues
    });
  }
  return parsed.data;
}

function createCorrelationId(request: FastifyRequest): string {
  const existing = request.headers["x-correlation-id"];
  if (typeof existing === "string" && existing.length > 0) {
    return existing;
  }
  return createPlatformId("corr");
}
