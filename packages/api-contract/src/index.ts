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
  usage: z.object({
    limits: z.object({
      modelCallsPerDay: z.number().optional(),
      tokensPerDay: z.number().optional(),
      tokensPerMonth: z.number().optional()
    })
  }),
  defaultAgentName: z.string(),
  agents: z.array(
    z.object({
      name: z.string(),
      displayName: z.string()
    })
  ),
  ui: z.object({
    clientName: z.string(),
    logoUrl: z.string().optional(),
    title: z.string(),
    welcomeMessage: z.string(),
    accentColor: z.string(),
    theme: z.object({
      accentColor: z.string(),
      accentStrongColor: z.string(),
      backgroundColor: z.string(),
      surfaceColor: z.string(),
      textColor: z.string(),
      mutedTextColor: z.string(),
      borderColor: z.string()
    })
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

export const developmentUserSchema = z.object({
  id: z.string(),
  externalUserId: z.string(),
  displayLabel: z.string(),
  email: z.string().optional(),
  roles: z.array(z.string()),
  permissionRefs: z.array(z.string()),
  authSource: z.string()
});

export const developmentUsersResponseSchema = z.object({
  defaultUserId: z.string(),
  users: z.array(developmentUserSchema)
});

export const sendMessageResponseSchema = z.object({
  userMessage: messageSchema,
  assistantMessages: z.array(messageSchema),
  events: z.array(z.unknown())
});

export const auditActorSchema = z.object({
  userId: z.string(),
  externalUserId: z.string(),
  displayLabel: z.string(),
  roles: z.array(z.string())
});

export const auditEventSchema = z.object({
  id: z.string(),
  clientInstanceId: z.string(),
  type: z.string(),
  status: z.string(),
  actor: auditActorSchema.optional(),
  subject: z.string().optional(),
  reason: z.string().optional(),
  correlationId: z.string(),
  createdAt: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const modelUsageCostSchema = z.object({
  currency: z.string(),
  inputCostMicros: z.number().int().nonnegative(),
  outputCostMicros: z.number().int().nonnegative(),
  totalCostMicros: z.number().int().nonnegative(),
  pricingConfigured: z.boolean()
});

export const modelUsageCostSummarySchema = modelUsageCostSchema.extend({
  pricedModelCallCount: z.number().int().nonnegative(),
  unpricedModelCallCount: z.number().int().nonnegative()
});

export const modelUsageEventSchema = z.object({
  id: z.string(),
  clientInstanceId: z.string(),
  conversationId: z.string(),
  agentRunId: z.string(),
  agentName: z.string(),
  providerId: z.string(),
  model: z.string(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  totalTokens: z.number(),
  source: z.enum(["provider_reported", "not_reported", "estimated"]),
  cost: modelUsageCostSchema,
  correlationId: z.string(),
  createdAt: z.string()
});

export const modelUsageWindowSummarySchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
  modelCallCount: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  totalTokens: z.number(),
  cost: modelUsageCostSummarySchema
});

export const usagePricingSchema = z.object({
  currency: z.string(),
  models: z.array(
    z.object({
      providerId: z.string(),
      model: z.string(),
      inputPricePerMillionTokens: z.number(),
      outputPricePerMillionTokens: z.number()
    })
  )
});

export const usageSummarySchema = z.object({
  generatedAt: z.string(),
  limits: safeConfigSchema.shape.usage.shape.limits,
  pricing: usagePricingSchema,
  today: modelUsageWindowSummarySchema,
  currentMonth: modelUsageWindowSummarySchema,
  allTime: modelUsageWindowSummarySchema,
  recentEvents: z.array(modelUsageEventSchema)
});

export type ApiUser = z.infer<typeof apiUserSchema>;
export type Conversation = z.infer<typeof conversationSchema>;
export type Message = z.infer<typeof messageSchema>;
export type SafeConfig = z.infer<typeof safeConfigSchema>;
export type DevelopmentUser = z.infer<typeof developmentUserSchema>;
export type DevelopmentUsersResponse = z.infer<typeof developmentUsersResponseSchema>;
export type SendMessageResponse = z.infer<typeof sendMessageResponseSchema>;
export type AuditActor = z.infer<typeof auditActorSchema>;
export type AuditEvent = z.infer<typeof auditEventSchema>;
export type ModelUsageEvent = z.infer<typeof modelUsageEventSchema>;
export type ModelUsageCost = z.infer<typeof modelUsageCostSchema>;
export type UsageSummary = z.infer<typeof usageSummarySchema>;
