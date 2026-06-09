import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClientInstanceApp } from "@agent-chat-platform/client-instance";
import { tools } from "./tool-registry";

const configPath =
  process.env.CLIENT_CONFIG_PATH ??
  resolve(fileURLToPath(new URL("..", import.meta.url)), "config/app.yaml");

const app = await createClientInstanceApp({
  configPath,
  env: process.env,
  tools
});

await app.listen();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void app.close();
  });
}

