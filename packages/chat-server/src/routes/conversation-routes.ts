import type { FastifyInstance } from "fastify";
import {
  createConversationRequestSchema,
  sendMessageRequestSchema
} from "@agent-chat-platform/api-contract";
import { ConversationWorkflow } from "../conversation-workflow";
import type { ChatServerOptions } from "../types";
import { authenticateRequest, getConversationId, parseBody } from "../request-context";

export function registerConversationRoutes(app: FastifyInstance, options: ChatServerOptions): void {
  const conversations = new ConversationWorkflow(options);

  app.get("/api/conversations", async (request) => {
    const { user } = await authenticateRequest(options, request);
    return conversations.listConversations(user);
  });

  app.post("/api/conversations", async (request) => {
    const { user, context } = await authenticateRequest(options, request);
    const body = parseBody(createConversationRequestSchema, request.body);
    return conversations.createConversation(user, context, body);
  });

  app.get("/api/conversations/:conversationId/messages", async (request) => {
    const { user } = await authenticateRequest(options, request);
    return conversations.listMessages(getConversationId(request), user);
  });

  app.post("/api/conversations/:conversationId/messages", async (request) => {
    const { user, context } = await authenticateRequest(options, request);
    const body = parseBody(sendMessageRequestSchema, request.body);
    return conversations.sendMessage(getConversationId(request), user, context, body);
  });

  app.delete("/api/conversations/:conversationId", async (request) => {
    const { user, context } = await authenticateRequest(options, request);
    return conversations.deleteConversation(getConversationId(request), user, context);
  });
}
