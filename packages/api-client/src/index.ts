import { z } from "zod";

export const apiUserSchema = z.object({
  id: z.string(),
  externalUserId: z.string(),
  displayLabel: z.string(),
  email: z.string().optional(),
  roles: z.array(z.string()),
  permissionRefs: z.array(z.string()),
  clientInstanceId: z.string(),
  authSource: z.string()
});

export const conversationSchema = z.object({
  id: z.string(),
  clientInstanceId: z.string(),
  ownerUserId: z.string(),
  ownerExternalUserId: z.string(),
  title: z.string(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  retainedUntil: z.string(),
  deletedAt: z.string().optional()
});

export const messageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  clientInstanceId: z.string(),
  role: z.enum(["user", "assistant", "system", "tool"]),
  text: z.string(),
  createdAt: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const safeConfigSchema = z.object({
  clientInstance: z.object({
    id: z.string(),
    displayName: z.string(),
    environment: z.string()
  }),
  retention: z.object({
    conversationDays: z.number(),
    auditDays: z.number(),
    allowUserDelete: z.boolean()
  }),
  defaultAgentName: z.string(),
  agents: z.array(
    z.object({
      name: z.string(),
      displayName: z.string()
    })
  ),
  ui: z.object({
    title: z.string(),
    welcomeMessage: z.string(),
    accentColor: z.string()
  })
});

export const createConversationRequestSchema = z.object({
  title: z.string().min(1).optional()
});

export const sendMessageRequestSchema = z.object({
  agentName: z.string().min(1).optional(),
  text: z.string().min(1).max(20000)
});

export const issueSessionTokenRequestSchema = z.object({
  externalUserId: z.string().min(1),
  displayLabel: z.string().min(1),
  email: z.string().email().optional(),
  roles: z.array(z.string()).optional(),
  permissionRefs: z.array(z.string()).optional(),
  correlationId: z.string().optional()
});

export const issueSessionTokenResponseSchema = z.object({
  chatSessionToken: z.string(),
  expiresAt: z.string()
});

export const sendMessageResponseSchema = z.object({
  userMessage: messageSchema,
  assistantMessages: z.array(messageSchema),
  events: z.array(z.unknown())
});

export const auditEventSchema = z.object({
  id: z.string(),
  clientInstanceId: z.string(),
  type: z.string(),
  status: z.string(),
  actor: z.unknown().optional(),
  subject: z.string().optional(),
  reason: z.string().optional(),
  correlationId: z.string(),
  createdAt: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export type ApiUser = z.infer<typeof apiUserSchema>;
export type Conversation = z.infer<typeof conversationSchema>;
export type Message = z.infer<typeof messageSchema>;
export type SafeConfig = z.infer<typeof safeConfigSchema>;
export type SendMessageResponse = z.infer<typeof sendMessageResponseSchema>;
export type AuditEvent = z.infer<typeof auditEventSchema>;

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
      headers: {
        "content-type": "application/json",
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
    sendMessage: (conversationId: string, input: z.infer<typeof sendMessageRequestSchema>) =>
      request(
        "POST",
        `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
        sendMessageResponseSchema,
        sendMessageRequestSchema.parse(input)
      ),
    deleteConversation: (conversationId: string) =>
      request("DELETE", `/api/conversations/${encodeURIComponent(conversationId)}`, conversationSchema),
    auditEvents: () => request("GET", "/api/audit-events", z.array(auditEventSchema))
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

