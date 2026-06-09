import type { FastifyRequest } from "fastify";
import { z } from "zod";
import {
  AppError,
  type AuthenticatedUser,
  type ConversationId,
  type RuntimeCallContext,
  asConversationId,
  createPlatformId
} from "@agent-chat-platform/chat-core";
import type { ChatServerOptions } from "./types";

export async function authenticateRequest(
  options: ChatServerOptions,
  request: FastifyRequest
): Promise<{ user: AuthenticatedUser; context: RuntimeCallContext }> {
  const correlationId = createCorrelationId(request);
  const user = await options.authAdapter.authenticate({
    headers: request.headers,
    clientInstanceId: options.clientInstanceId,
    correlationId
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

export function getConversationId(request: FastifyRequest): ConversationId {
  const params = request.params as { conversationId?: string };
  if (!params.conversationId) {
    throw new AppError("BAD_REQUEST", "Missing conversation id");
  }
  return asConversationId(params.conversationId);
}

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new AppError("VALIDATION_FAILED", "Request body is invalid", {
      issues: parsed.error.issues
    });
  }
  return parsed.data;
}

export function createCorrelationId(request: FastifyRequest): string {
  const existing = request.headers["x-correlation-id"];
  if (typeof existing === "string" && existing.length > 0) {
    return existing;
  }
  return createPlatformId("corr");
}
