import os from "node:os";
import path from "node:path";

export function getCouncilHome(): string {
  return path.join(os.homedir(), ".council");
}

export function getGlobalConfigPath(): string {
  return path.join(getCouncilHome(), "config.toml");
}

export function getDbPath(): string {
  return path.join(getCouncilHome(), "council.db");
}

export function getProjectConfigPath(cwd: string): string {
  return path.join(cwd, ".council.toml");
}

export function getWorkflowDir(cwd: string): string {
  return path.join(cwd, ".council", "workflows");
}
