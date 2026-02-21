import type { Command } from "commander";
import fs from "node:fs";
import { loadConfig } from "../config/load.js";
import { createAdapterRegistry } from "../adapters/index.js";
import { CouncilDatabase } from "../db/index.js";
import { getGlobalConfigPath, getProjectConfigPath } from "../utils/path.js";
import { resolveWorkingDirectory } from "./common.js";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Validate binaries, auth status, config, and DB")
    .option("--cwd <cwd>", "Working directory", process.cwd())
    .action(async (options: { cwd?: string }) => {
      const cwd = resolveWorkingDirectory(options.cwd);
      const config = loadConfig(cwd);
      const registry = createAdapterRegistry(config);

      console.log("Council doctor\n");

      const globalConfigPath = getGlobalConfigPath();
      const localConfigPath = getProjectConfigPath(cwd);
      console.log(`Global config: ${globalConfigPath} (${fs.existsSync(globalConfigPath) ? "found" : "missing"})`);
      console.log(`Project config: ${localConfigPath} (${fs.existsSync(localConfigPath) ? "found" : "missing"})`);

      const db = new CouncilDatabase();
      db.close();
      console.log("Database: ok\n");

      console.log("Adapters:");
      for (const [agent, adapter] of Object.entries(registry.cliAdapters)) {
        const auth = await adapter.authStatus();
        const capabilities = adapter.capabilities();
        console.log(`- ${agent}: ${auth.ok ? "ok" : "not ok"}`);
        console.log(`  detail: ${auth.detail}`);
        console.log(
          `  capabilities: hard_read_only=${capabilities.supportsHardReadOnly}, streaming=${capabilities.supportsStreaming}, usage=${capabilities.supportsUsageStats}, auth=${capabilities.supportsAuthStatus}`
        );
      }
    });
}
