import crypto from "node:crypto";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { Command } from "commander";
import { loadConfig } from "../config/load.js";
import { createAdapterRegistry } from "../adapters/index.js";
import { CouncilDatabase } from "../db/index.js";
import { CouncilOrchestrator } from "../core/index.js";
import { addCommonRunOptions, parseAgentList, resolveAgents, resolveWorkingDirectory, type RunCliOptions } from "./common.js";
import { printRunResultHuman } from "./output.js";

export function registerReplCommand(program: Command): void {
  addCommonRunOptions(program.command("repl").description("Start interactive committee REPL")).action(
    async (options: RunCliOptions) => {
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

      const db = new CouncilDatabase();
      const sessionId = crypto.randomUUID();
      db.createSession(sessionId, "committee", cwd);

      const registry = createAdapterRegistry(config);
      const orchestrator = new CouncilOrchestrator({ config, adapters: registry, db });

      const rl = readline.createInterface({ input, output });
      console.log("Council REPL started. Type ':q' to quit.");

      try {
        while (true) {
          const prompt = (await rl.question("you> ")).trim();
          if (!prompt) {
            continue;
          }
          if (prompt === ":q" || prompt === ":quit" || prompt === ":exit") {
            break;
          }

          const runResult = await orchestrator.runCommittee({
            prompt,
            agents,
            cwd,
            synthesis: options.synthesis ?? config.defaults.synthesis,
            judgeAgent: (options.judgeAgent ?? config.defaults.judgeAgent) as typeof config.defaults.judgeAgent,
            timeoutMs: timeoutMs ?? config.defaults.timeoutMs,
            allowApiFallback: options.allowApiFallback ?? config.defaults.allowApiFallback,
            sessionId
          });

          if (options.json) {
            console.log(JSON.stringify(runResult, null, 2));
          } else {
            printRunResultHuman(runResult);
          }
        }
      } finally {
        rl.close();
        db.close();
      }
    }
  );
}
