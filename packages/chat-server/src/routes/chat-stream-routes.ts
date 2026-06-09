import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  AppError,
  type AgentRunId,
  type ChatMessage,
  asConversationId
} from "@agent-chat-platform/chat-core";
import { ConversationWorkflow } from "../conversation-workflow";
import { createConversationTitle } from "../conversation-title";
import { authenticateRequest, parseBody } from "../request-context";
import type { ChatServerOptions } from "../types";
import { sendWebResponse } from "./better-auth-routes";

const uiMessagePartSchema = z
  .object({
    type: z.string(),
    text: z.string().optional()
  })
  .passthrough();

const uiMessageSchema = z
  .object({
    id: z.string(),
    role: z.enum(["system", "user", "assistant"]),
    parts: z.array(uiMessagePartSchema)
  })
  .passthrough();

const chatStreamRequestSchema = z
  .object({
    conversationId: z.string().min(1).optional(),
    agentName: z.string().min(1).optional(),
    messages: z.array(uiMessageSchema).min(1)
  })
  .passthrough();

export function registerChatStreamRoutes(app: FastifyInstance, options: ChatServerOptions): void {
  const conversations = new ConversationWorkflow(options);

  app.post("/api/chat", async (request, reply) => {
    const { user, context } = await authenticateRequest(options, request);
    const body = parseBody(chatStreamRequestSchema, request.body);
    const text = extractSubmittedUserText(body.messages);
    const conversation =
      body.conversationId === undefined
        ? await conversations.createConversation(user, context, {
            title: createConversationTitle(text)
          })
        : undefined;
    const conversationId = asConversationId(body.conversationId ?? conversation?.id ?? "");
    if (!conversationId) {
      throw new AppError("BAD_REQUEST", "Missing conversation id");
    }

    const { runId } = await conversations.startMessageRun(conversationId, user, context, {
      agentName: body.agentName,
      text
    });
    const responseMessageId = runId;
    const stream = createUIMessageStream<UIMessage>({
      execute: async ({ writer }) => {
        const textPartId = `${responseMessageId}:text`;
        let assistantMessageCount = 0;

        writer.write({
          type: "start",
          messageId: responseMessageId,
          messageMetadata: {
            conversationId,
            runId
          }
        });
        writer.write({
          type: "start-step"
        });
        writer.write({
          type: "text-start",
          id: textPartId
        });

        for await (const event of conversations.observeRun(runId, context)) {
          if (event.type === "message_delta") {
            writer.write({
              type: "text-delta",
              id: textPartId,
              delta: event.delta
            });
          }

          if (event.type === "message_completed") {
            const assistantMessage = await conversations.persistAssistantMessage(conversationId, event);
            assistantMessageCount += 1;
            writer.write({
              type: "message-metadata",
              messageMetadata: toAssistantMessageMetadata(conversationId, runId, assistantMessage)
            });
          }

          if (event.type === "run_failed") {
            await conversations.recordRunFailed(
              conversationId,
              user,
              context,
              runId,
              assistantMessageCount,
              event
            );
            writer.write({
              type: "error",
              errorText: event.error.message
            });
            return;
          }

          if (event.type === "run_completed") {
            await conversations.recordRunCompleted(
              conversationId,
              user,
              context,
              runId,
              assistantMessageCount
            );
          }
        }

        writer.write({
          type: "text-end",
          id: textPartId
        });
        writer.write({
          type: "finish-step"
        });
        writer.write({
          type: "finish",
          finishReason: "stop",
          messageMetadata: {
            conversationId,
            runId
          }
        });
      },
      onError(error) {
        return error instanceof Error ? error.message : "Message failed";
      }
    });

    await sendWebResponse(
      reply,
      createUIMessageStreamResponse({
        stream,
        headers: {
          "cache-control": "no-store"
        }
      })
    );
  });
}

function extractSubmittedUserText(messages: z.infer<typeof chatStreamRequestSchema>["messages"]): string {
  const userMessage = messages.findLast((message) => message.role === "user");
  const text =
    userMessage?.parts
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("\n")
      .trim() ?? "";
  if (!text) {
    throw new AppError("VALIDATION_FAILED", "A user text message is required");
  }
  return text;
}

function toAssistantMessageMetadata(
  conversationId: string,
  runId: AgentRunId,
  message: ChatMessage
): Record<string, unknown> {
  return {
    conversationId,
    runId,
    persistedMessageId: message.id,
    createdAt: message.createdAt
  };
}
