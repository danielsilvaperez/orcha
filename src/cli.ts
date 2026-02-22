import { Command } from "commander";
import {
  launchTui,
  registerAskCommand,
  registerDoctorCommand,
  registerInitCommand,
  registerReplCommand,
  registerSpeedrunCommand,
  registerTuiCommand,
  registerWorkflowCommand
} from "./commands/index.js";

async function main(): Promise<void> {
  const program = new Command();

  program.name("orcha").description("Multi-agent project orchestration CLI").version("0.1.0");

  registerAskCommand(program);
  registerReplCommand(program);
  registerDoctorCommand(program);
  registerInitCommand(program);
  registerWorkflowCommand(program);
  registerSpeedrunCommand(program);
  registerTuiCommand(program);

  if (process.argv.length === 2) {
    await launchTui(process.cwd());
    return;
  }

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[orcha] ${message}`);
  process.exit(1);
});
