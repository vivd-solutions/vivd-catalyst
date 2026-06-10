import { AppError, createPlatformId } from "@agent-chat-platform/core";
import type {
  ModelCompletion,
  ModelCompletionRequest,
  ModelCompletionStreamEvent,
  ModelProvider,
  ModelTool,
  ModelToolCall
} from "./types";

export class DeterministicModelProvider implements ModelProvider {
  readonly id: string;

  constructor(id = "local") {
    this.id = id;
  }

  async complete(request: ModelCompletionRequest): Promise<ModelCompletion> {
    const toolMessages = request.messages.filter((message) => message.role === "tool");
    if (toolMessages.length > 0) {
      return {
        text: `Tool work completed:\n\n${toolMessages.map((message) => message.content).join("\n\n")}`,
        toolCalls: [],
        usage: noReportedUsage()
      };
    }

    const lastUserMessage = [...request.messages].reverse().find((message) => message.role === "user");
    const content = lastUserMessage?.content.trim() ?? "";
    const toolCall = parseToolCommand(content, request.tools);

    if (toolCall) {
      return {
        text: `I will run ${toolCall.toolName} with the provided input.`,
        toolCalls: [toolCall],
        usage: noReportedUsage()
      };
    }

    return {
      text:
        content.length > 0
          ? `Local agent response: I received "${content}". Use /tool <tool.name> <json> to exercise a registered tool.`
          : "Local agent response: send a message or invoke a tool with /tool <tool.name> <json>.",
      toolCalls: [],
      usage: noReportedUsage()
    };
  }

  async *stream(request: ModelCompletionRequest): AsyncIterable<ModelCompletionStreamEvent> {
    const completion = await this.complete(request);
    if (completion.toolCalls.length === 0 && completion.text.length > 0) {
      for (const delta of chunkText(completion.text)) {
        await delay(20);
        yield {
          type: "text_delta",
          delta
        };
      }
    }
    yield {
      type: "completed",
      completion
    };
  }
}

function noReportedUsage() {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    source: "not_reported" as const
  };
}

function parseToolCommand(content: string, tools: ModelTool[]): ModelToolCall | undefined {
  if (!content.startsWith("/tool ")) {
    return undefined;
  }

  const [, toolName, json = "{}"] = content.match(/^\/tool\s+(\S+)\s*([\s\S]*)$/u) ?? [];
  if (!toolName) {
    return undefined;
  }
  if (!tools.some((tool) => tool.name === toolName)) {
    throw new AppError("BAD_REQUEST", `Tool '${toolName}' is not available to this agent`);
  }

  return {
    toolCallId: createPlatformId("toolcall"),
    toolName,
    input: parseJsonObject(json || "{}")
  };
}

function parseJsonObject(value: string): unknown {
  try {
    return value ? JSON.parse(value) : {};
  } catch {
    throw new AppError("BAD_REQUEST", "Tool input must be valid JSON");
  }
}

function chunkText(text: string): string[] {
  return text.match(/\S+\s*/gu) ?? [text];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
