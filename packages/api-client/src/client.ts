import { z } from "zod";
import { ApiError } from "./errors";
import {
  apiUserSchema,
  auditEventSchema,
  conversationSchema,
  createConversationRequestSchema,
  messageSchema,
  safeConfigSchema,
  usageSummarySchema
} from "./schemas";

export interface ApiClientOptions {
  baseUrl: string;
  getToken?: () => string | undefined | Promise<string | undefined>;
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
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      credentials: "include",
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(token ? { authorization: `Bearer ${token}` } : {})
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
    me: () => request("GET", "/api/me", apiUserSchema),
    config: () => request("GET", "/api/config", safeConfigSchema),
    conversations: () => request("GET", "/api/conversations", z.array(conversationSchema)),
    createConversation: (input: z.infer<typeof createConversationRequestSchema> = {}) =>
      request("POST", "/api/conversations", conversationSchema, createConversationRequestSchema.parse(input)),
    messages: (conversationId: string) =>
      request("GET", `/api/conversations/${encodeURIComponent(conversationId)}/messages`, z.array(messageSchema)),
    deleteConversation: (conversationId: string) =>
      request("DELETE", `/api/conversations/${encodeURIComponent(conversationId)}`, conversationSchema),
    auditEvents: () => request("GET", "/api/audit-events", z.array(auditEventSchema)),
    usageSummary: () => request("GET", "/api/superadmin/usage", usageSummarySchema)
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
