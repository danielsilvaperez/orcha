import fs from "node:fs";
import path from "node:path";
import * as TOML from "@iarna/toml";
import { defaultConfig } from "./defaults.js";
import { orchaConfigSchema } from "./schema.js";
import { deepMerge, type DeepPartial } from "../utils/deepMerge.js";
import { getGlobalConfigPath, getProjectConfigPath } from "../utils/path.js";
import type { OrchaConfig } from "../types.js";

export interface ConfigOverrides {
  judgeAgent?: OrchaConfig["defaults"]["judgeAgent"];
  timeoutMs?: number;
  allowApiFallback?: boolean;
  synthesis?: boolean;
  agents?: OrchaConfig["defaults"]["judgeAgent"][];
}

function readTomlFile(filePath: string): DeepPartial<OrchaConfig> | undefined {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  return TOML.parse(raw) as DeepPartial<OrchaConfig>;
}

export function toToml(config: OrchaConfig): string {
  return TOML.stringify(config as unknown as TOML.JsonMap);
}

export function loadConfig(cwd: string, overrides?: ConfigOverrides): OrchaConfig {
  const globalPath = getGlobalConfigPath();
  const localPath = getProjectConfigPath(cwd);

  const globalConfig = readTomlFile(globalPath);
  const projectConfig = readTomlFile(localPath);

  const merged = deepMerge(defaultConfig, globalConfig, projectConfig);

  const overridePatch: DeepPartial<OrchaConfig> = {};

  if (overrides?.judgeAgent) {
    overridePatch.defaults = { ...overridePatch.defaults, judgeAgent: overrides.judgeAgent };
  }

  if (overrides?.timeoutMs) {
    overridePatch.defaults = { ...overridePatch.defaults, timeoutMs: overrides.timeoutMs };
  }

  if (typeof overrides?.allowApiFallback === "boolean") {
    overridePatch.defaults = { ...overridePatch.defaults, allowApiFallback: overrides.allowApiFallback };
  }

  if (typeof overrides?.synthesis === "boolean") {
    overridePatch.defaults = { ...overridePatch.defaults, synthesis: overrides.synthesis };
  }

  if (overrides?.agents && overrides.agents.length > 0) {
    overridePatch.agents = {
      codex: { enabled: false },
      claude: { enabled: false },
      gemini: { enabled: false },
      kimi: { enabled: false }
    };

    for (const agent of overrides.agents) {
      overridePatch.agents[agent] = { enabled: true };
    }
  }

  const finalConfig = deepMerge(merged, overridePatch);
  return orchaConfigSchema.parse(finalConfig);
}

export function ensureConfigDirExists(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}
