import { ZodError } from "zod";
import {
  AppError,
  type ApprovedToolExecutionRequest,
  type JsonObject,
  type ToolAuthorizationDecision,
  type ToolDescriptor,
  type ToolExecution,
  type ToolExecutionContext,
  type ToolExecutionErrorCode,
  type ToolExecutionRequest,
  type ToolExecutionResult,
  type ToolHandlerFailureResult
} from "@agent-chat-platform/chat-core";
import { auditActorFromUser, type AuditRecorder } from "@agent-chat-platform/audit";
import type { AnyToolDefinition } from "@agent-chat-platform/tool-sdk";

export interface ToolRegistryOptions {
  tools: AnyToolDefinition[];
  enabledToolNames?: Set<string>;
}

export class ToolRegistry {
  private readonly toolsByName = new Map<string, AnyToolDefinition>();
  private readonly enabledToolNames?: Set<string>;

  constructor(options: ToolRegistryOptions) {
    this.enabledToolNames = options.enabledToolNames;
    for (const tool of options.tools) {
      assertValidToolName(tool.name);
      if (this.toolsByName.has(tool.name)) {
        throw new AppError("CONFLICT", `Duplicate tool definition '${tool.name}'`);
      }
      this.toolsByName.set(tool.name, tool);
    }
  }

  get(toolName: string): AnyToolDefinition | undefined {
    if (this.enabledToolNames && !this.enabledToolNames.has(toolName)) {
      return undefined;
    }
    return this.toolsByName.get(toolName);
  }

  listDescriptorsForAgent(toolNames: readonly string[]): ToolDescriptor[] {
    return toolNames
      .map((toolName) => this.get(toolName))
      .filter((tool): tool is AnyToolDefinition => Boolean(tool))
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputJsonSchema: tool.inputJsonSchema,
        permission: tool.permission
      }));
  }

  has(toolName: string): boolean {
    return Boolean(this.get(toolName));
  }
}

export interface InProcessToolExecutionOptions {
  registry: ToolRegistry;
  getAgentToolNames(agentName: string): readonly string[];
  auditRecorder?: AuditRecorder;
}

export class InProcessToolExecution implements ToolExecution {
  private readonly registry: ToolRegistry;
  private readonly getAgentToolNames: (agentName: string) => readonly string[];
  private readonly auditRecorder?: AuditRecorder;

  constructor(options: InProcessToolExecutionOptions) {
    this.registry = options.registry;
    this.getAgentToolNames = options.getAgentToolNames;
    this.auditRecorder = options.auditRecorder;
  }

  async authorize(
    request: ToolExecutionRequest,
    context: ToolExecutionContext
  ): Promise<ToolAuthorizationDecision> {
    const tool = this.registry.get(request.toolName);
    if (!tool) {
      return { status: "denied", reason: `Tool '${request.toolName}' is not registered` };
    }

    if (!this.getAgentToolNames(request.agentName).includes(request.toolName)) {
      return {
        status: "denied",
        reason: `Agent '${request.agentName}' is not allowed to use '${request.toolName}'`
      };
    }

    const missingPermission = tool.permission?.requiredPermissionRefs?.find(
      (permissionRef) => !context.user.permissionRefs.includes(permissionRef)
    );
    if (missingPermission) {
      return {
        status: "denied",
        reason: `User is missing permission '${missingPermission}'`
      };
    }

    if (tool.permission?.mode === "deny") {
      return {
        status: "denied",
        reason: tool.permission.reason ?? `Tool '${request.toolName}' is denied by policy`
      };
    }

    if (tool.permission?.mode === "approval_required" && !context.permissionDecision?.approved) {
      return {
        status: "requires_approval",
        reason:
          tool.permission.reason ?? `Tool '${request.toolName}' requires explicit approval`,
        preview: toPreview(request.input)
      };
    }

    return { status: "allowed", reason: tool.permission?.reason };
  }

  async execute(
    request: ApprovedToolExecutionRequest,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const tool = this.registry.get(request.toolName);
    if (!tool) {
      return failed("tool_not_found", `Tool '${request.toolName}' is not registered`);
    }

    await this.audit("tool.started", "success", request, context);
    try {
      const input = tool.inputSchema.parse(request.input);
      const result = await tool.execute(input, context);
      const validated =
        result.status === "success" && tool.outputSchema
          ? {
              ...result,
              output: tool.outputSchema.parse(result.output)
            }
          : result;

      await this.audit("tool.completed", validated.status === "success" ? "success" : "failed", request, context, {
        resultStatus: validated.status
      });
      return validated;
    } catch (error) {
      const result =
        error instanceof ZodError
          ? failed("validation_failed", "Tool input or output failed validation", {
              issues: error.issues.map((issue) => ({
                code: issue.code,
                path: issue.path.join("."),
                message: issue.message
              }))
            })
          : failed("handler_failed", error instanceof Error ? error.message : "Tool handler failed");

      await this.audit("tool.failed", "failed", request, context, {
        code: result.error.code
      });
      return result;
    }
  }

  private async audit(
    type: string,
    status: "success" | "failed" | "denied",
    request: ToolExecutionRequest,
    context: ToolExecutionContext,
    metadata: JsonObject = {}
  ): Promise<void> {
    await this.auditRecorder?.record({
      type,
      status,
      actor: auditActorFromUser(context.user),
      subject: request.toolName,
      correlationId: context.correlationId,
      metadata: {
        ...metadata,
        agentName: request.agentName,
        conversationId: request.conversationId,
        toolCallId: request.toolCallId
      }
    });
  }
}

function assertValidToolName(name: string): void {
  if (!/^[a-z][a-z0-9_.-]*$/u.test(name)) {
    throw new AppError(
      "VALIDATION_FAILED",
      `Tool name '${name}' must start with a lowercase letter and contain only lowercase letters, numbers, dots, underscores, or hyphens`
    );
  }
}

function failed(
  code: ToolExecutionErrorCode,
  message: string,
  details?: JsonObject
): ToolHandlerFailureResult {
  return {
    status: "failed",
    error: {
      code,
      message,
      details
    }
  };
}

function toPreview(input: unknown): JsonObject {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input as JsonObject;
  }
  return { value: String(input) };
}
