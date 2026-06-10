import { createClientInstanceApp } from "@agent-chat-platform/client-assembly";
import { loadDemoEnvironment, resolveConfigPath } from "./environment";
import { tools } from "./tool-registry";

loadDemoEnvironment();

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
