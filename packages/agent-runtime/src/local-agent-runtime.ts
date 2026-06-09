import {
  AppError,
  type AgentRunHandle,
  type AgentRunId,
  type AgentRuntime,
  type AgentRuntimeCommand,
  type AgentRuntimeEvent,
  type RuntimeCallContext,
  type StartAgentRunInput,
  type ToolExecution,
  asAgentRunId,
  createPlatformId
} from "@agent-chat-platform/chat-core";
import {
  type ClientInstanceConfig,
  getAgentConfig,
  getModelProviderForAgent
} from "@agent-chat-platform/config-schema";
import type { ModelCompletion, ModelMessage, ModelProvider } from "@agent-chat-platform/model-provider";
import type { ToolRegistry } from "@agent-chat-platform/tool-execution";
import type { ModelUsageGovernance } from "@agent-chat-platform/usage-governance";
import { RunState } from "./run-state";
import { createSystemInstructions } from "./system-instructions";
import { executeToolCall } from "./tool-call-execution";
import { recordModelUsage } from "./usage-recording";

export interface LocalAgentRuntimeOptions {
  config: ClientInstanceConfig;
  modelProvider: ModelProvider;
  toolRegistry: ToolRegistry;
  toolExecution: ToolExecution;
  usageGovernance: ModelUsageGovernance;
}

export class LocalAgentRuntime implements AgentRuntime {
  private readonly options: LocalAgentRuntimeOptions;
  private readonly runs = new Map<AgentRunId, RunState>();

  constructor(options: LocalAgentRuntimeOptions) {
    this.options = options;
  }

  async start(
    input: StartAgentRunInput,
    context: RuntimeCallContext
  ): Promise<AgentRunHandle> {
    const runId = createPlatformId<"AgentRunId">("run");
    const state = new RunState(runId);
    this.runs.set(runId, state);

    queueMicrotask(() => {
      void this.executeRun(runId, input, context).catch((error) => {
        state.fail(error);
      });
    });

    return {
      runId,
      status: "running",
      startedAt: state.startedAt
    };
  }

  observe(runId: AgentRunId): AsyncIterable<AgentRuntimeEvent> {
    const state = this.getRun(runId);
    return state.observe();
  }

  async resume(
    runId: AgentRunId,
    _command: AgentRuntimeCommand,
    _context: RuntimeCallContext
  ): Promise<void> {
    this.getRun(runId);
    throw new AppError(
      "CONFLICT",
      "This local runtime exposes the resume interface, but v1 HTTP chat does not yet resume paused runs"
    );
  }

  async cancel(
    runId: AgentRunId,
    reason: string | undefined,
    _context: RuntimeCallContext
  ): Promise<void> {
    const state = this.getRun(runId);
    state.cancel(reason);
  }

  private async executeRun(
    runId: AgentRunId,
    input: StartAgentRunInput,
    context: RuntimeCallContext
  ): Promise<void> {
    const state = this.getRun(runId);
    const agent = getAgentConfig(this.options.config, input.agentName);
    const provider = getModelProviderForAgent(this.options.config, agent);
    const tools = this.options.toolRegistry.listDescriptorsForAgent(agent.toolNames);
    const messages: ModelMessage[] = [
      { role: "system", content: createSystemInstructions(agent.instructions, tools.length) },
      { role: "user", content: input.message.text }
    ];

    for (let round = 0; round < 4; round += 1) {
      const streamedText = shouldStreamText(requestMessagesHaveToolResult(messages), tools.length);
      const { completion, emittedDeltas } = await this.options.usageGovernance.runModelCall(
        context.clientInstanceId,
        async () => {
          const modelResult = await this.completeWithProvider(
            {
              providerId: provider.id,
              model: provider.model,
              messages,
              tools
            },
            context,
            state,
            streamedText
          );
          await recordModelUsage({
            usageStore: this.options.usageGovernance,
            runId,
            startInput: input,
            context,
            provider,
            completion: modelResult.completion
          });
          return modelResult;
        }
      );

      if (completion.toolCalls.length === 0) {
        const assistantText = completion.text || "I completed the request.";
        if (emittedDeltas) {
          state.completeMessage(assistantText);
        } else {
          state.message(assistantText);
        }
        state.complete();
        return;
      }

      messages.push({
        role: "assistant",
        content: completion.text,
        toolCalls: completion.toolCalls
      });

      for (const toolCall of completion.toolCalls) {
        const resultContent = await executeToolCall({
          runId,
          startInput: input,
          context,
          state,
          toolCall,
          toolExecution: this.options.toolExecution
        });
        messages.push({
          role: "tool",
          toolCallId: toolCall.toolCallId,
          content: resultContent
        });
      }
    }

    state.fail(new AppError("CONFLICT", "Agent exceeded the maximum tool-call rounds"));
  }

  private getRun(runId: AgentRunId): RunState {
    const state = this.runs.get(runId);
    if (!state) {
      throw new AppError("NOT_FOUND", `Agent run '${runId}' was not found`);
    }
    return state;
  }

  private async completeWithProvider(
    request: Parameters<ModelProvider["complete"]>[0],
    context: RuntimeCallContext,
    state: RunState,
    streamText: boolean
  ): Promise<{ completion: ModelCompletion; emittedDeltas: boolean }> {
    if (!streamText || !this.options.modelProvider.stream) {
      return {
        completion: await this.options.modelProvider.complete(request, context),
        emittedDeltas: false
      };
    }

    let completion: ModelCompletion | undefined;
    let emittedDeltas = false;
    for await (const event of this.options.modelProvider.stream(request, context)) {
      if (event.type === "text_delta") {
        if (event.delta.length > 0) {
          emittedDeltas = true;
          state.emit({
            type: "message_delta",
            runId: state.runId,
            delta: event.delta
          });
        }
        continue;
      }
      completion = event.completion;
    }

    if (!completion) {
      throw new AppError("INTERNAL", "Model provider stream ended without a completion");
    }

    return {
      completion,
      emittedDeltas
    };
  }
}

function requestMessagesHaveToolResult(messages: ModelMessage[]): boolean {
  return messages.some((message) => message.role === "tool");
}

function shouldStreamText(hasToolResult: boolean, toolCount: number): boolean {
  return hasToolResult || toolCount === 0;
}

export function asRuntimeRunId(value: string): AgentRunId {
  return asAgentRunId(value);
}
