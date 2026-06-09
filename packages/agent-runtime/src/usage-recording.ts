import {
  type AgentRunId,
  type ModelUsageEventStore,
  type RuntimeCallContext,
  type StartAgentRunInput
} from "@agent-chat-platform/chat-core";
import type { ModelCompletion } from "@agent-chat-platform/model-provider";
import type { ModelProviderConfig } from "@agent-chat-platform/config-schema";

export async function recordModelUsage(input: {
  usageStore: ModelUsageEventStore;
  runId: AgentRunId;
  startInput: StartAgentRunInput;
  context: RuntimeCallContext;
  provider: ModelProviderConfig;
  completion: ModelCompletion;
}): Promise<void> {
  await input.usageStore.appendModelUsageEvent({
    clientInstanceId: input.context.clientInstanceId,
    conversationId: input.startInput.conversationId,
    agentRunId: input.runId,
    agentName: input.startInput.agentName,
    providerId: input.provider.id,
    model: input.provider.model,
    correlationId: input.context.correlationId,
    ...input.completion.usage
  });
}
