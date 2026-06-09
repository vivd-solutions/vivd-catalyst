import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const sourceAlias = {
  "@agent-chat-platform/agent-runtime": "packages/agent-runtime/src/index.ts",
  "@agent-chat-platform/api-contract": "packages/api-contract/src/index.ts",
  "@agent-chat-platform/api-client": "packages/api-client/src/index.ts",
  "@agent-chat-platform/audit": "packages/audit/src/index.ts",
  "@agent-chat-platform/auth": "packages/auth/src/index.ts",
  "@agent-chat-platform/chat-core": "packages/chat-core/src/index.ts",
  "@agent-chat-platform/chat-server": "packages/chat-server/src/index.ts",
  "@agent-chat-platform/chat-ui": "packages/chat-ui/src/index.tsx",
  "@agent-chat-platform/chat-widget": "packages/chat-widget/src/index.tsx",
  "@agent-chat-platform/client-instance": "packages/client-instance/src/index.ts",
  "@agent-chat-platform/config-schema": "packages/config-schema/src/index.ts",
  "@agent-chat-platform/memory-store": "packages/memory-store/src/index.ts",
  "@agent-chat-platform/model-provider": "packages/model-provider/src/index.ts",
  "@agent-chat-platform/postgres-store": "packages/postgres-store/src/index.ts",
  "@agent-chat-platform/tool-execution": "packages/tool-execution/src/index.ts",
  "@agent-chat-platform/tool-sdk": "packages/tool-sdk/src/index.ts",
  "@agent-chat-platform/usage-governance": "packages/usage-governance/src/index.ts"
};

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: Object.fromEntries(
      Object.entries(sourceAlias).map(([name, path]) => [name, resolve(rootDir, path)])
    )
  },
  test: {
    include: ["tests/**/*.test.ts"]
  }
});
