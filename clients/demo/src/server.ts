import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { createClientInstanceApp } from "@agent-chat-platform/client-instance";
import { tools } from "./tool-registry";

const clientRoot = fileURLToPath(new URL("..", import.meta.url));
const workspaceRoot = resolve(clientRoot, "../..");

loadDotenv({ path: resolve(workspaceRoot, ".env"), quiet: true });
loadDotenv({ path: resolve(clientRoot, ".env"), override: true, quiet: true });

const configPath = resolveConfigPath(process.env.CLIENT_CONFIG_PATH);

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

function resolveConfigPath(configPath: string | undefined): string {
  if (!configPath) {
    return resolve(clientRoot, "config/app.yaml");
  }
  if (isAbsolute(configPath)) {
    return configPath;
  }

  const workspacePath = resolve(workspaceRoot, configPath);
  if (existsSync(workspacePath)) {
    return workspacePath;
  }
  return resolve(clientRoot, configPath);
}
