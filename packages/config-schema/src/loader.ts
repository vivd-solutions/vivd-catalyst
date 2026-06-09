import { readFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import yaml from "js-yaml";
import { AppError } from "@agent-chat-platform/chat-core";
import { agentConfigSchema, clientInstanceConfigFileSchema, type ClientInstanceConfig } from "./schemas";
import { parseClientInstanceConfig } from "./validation";

export async function loadClientInstanceConfigFromFile(
  path: string
): Promise<ClientInstanceConfig> {
  const raw = await readStructuredFile(path);
  const parsed = clientInstanceConfigFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("VALIDATION_FAILED", "Client instance config is invalid", {
      issues: parsed.error.issues
    });
  }

  const baseDir = dirname(path);
  const fileAgents = await Promise.all(
    parsed.data.agentFiles.map(async (agentFile) => {
      const agentPath = resolve(baseDir, agentFile);
      const agentRaw = await readStructuredFile(agentPath);
      const agent = agentConfigSchema.safeParse(agentRaw);
      if (!agent.success) {
        throw new AppError("VALIDATION_FAILED", `Agent config '${agentFile}' is invalid`, {
          issues: agent.error.issues
        });
      }
      return agent.data;
    })
  );

  return parseClientInstanceConfig({
    ...parsed.data,
    agents: [...parsed.data.agents, ...fileAgents]
  });
}

async function readStructuredFile(path: string): Promise<unknown> {
  const contents = await readFile(path, "utf8");
  const extension = extname(path).toLowerCase();
  return extension === ".json" ? JSON.parse(contents) : yaml.load(contents);
}
