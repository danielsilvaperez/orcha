import path from "node:path";
import type { Command } from "commander";
import type { AgentId, CouncilConfig } from "../types.js";

export interface RunCliOptions {
  agents?: string;
  cwd?: string;
  json?: boolean;
  synthesis?: boolean;
  timeoutMs?: string;
  allowApiFallback?: boolean;
  judgeAgent?: AgentId;
}

export function addCommonRunOptions(command: Command): Command {
  return command
    .option("--agents <agents>", "Comma separated agent IDs (codex,claude,gemini,kimi)")
    .option("--cwd <cwd>", "Working directory", process.cwd())
    .option("--json", "Output JSON")
    .option("--no-synthesis", "Disable synthesis stage")
    .option("--timeout-ms <timeoutMs>", "Per-agent timeout in milliseconds")
    .option("--allow-api-fallback", "Enable API fallback if configured")
    .option("--judge-agent <agent>", "Judge agent for synthesis", "codex");
}

export function parseAgentList(raw: string | undefined): AgentId[] | undefined {
  if (!raw) {
    return undefined;
  }

  const parsed = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const allowed = new Set<AgentId>(["codex", "claude", "gemini", "kimi"]);
  const invalid = parsed.filter((value) => !allowed.has(value as AgentId));

  if (invalid.length > 0) {
    throw new Error(`Invalid agent(s): ${invalid.join(", ")}`);
  }

  return parsed as AgentId[];
}

export function resolveWorkingDirectory(rawCwd: string | undefined): string {
  return path.resolve(rawCwd ?? process.cwd());
}

export function resolveAgents(config: CouncilConfig, explicitAgents?: AgentId[]): AgentId[] {
  if (explicitAgents && explicitAgents.length > 0) {
    return explicitAgents;
  }

  const enabledAgents = (Object.entries(config.agents) as Array<[AgentId, CouncilConfig["agents"][AgentId]]>)
    .filter(([, value]) => value.enabled)
    .map(([agent]) => agent);

  if (enabledAgents.length === 0) {
    throw new Error("No enabled agents found. Update config or pass --agents.");
  }

  return enabledAgents;
}
