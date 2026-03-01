import os from "node:os";
import path from "node:path";

export function getOrchaHome(): string {
  return path.join(os.homedir(), ".orcha");
}

export function getGlobalConfigPath(): string {
  return path.join(getOrchaHome(), "config.toml");
}

export function getDbPath(): string {
  return path.join(getOrchaHome(), "orcha.db");
}

export function getProjectConfigPath(cwd: string): string {
  return path.join(cwd, ".orcha.toml");
}

export function getWorkflowDir(cwd: string): string {
  return path.join(cwd, ".orcha", "workflows");
}
