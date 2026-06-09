import { InMemoryPlatformStore } from "@agent-chat-platform/memory-store";
import { PostgresPlatformStore } from "@agent-chat-platform/postgres-store";
import type { PlatformStore } from "@agent-chat-platform/chat-core";
import type { ClientInstanceEnv } from "./env";

export async function createPlatformStore(env: ClientInstanceEnv): Promise<PlatformStore> {
  if (env.DATABASE_URL) {
    return PostgresPlatformStore.connect({
      databaseUrl: env.DATABASE_URL,
      runMigrations: env.RUN_MIGRATIONS !== "false"
    });
  }
  return new InMemoryPlatformStore();
}
