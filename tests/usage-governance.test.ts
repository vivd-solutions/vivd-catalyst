import { describe, expect, it } from "vitest";
import {
  asAgentRunId,
  asClientInstanceId,
  asConversationId
} from "@agent-chat-platform/chat-core";
import { InMemoryPlatformStore } from "@agent-chat-platform/memory-store";
import { ModelUsageGovernance } from "@agent-chat-platform/usage-governance";

describe("model usage governance", () => {
  it("serializes model calls so daily call limits cannot be raced in one process", async () => {
    const clientInstanceId = asClientInstanceId("client-usage-test");
    const store = new InMemoryPlatformStore();
    const governance = new ModelUsageGovernance({
      store,
      limits: {
        modelCallsPerDay: 1
      }
    });

    const attempts = await Promise.allSettled([
      governance.runModelCall(clientInstanceId, async () => {
        await governance.appendModelUsageEvent({
          clientInstanceId,
          conversationId: asConversationId("conv_1"),
          agentRunId: asAgentRunId("run_1"),
          agentName: "agent",
          providerId: "provider",
          model: "model",
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
          source: "provider_reported",
          correlationId: "corr_1"
        });
        return "first";
      }),
      governance.runModelCall(clientInstanceId, async () => {
        await governance.appendModelUsageEvent({
          clientInstanceId,
          conversationId: asConversationId("conv_2"),
          agentRunId: asAgentRunId("run_2"),
          agentName: "agent",
          providerId: "provider",
          model: "model",
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
          source: "provider_reported",
          correlationId: "corr_2"
        });
        return "second";
      })
    ]);

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
    await expect(
      governance.runModelCall(clientInstanceId, async () => "third")
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Daily model call usage limit has been reached"
    });
    await expect(governance.createSummary({ clientInstanceId })).resolves.toMatchObject({
      today: {
        modelCallCount: 1,
        totalTokens: 2
      }
    });
  });

  it("derives model costs from configured provider and model pricing", async () => {
    const clientInstanceId = asClientInstanceId("client-cost-test");
    const store = new InMemoryPlatformStore();
    const governance = new ModelUsageGovernance({
      store,
      limits: {},
      pricing: {
        currency: "USD",
        models: [
          {
            providerId: "openai",
            model: "gpt-4.1",
            inputPricePerMillionTokens: 2,
            outputPricePerMillionTokens: 8
          }
        ]
      }
    });

    await governance.appendModelUsageEvent({
      clientInstanceId,
      conversationId: asConversationId("conv_cost"),
      agentRunId: asAgentRunId("run_cost"),
      agentName: "agent",
      providerId: "openai",
      model: "gpt-4.1",
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      source: "provider_reported",
      correlationId: "corr_cost"
    });

    const summary = await governance.createSummary({ clientInstanceId });

    expect(summary.today.cost).toMatchObject({
      currency: "USD",
      inputCostMicros: 2000,
      outputCostMicros: 4000,
      totalCostMicros: 6000,
      pricingConfigured: true,
      pricedModelCallCount: 1,
      unpricedModelCallCount: 0
    });
    expect(summary.recentEvents[0]?.cost).toMatchObject({
      totalCostMicros: 6000,
      pricingConfigured: true
    });
  });
});
