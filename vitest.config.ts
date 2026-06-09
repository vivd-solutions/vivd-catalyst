import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const packageAlias = (name: string) =>
  fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@agent-chat-platform/agent-runtime": packageAlias("agent-runtime"),
      "@agent-chat-platform/api-client": packageAlias("api-client"),
      "@agent-chat-platform/audit": packageAlias("audit"),
      "@agent-chat-platform/auth": packageAlias("auth"),
      "@agent-chat-platform/chat-core": packageAlias("chat-core"),
      "@agent-chat-platform/chat-server": packageAlias("chat-server"),
      "@agent-chat-platform/client-instance": packageAlias("client-instance"),
      "@agent-chat-platform/config-schema": packageAlias("config-schema"),
      "@agent-chat-platform/memory-store": packageAlias("memory-store"),
      "@agent-chat-platform/model-provider": packageAlias("model-provider"),
      "@agent-chat-platform/postgres-store": packageAlias("postgres-store"),
      "@agent-chat-platform/tool-execution": packageAlias("tool-execution"),
      "@agent-chat-platform/tool-sdk": packageAlias("tool-sdk")
    }
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
