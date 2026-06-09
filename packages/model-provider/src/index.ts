import {
  AppError,
  type JsonObject,
  type RuntimeCallContext,
  createPlatformId
} from "@agent-chat-platform/chat-core";
import type { ModelProviderConfig } from "@agent-chat-platform/config-schema";

export interface ModelTool {
  name: string;
  description: string;
  inputJsonSchema?: JsonObject;
}

export interface ModelToolCall {
  toolCallId: string;
  toolName: string;
  input: unknown;
}

export type ModelMessage =
  | {
      role: "system" | "user";
      content: string;
    }
  | {
      role: "assistant";
      content: string;
      toolCalls?: ModelToolCall[];
    }
  | {
      role: "tool";
      content: string;
      toolCallId: string;
    };

export interface ModelCompletionRequest {
  providerId: string;
  model: string;
  messages: ModelMessage[];
  tools: ModelTool[];
}

export interface ModelCompletion {
  text: string;
  toolCalls: ModelToolCall[];
}

export interface ModelProvider {
  readonly id: string;
  complete(
    request: ModelCompletionRequest,
    context: RuntimeCallContext
  ): Promise<ModelCompletion>;
}

export class ModelProviderRegistry implements ModelProvider {
  readonly id = "registry";
  private readonly providers = new Map<string, ModelProvider>();

  constructor(providers: ModelProvider[]) {
    for (const provider of providers) {
      this.providers.set(provider.id, provider);
    }
  }

  async complete(
    request: ModelCompletionRequest,
    context: RuntimeCallContext
  ): Promise<ModelCompletion> {
    const provider = this.providers.get(request.providerId);
    if (!provider) {
      throw new AppError("NOT_FOUND", `Model provider '${request.providerId}' is not registered`);
    }
    return provider.complete(request, context);
  }
}

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
        toolCalls: []
      };
    }

    const lastUserMessage = [...request.messages].reverse().find((message) => message.role === "user");
    const content = lastUserMessage?.content.trim() ?? "";
    const toolCall = parseToolCommand(content, request.tools);

    if (toolCall) {
      return {
        text: `I will run ${toolCall.toolName} with the provided input.`,
        toolCalls: [toolCall]
      };
    }

    return {
      text:
        content.length > 0
          ? `Local agent response: I received "${content}". Use /tool <tool.name> <json> to exercise a registered tool.`
          : "Local agent response: send a message or invoke a tool with /tool <tool.name> <json>.",
      toolCalls: []
    };
  }
}

export interface OpenAiCompatibleChatProviderOptions {
  id: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  organization?: string;
}

export class OpenAiCompatibleChatProvider implements ModelProvider {
  readonly id: string;
  private readonly options: OpenAiCompatibleChatProviderOptions;

  constructor(options: OpenAiCompatibleChatProviderOptions) {
    this.id = options.id;
    this.options = options;
  }

  async complete(
    request: ModelCompletionRequest,
    context: RuntimeCallContext
  ): Promise<ModelCompletion> {
    const toolNameMap = new Map(request.tools.map((tool) => [toProviderToolName(tool.name), tool.name]));
    const response = await fetch(`${this.options.baseUrl.replace(/\/$/u, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.options.apiKey}`,
        ...(this.options.organization ? { "openai-organization": this.options.organization } : {})
      },
      body: JSON.stringify({
        model: this.options.model,
        messages: request.messages.map(toOpenAiChatMessage),
        tools: request.tools.map((tool) => ({
          type: "function",
          function: {
            name: toProviderToolName(tool.name),
            description: tool.description,
            parameters: tool.inputJsonSchema ?? {
              type: "object",
              additionalProperties: true
            }
          }
        })),
        tool_choice: request.tools.length > 0 ? "auto" : undefined
      }),
      signal: context.signal
    });

    if (!response.ok) {
      throw new AppError("INTERNAL", `Model provider request failed with ${response.status}`, {
        providerId: this.id
      });
    }

    const payload = (await response.json()) as OpenAiCompatibleResponse;
    const message = payload.choices?.[0]?.message;
    if (!message) {
      throw new AppError("INTERNAL", "Model provider returned no message");
    }

    return {
      text: message.content ?? "",
      toolCalls:
        message.tool_calls?.map((toolCall) => ({
          toolCallId: toolCall.id,
          toolName: toolNameMap.get(toolCall.function.name) ?? toolCall.function.name,
          input: parseJsonObject(toolCall.function.arguments)
        })) ?? []
    };
  }
}

export function createModelProviderRegistry(input: {
  configs: ModelProviderConfig[];
  env: Record<string, string | undefined>;
}): ModelProviderRegistry {
  return new ModelProviderRegistry(
    input.configs.map((config) => {
      if (config.type === "deterministic") {
        return new DeterministicModelProvider(config.id);
      }

      const apiKey = input.env[config.apiKeyEnvName];
      if (!apiKey) {
        throw new AppError(
          "VALIDATION_FAILED",
          `Missing API key environment variable '${config.apiKeyEnvName}' for model provider '${config.id}'`
        );
      }

      return new OpenAiCompatibleChatProvider({
        id: config.id,
        model: config.model,
        baseUrl: config.baseUrl,
        apiKey,
        organization: config.organizationEnvName ? input.env[config.organizationEnvName] : undefined
      });
    })
  );
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

function toProviderToolName(toolName: string): string {
  return toolName.replaceAll(".", "__dot__");
}

function toOpenAiChatMessage(message: ModelMessage): OpenAiCompatibleMessage {
  if (message.role === "assistant") {
    return {
      role: "assistant",
      content: message.content || null,
      tool_calls: message.toolCalls?.map((toolCall) => ({
        id: toolCall.toolCallId,
        type: "function",
        function: {
          name: toProviderToolName(toolCall.toolName),
          arguments: JSON.stringify(toolCall.input)
        }
      }))
    };
  }

  if (message.role === "tool") {
    return {
      role: "tool",
      tool_call_id: message.toolCallId,
      content: message.content
    };
  }

  return {
    role: message.role,
    content: message.content
  };
}

interface OpenAiCompatibleResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{
        id: string;
        type?: "function";
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
  }>;
}

type OpenAiCompatibleMessage =
  | {
      role: "system" | "user";
      content: string;
    }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: {
          name: string;
          arguments: string;
        };
      }>;
    }
  | {
      role: "tool";
      tool_call_id: string;
      content: string;
    };
