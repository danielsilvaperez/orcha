import { render } from "ink";
import React from "react";
import type { Command } from "commander";
import { loadConfig } from "../config/load.js";
import { createAdapterRegistry } from "../adapters/index.js";
import { CouncilDatabase } from "../db/index.js";
import { CouncilOrchestrator } from "../core/index.js";
import { resolveWorkingDirectory } from "./common.js";
import { CouncilApp } from "../tui/CouncilApp.js";

export async function launchTui(cwdInput?: string): Promise<void> {
  const cwd = resolveWorkingDirectory(cwdInput);
  const config = loadConfig(cwd);
  const registry = createAdapterRegistry(config);
  const db = new CouncilDatabase();
  const orchestrator = new CouncilOrchestrator({ config, adapters: registry, db });

  const instance = render(React.createElement(CouncilApp, { config, orchestrator, cwd }));

  try {
    await instance.waitUntilExit();
  } finally {
    db.close();
  }
}

export function registerTuiCommand(program: Command): void {
  program
    .command("tui")
    .description("Launch full-screen TUI")
    .option("--cwd <cwd>", "Working directory", process.cwd())
    .action(async (options: { cwd?: string }) => {
      await launchTui(options.cwd);
    });
}
