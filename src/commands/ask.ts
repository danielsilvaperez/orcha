import type { Command } from "commander";
import { loadConfig } from "../config/load.js";
import { createAdapterRegistry } from "../adapters/index.js";
import { OrchaDatabase } from "../db/index.js";
import { OrchaOrchestrator } from "../core/index.js";
import { addCommonRunOptions, parseAgentList, resolveAgents, resolveWorkingDirectory, type RunCliOptions } from "./common.js";
import { printRunResultHuman } from "./output.js";

export async function runAskPrompt(prompt: string, options: RunCliOptions): Promise<void> {
  if (!prompt) {
    throw new Error("Prompt is required.");
  }

  const cwd = resolveWorkingDirectory(options.cwd);
  const explicitAgents = parseAgentList(options.agents);
  const timeoutMs = options.timeoutMs ? Number(options.timeoutMs) : undefined;

  const config = loadConfig(cwd, {
    timeoutMs,
    allowApiFallback: options.allowApiFallback ? true : undefined,
    synthesis: options.synthesis,
    judgeAgent: options.judgeAgent,
    agents: explicitAgents
  });

  const agents = resolveAgents(config, explicitAgents);

  const db = new OrchaDatabase();
  try {
    const registry = createAdapterRegistry(config);
    const orchestrator = new OrchaOrchestrator({
      config,
      adapters: registry,
      db
    });

    const runResult = await orchestrator.runCommittee({
      prompt,
      agents,
      cwd,
      synthesis: options.synthesis ?? config.defaults.synthesis,
      judgeAgent: (options.judgeAgent ?? config.defaults.judgeAgent) as typeof config.defaults.judgeAgent,
      timeoutMs: timeoutMs ?? config.defaults.timeoutMs,
      allowApiFallback: options.allowApiFallback ?? config.defaults.allowApiFallback
    });

    if (options.json) {
      console.log(JSON.stringify(runResult, null, 2));
      return;
    }

    printRunResultHuman(runResult);
  } finally {
    db.close();
  }
}

export function registerAskCommand(program: Command): void {
  addCommonRunOptions(program.command("ask").description("Run one-shot committee mode").argument("<prompt...>", "Prompt to send"))
    .action(async (promptParts: string[], options: RunCliOptions) => {
      await runAskPrompt(promptParts.join(" ").trim(), options);
    });
}
