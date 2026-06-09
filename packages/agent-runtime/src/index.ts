import {
  AppError,
  type AgentRunHandle,
  type AgentRunId,
  type AgentRunStatus,
  type AgentRuntime,
  type AgentRuntimeCommand,
  type AgentRuntimeEvent,
  type ApprovedToolExecutionRequest,
  type RuntimeCallContext,
  type StartAgentRunInput,
  type ToolAuthorizationDecision,
  type ToolExecution,
  asAgentRunId,
  asToolCallId,
  createPlatformId
} from "@agent-chat-platform/chat-core";
import {
  type ClientInstanceConfig,
  getAgentConfig,
  getModelProviderForAgent
} from "@agent-chat-platform/config-schema";
import type { ModelMessage, ModelProvider, ModelToolCall } from "@agent-chat-platform/model-provider";
import type { ToolRegistry } from "@agent-chat-platform/tool-execution";

export interface LocalAgentRuntimeOptions {
  config: ClientInstanceConfig;
  modelProvider: ModelProvider;
  toolRegistry: ToolRegistry;
  toolExecution: ToolExecution;
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
      const completion = await this.options.modelProvider.complete(
        {
          providerId: provider.id,
          model: provider.model,
          messages,
          tools
        },
        context
      );

      if (completion.toolCalls.length === 0) {
        state.message(completion.text || "I completed the request.");
        state.complete();
        return;
      }

      messages.push({
        role: "assistant",
        content: completion.text,
        toolCalls: completion.toolCalls
      });

      for (const toolCall of completion.toolCalls) {
        const resultContent = await this.executeToolCall({
          runId,
          input,
          context,
          state,
          toolCall
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

  private async executeToolCall(input: {
    runId: AgentRunId;
    input: StartAgentRunInput;
    context: RuntimeCallContext;
    state: RunState;
    toolCall: ModelToolCall;
  }): Promise<string> {
    const toolCallId = asToolCallId(input.toolCall.toolCallId);
    input.state.emit({
      type: "tool_call_started",
      runId: input.runId,
      toolCallId,
      toolName: input.toolCall.toolName
    });

    const request = {
      toolName: input.toolCall.toolName,
      toolCallId,
      agentRunId: input.runId,
      conversationId: input.input.conversationId,
      agentName: input.input.agentName,
      input: input.toolCall.input
    };
    const decision = await this.options.toolExecution.authorize(request, input.context);
    if (decision.status === "denied") {
      const result = {
        status: "failed" as const,
        error: {
          code: "not_allowed" as const,
          message: decision.reason
        }
      };
      input.state.emit({
        type: "tool_call_failed",
        runId: input.runId,
        toolCallId,
        toolName: input.toolCall.toolName,
        result
      });
      return JSON.stringify(result);
    }

    if (decision.status === "requires_approval") {
      input.state.emit({
        type: "tool_permission_requested",
        runId: input.runId,
        toolCallId,
        toolName: input.toolCall.toolName,
        reason: decision.reason,
        preview: decision.preview
      });
      throw new AppError(
        "CONFLICT",
        "Tool approval is required, but this v1 request path does not resume paused runs"
      );
    }

    const result = await this.options.toolExecution.execute(
      {
        ...request,
        authorization: decision satisfies Extract<ToolAuthorizationDecision, { status: "allowed" }>
      } as ApprovedToolExecutionRequest,
      input.context
    );
    input.state.emit({
      type: result.status === "success" ? "tool_call_completed" : "tool_call_failed",
      runId: input.runId,
      toolCallId,
      toolName: input.toolCall.toolName,
      result
    });

    if (result.status === "success") {
      return result.modelSummary ?? JSON.stringify(result.output);
    }

    return JSON.stringify(result.error);
  }

  private getRun(runId: AgentRunId): RunState {
    const state = this.runs.get(runId);
    if (!state) {
      throw new AppError("NOT_FOUND", `Agent run '${runId}' was not found`);
    }
    return state;
  }
}

class RunState {
  readonly runId: AgentRunId;
  readonly startedAt = new Date().toISOString();
  private status: AgentRunStatus = "running";
  private sequence = 0;
  private closed = false;
  private readonly events: AgentRuntimeEvent[] = [];
  private readonly listeners = new Set<() => void>();

  constructor(runId: AgentRunId) {
    this.runId = runId;
  }

  async *observe(): AsyncIterable<AgentRuntimeEvent> {
    let index = 0;
    while (true) {
      while (index < this.events.length) {
        const event = this.events[index];
        if (!event) {
          break;
        }
        index += 1;
        yield event;
      }
      if (this.closed) {
        return;
      }
      await this.waitForEvent();
    }
  }

  message(text: string): void {
    this.emit({
      type: "message_delta",
      runId: this.runId,
      delta: text
    });
    this.emit({
      type: "message_completed",
      runId: this.runId,
      message: {
        role: "assistant",
        text
      }
    });
  }

  emit(event: AgentRuntimeEventDraft): void {
    if (this.closed) {
      return;
    }
    this.sequence += 1;
    this.events.push({
      ...event,
      sequence: this.sequence,
      createdAt: new Date().toISOString()
    } as AgentRuntimeEvent);
    this.flush();
  }

  complete(): void {
    this.status = "completed";
    this.emit({
      type: "run_completed",
      runId: this.runId
    });
    this.close();
  }

  cancel(reason?: string): void {
    this.status = "cancelled";
    this.emit({
      type: "run_cancelled",
      runId: this.runId,
      reason
    });
    this.close();
  }

  fail(error: unknown): void {
    this.status = "failed";
    this.emit({
      type: "run_failed",
      runId: this.runId,
      error: {
        code: error instanceof AppError ? error.code : "INTERNAL",
        message: error instanceof Error ? error.message : "Agent run failed"
      }
    });
    this.close();
  }

  private waitForEvent(): Promise<void> {
    return new Promise((resolve) => {
      const listener = () => {
        this.listeners.delete(listener);
        resolve();
      };
      this.listeners.add(listener);
    });
  }

  private close(): void {
    this.closed = true;
    this.flush();
  }

  private flush(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

function createSystemInstructions(instructions: string, toolCount: number): string {
  if (toolCount === 0) {
    return instructions;
  }

  return `${instructions}

You have access to configured tools. Use them automatically when they are relevant. Do not ask the user to type debug commands or tool invocation syntax.`;
}

type AgentRuntimeEventDraft = AgentRuntimeEvent extends infer TEvent
  ? TEvent extends AgentRuntimeEvent
    ? Omit<TEvent, "sequence" | "createdAt">
    : never
  : never;

export function asRuntimeRunId(value: string): AgentRunId {
  return asAgentRunId(value);
}
