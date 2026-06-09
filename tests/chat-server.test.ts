import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createClientInstanceApp } from "@agent-chat-platform/client-instance";
import { parseClientInstanceConfig, type UsageLimitsConfig } from "@agent-chat-platform/config-schema";
import { defineTool, toolSuccess } from "@agent-chat-platform/tool-sdk";

describe("client instance app vertical slice", () => {
  it("creates a user-scoped conversation and runs a configured tool", async () => {
    const config = createTestConfig({
      tools: [{ name: "demo.echo", enabled: true }],
      toolNames: ["demo.echo"]
    });
    const tool = defineTool({
      name: "demo.echo",
      description: "Echo text for tests.",
      inputSchema: z.object({ text: z.string() }),
      outputSchema: z.object({ echoed: z.string() }),
      async execute(input) {
        return toolSuccess({ echoed: input.text }, { modelSummary: `Echoed ${input.text}` });
      }
    });
    const app = await createClientInstanceApp({
      config,
      env: {},
      tools: [tool]
    });

    const created = await app.server.inject({
      method: "POST",
      url: "/api/conversations",
      payload: { title: "Tool test" }
    });
    expect(created.statusCode).toBe(200);
    const conversation = created.json() as { id: string };

    const sent = await app.server.inject({
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

    const audit = await app.server.inject({
      method: "GET",
      url: "/api/audit-events"
    });
    expect(audit.statusCode).toBe(200);
    expect((audit.json() as Array<{ type: string }>).some((event) => event.type === "tool.completed")).toBe(
      true
    );

    const usage = await app.server.inject({
      method: "GET",
      url: "/api/superadmin/usage"
    });
    expect(usage.statusCode).toBe(200);
    const usageBody = usage.json() as {
      today: { modelCallCount: number; cost: { totalCostMicros: number } };
    };
    expect(usageBody.today).toMatchObject({
      cost: {
        totalCostMicros: 0
      }
    });
    expect(usageBody.today.modelCallCount).toBeGreaterThan(0);

    await app.close();
  });

  it("rejects messages after the configured daily model call limit is reached", async () => {
    const app = await createClientInstanceApp({
      config: createTestConfig({
        usageLimits: {
          modelCallsPerDay: 1
        }
      }),
      env: {},
      tools: []
    });

    const created = await app.server.inject({
      method: "POST",
      url: "/api/conversations",
      payload: { title: "Usage limit test" }
    });
    expect(created.statusCode).toBe(200);
    const conversation = created.json() as { id: string };

    const firstMessage = await app.server.inject({
      method: "POST",
      url: `/api/conversations/${conversation.id}/messages`,
      payload: {
        text: "hello"
      }
    });
    expect(firstMessage.statusCode).toBe(200);

    const secondMessage = await app.server.inject({
      method: "POST",
      url: `/api/conversations/${conversation.id}/messages`,
      payload: {
        text: "hello again"
      }
    });
    expect(secondMessage.statusCode).toBe(403);
    expect((secondMessage.json() as { error: { code: string; message: string } }).error).toMatchObject({
      code: "FORBIDDEN",
      message: "Daily model call usage limit has been reached"
    });

    const audit = await app.server.inject({
      method: "GET",
      url: "/api/audit-events"
    });
    expect(audit.statusCode).toBe(200);
    expect((audit.json() as Array<{ type: string }>).some((event) => event.type === "message.failed")).toBe(
      true
    );

    await app.close();
  });

  it("switches between configured development users per request", async () => {
    const app = await createClientInstanceApp({
      config: createTestConfig({
        developmentAuth: {
          enabled: true,
          defaultUserId: "superadmin-1",
          users: [
            {
              id: "superadmin-1",
              externalUserId: "superadmin-1",
              displayLabel: "Superadmin",
              roles: ["user", "admin", "superadmin"],
              permissionRefs: ["demo-tools"]
            },
            {
              id: "user-1",
              externalUserId: "user-1",
              displayLabel: "Normal User",
              roles: ["user"],
              permissionRefs: ["demo-tools"]
            }
          ]
        }
      }),
      env: {},
      tools: []
    });

    const developmentUsers = await app.server.inject({
      method: "GET",
      url: "/auth/development/users"
    });
    expect(developmentUsers.statusCode).toBe(200);
    expect(developmentUsers.json()).toMatchObject({
      defaultUserId: "superadmin-1",
      users: [{ id: "superadmin-1" }, { id: "user-1" }]
    });

    const defaultMe = await app.server.inject({
      method: "GET",
      url: "/api/me"
    });
    expect(defaultMe.statusCode).toBe(200);
    expect(defaultMe.json()).toMatchObject({
      id: "superadmin-1",
      roles: ["user", "admin", "superadmin"]
    });

    const normalMe = await app.server.inject({
      method: "GET",
      url: "/api/me",
      headers: {
        "x-dev-user-id": "user-1"
      }
    });
    expect(normalMe.statusCode).toBe(200);
    expect(normalMe.json()).toMatchObject({
      id: "user-1",
      roles: ["user"]
    });

    const normalUsage = await app.server.inject({
      method: "GET",
      url: "/api/superadmin/usage",
      headers: {
        "x-dev-user-id": "user-1"
      }
    });
    expect(normalUsage.statusCode).toBe(403);

    const unknownUser = await app.server.inject({
      method: "GET",
      url: "/api/me",
      headers: {
        "x-dev-user-id": "missing-user"
      }
    });
    expect(unknownUser.statusCode).toBe(401);

    await app.close();
  });

  it("rejects startup when an agent references an unregistered tool implementation", async () => {
    await expect(
      createClientInstanceApp({
        config: createTestConfig({
          tools: [{ name: "demo.echo", enabled: true }],
          toolNames: ["demo.echo"]
        }),
        env: {},
        tools: []
      })
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      message: "Client instance assembly is invalid"
    });
  });

  it("rejects startup when an enabled tool requires approval before resume support exists", async () => {
    const approvalTool = defineTool({
      name: "demo.approval",
      description: "Approval-only test tool.",
      inputSchema: z.object({}),
      permission: {
        mode: "approval_required",
        reason: "Needs approval"
      },
      async execute() {
        return toolSuccess({});
      }
    });

    await expect(
      createClientInstanceApp({
        config: createTestConfig({
          tools: [{ name: "demo.approval", enabled: true }],
          toolNames: ["demo.approval"]
        }),
        env: {},
        tools: [approvalTool]
      })
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      message: "Client instance assembly is invalid"
    });
  });
});

function createTestConfig(input: {
  toolNames?: string[];
  tools?: Array<{ name: string; enabled?: boolean }>;
  usageLimits?: UsageLimitsConfig;
  developmentAuth?: unknown;
} = {}) {
  return parseClientInstanceConfig({
    version: 1,
    clientInstance: {
      id: "demo-local",
      displayName: "Demo",
      environment: "development"
    },
    auth: {
      development: input.developmentAuth ?? {
        enabled: true,
        user: {
          id: "user-1",
          externalUserId: "user-1",
          displayLabel: "User",
          roles: ["user", "admin", "superadmin"],
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
        toolNames: input.toolNames ?? []
      }
    ],
    modelProviders: [{ id: "local", type: "deterministic", model: "local" }],
    usage: {
      limits: input.usageLimits ?? {}
    },
    tools: input.tools ?? []
  });
}
