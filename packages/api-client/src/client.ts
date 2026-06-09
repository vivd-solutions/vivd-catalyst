import { z } from "zod";
import { ApiError } from "./errors";
import {
  apiUserSchema,
  auditEventSchema,
  conversationSchema,
  createConversationRequestSchema,
  developmentUsersResponseSchema,
  messageSchema,
  safeConfigSchema,
  sendMessageRequestSchema,
  sendMessageResponseSchema,
  usageSummarySchema
} from "./schemas";

export interface ApiClientOptions {
  baseUrl: string;
  getToken?: () => string | undefined | Promise<string | undefined>;
  getDevelopmentUserId?: () => string | undefined | Promise<string | undefined>;
  fetchImpl?: typeof fetch;
}

export function createApiClient(options: ApiClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/$/u, "");

  async function request<T>(
    method: string,
    path: string,
    schema: z.ZodType<T>,
    body?: unknown
  ): Promise<T> {
    const token = await options.getToken?.();
    const developmentUserId = await options.getDevelopmentUserId?.();
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      credentials: "include",
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(developmentUserId ? { "x-dev-user-id": developmentUserId } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const payload = await response.json().catch(() => undefined);
    if (!response.ok) {
      throw new ApiError(response.status, payload?.error?.message ?? "API request failed", payload);
    }
    return schema.parse(payload);
  }

  return {
    developmentUsers: () =>
      request("GET", "/auth/development/users", developmentUsersResponseSchema),
    me: () => request("GET", "/api/me", apiUserSchema),
    config: () => request("GET", "/api/config", safeConfigSchema),
    conversations: () => request("GET", "/api/conversations", z.array(conversationSchema)),
    createConversation: (input: z.infer<typeof createConversationRequestSchema> = {}) =>
      request("POST", "/api/conversations", conversationSchema, createConversationRequestSchema.parse(input)),
    messages: (conversationId: string) =>
      request("GET", `/api/conversations/${encodeURIComponent(conversationId)}/messages`, z.array(messageSchema)),
    sendMessage: (conversationId: string, input: z.infer<typeof sendMessageRequestSchema>) =>
      request(
        "POST",
        `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
        sendMessageResponseSchema,
        sendMessageRequestSchema.parse(input)
      ),
    deleteConversation: (conversationId: string) =>
      request("DELETE", `/api/conversations/${encodeURIComponent(conversationId)}`, conversationSchema),
    auditEvents: () => request("GET", "/api/audit-events", z.array(auditEventSchema)),
    usageSummary: () => request("GET", "/api/superadmin/usage", usageSummarySchema)
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
