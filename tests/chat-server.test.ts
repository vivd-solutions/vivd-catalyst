import { describe, expect, it } from "vitest";
import { z } from "zod";
import { LocalAgentRuntime } from "@agent-chat-platform/agent-runtime";
import { StoreBackedAuditRecorder } from "@agent-chat-platform/audit";
import { DevelopmentAuthAdapter } from "@agent-chat-platform/auth";
import { createChatServer } from "@agent-chat-platform/chat-server";
import { getAgentConfig, getClientInstanceId, parseClientInstanceConfig } from "@agent-chat-platform/config-schema";
import { InMemoryPlatformStore } from "@agent-chat-platform/memory-store";
import { createModelProviderRegistry } from "@agent-chat-platform/model-provider";
import { InProcessToolExecution, ToolRegistry } from "@agent-chat-platform/tool-execution";
import { defineTool, toolSuccess } from "@agent-chat-platform/tool-sdk";

describe("chat server vertical slice", () => {
  it("creates a user-scoped conversation and runs a tool through the local runtime", async () => {
    const config = parseClientInstanceConfig({
      version: 1,
      clientInstance: {
        id: "demo-local",
        displayName: "Demo",
        environment: "development"
      },
      auth: {
        development: {
          enabled: true,
          user: {
            id: "user-1",
            externalUserId: "user-1",
            displayLabel: "User",
            roles: ["user", "admin"],
            permissionRefs: ["demo-tools"]
          }
        }
      },
      defaultAgentName: "test_agent",
      agents: [
        {
          name: "test_agent",
          displayName: "Test Agent",
          instructions: "Use configured tools only.",
          modelProviderId: "local",
          toolNames: ["demo.echo"]
        }
      ],
      modelProviders: [{ id: "local", type: "deterministic", model: "local" }],
      tools: [{ name: "demo.echo", enabled: true }]
    });
    const clientInstanceId = getClientInstanceId(config);
    const store = new InMemoryPlatformStore();
    const auditRecorder = new StoreBackedAuditRecorder({ clientInstanceId, store });
    const tool = defineTool({
      name: "demo.echo",
      description: "Echo text for tests.",
      inputSchema: z.object({ text: z.string() }),
      outputSchema: z.object({ echoed: z.string() }),
      async execute(input) {
        return toolSuccess({ echoed: input.text }, { modelSummary: `Echoed ${input.text}` });
      }
    });
    const toolRegistry = new ToolRegistry({ tools: [tool] });
    const toolExecution = new InProcessToolExecution({
      registry: toolRegistry,
      getAgentToolNames(agentName) {
        return getAgentConfig(config, agentName).toolNames;
      },
      auditRecorder
    });
    const agentRuntime = new LocalAgentRuntime({
      config,
      modelProvider: createModelProviderRegistry({ configs: config.modelProviders, env: {} }),
      toolRegistry,
      toolExecution
    });
    const app = await createChatServer({
      config,
      clientInstanceId,
      authAdapter: new DevelopmentAuthAdapter({
        enabled: true,
        user: config.auth.development!.user
      }),
      conversationStore: store,
      auditEventStore: store,
      auditRecorder,
      agentRuntime
    });

    const created = await app.inject({
      method: "POST",
      url: "/api/conversations",
      payload: { title: "Tool test" }
    });
    expect(created.statusCode).toBe(200);
    const conversation = created.json() as { id: string };

    const sent = await app.inject({
      method: "POST",
      url: `/api/conversations/${conversation.id}/messages`,
      payload: {
        text: '/tool demo.echo {"text":"hello"}'
      }
    });

    expect(sent.statusCode).toBe(200);
    const response = sent.json() as { assistantMessages: Array<{ text: string }> };
    expect(response.assistantMessages.map((message) => message.text).join("\n")).toContain(
      "Echoed hello"
    );

    const audit = await app.inject({
      method: "GET",
      url: "/api/audit-events"
    });
    expect(audit.statusCode).toBe(200);
    expect((audit.json() as Array<{ type: string }>).some((event) => event.type === "tool.completed")).toBe(
      true
    );

    await app.close();
  });
});

