import type { Command } from "commander";
import { loadConfig } from "../config/load.js";
import { createAdapterRegistry } from "../adapters/index.js";
import { OrchaDatabase } from "../db/index.js";
import { OrchaOrchestrator } from "../core/index.js";
import { runWorkflow } from "../workflows/index.js";
import { addCommonRunOptions, parseAgentList, resolveWorkingDirectory, type RunCliOptions } from "./common.js";

export function registerWorkflowCommand(program: Command): void {
  const workflow = program.command("workflow").description("Run role-based workflow specs");

  addCommonRunOptions(
    workflow
      .command("run")
      .description("Run a workflow by name")
      .argument("<name>", "Workflow name")
      .requiredOption("--input <input>", "Initial workflow input")
  ).action(async (name: string, options: RunCliOptions & { input: string }) => {
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

    const db = new OrchaDatabase();

    try {
      const registry = createAdapterRegistry(config);
      const orchestrator = new OrchaOrchestrator({ config, adapters: registry, db });
      const result = await runWorkflow(orchestrator, {
        name,
        input: options.input,
        cwd,
        allowApiFallback: options.allowApiFallback ?? config.defaults.allowApiFallback
      });
      db.saveWorkflow(result.workflow);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(`Workflow: ${result.workflow.name}`);
      for (const [stage, output] of Object.entries(result.stageOutputs)) {
        console.log(`\n=== Stage ${stage} ===`);
        console.log(output || "(empty)");
      }
    } finally {
      db.close();
    }
  });
}
