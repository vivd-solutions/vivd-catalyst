import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  asAgentRunId,
  asClientInstanceId,
  asConversationId,
  asToolCallId,
  type ToolExecutionContext
} from "@agent-chat-platform/chat-core";
import { InProcessToolExecution, ToolRegistry } from "@agent-chat-platform/tool-execution";
import { defineTool, toolSuccess } from "@agent-chat-platform/tool-sdk";

describe("in-process tool execution", () => {
  it("authorizes, validates, and executes a registered tool through the product interface", async () => {
    const tool = defineTool({
      name: "demo.echo",
      description: "Echo text for tests.",
      inputSchema: z.object({ text: z.string().min(1) }),
      outputSchema: z.object({ echoed: z.string() }),
      permission: {
        mode: "allow",
        requiredPermissionRefs: ["demo-tools"]
      },
      async execute(input) {
        return toolSuccess({ echoed: input.text }, { modelSummary: input.text });
      }
    });
    const execution = new InProcessToolExecution({
      registry: new ToolRegistry({ tools: [tool] }),
      getAgentToolNames: () => ["demo.echo"]
    });
    const context: ToolExecutionContext = {
      clientInstanceId: asClientInstanceId("demo-local"),
      correlationId: "corr_test",
      user: {
        id: "user-1",
        externalUserId: "user-1",
        displayLabel: "User",
        roles: ["user"],
        permissionRefs: ["demo-tools"],
        clientInstanceId: asClientInstanceId("demo-local"),
        authSource: "test"
      }
    };
    const request = {
      toolName: "demo.echo",
      toolCallId: asToolCallId("toolcall_1"),
      agentRunId: asAgentRunId("run_1"),
      conversationId: asConversationId("conv_1"),
      agentName: "test_agent",
      input: { text: "hello" }
    };

    const decision = await execution.authorize(request, context);
    expect(decision.status).toBe("allowed");
    if (decision.status !== "allowed") {
      throw new Error("Expected allowed decision");
    }

    const result = await execution.execute({ ...request, authorization: decision }, context);
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.output).toEqual({ echoed: "hello" });
      expect(result.modelSummary).toBe("hello");
    }
  });
});

