import type { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../config/load.js";
import { createAdapterRegistry } from "../adapters/index.js";
import { OrchaDatabase } from "../db/index.js";
import { SpeedrunEngine } from "../speedrun/index.js";
import { getScaffold, listScaffolds } from "../scaffolds/index.js";
import type { AgentId } from "../types.js";
import { resolveWorkingDirectory } from "./common.js";

interface SpeedrunCliOptions {
  cwd?: string;
  agents?: string;
  timeoutMs?: string;
  allowApiFallback?: boolean;
  maxParallel?: string;
  json?: boolean;
  var?: string[];
  name?: string;
  description?: string;
}

export function registerSpeedrunCommand(program: Command): void {
  const speedrun = program
    .command("speedrun")
    .description("Execute parallel multi-agent project scaffolding");

  // List available scaffolds
  speedrun
    .command("list")
    .description("List available project scaffolds")
    .action(() => {
      const scaffolds = listScaffolds();
      console.log("\n📦 Available Scaffolds:\n");
      for (const scaffold of scaffolds) {
        console.log(`  ${scaffold.name}`);
        console.log(`    ${scaffold.description}`);
        console.log(`    Tags: ${scaffold.tags.join(", ")}`);
        console.log(`    Tasks: ${scaffold.tasks.length}`);
        console.log();
      }
    });

  // Show scaffold details
  speedrun
    .command("show")
    .description("Show scaffold details and task graph")
    .argument("<name>", "Scaffold name")
    .action((name: string) => {
      const scaffold = getScaffold(name);
      if (!scaffold) {
        console.error(`❌ Scaffold '${name}' not found`);
        process.exit(1);
      }

      console.log(`\n📋 ${scaffold.name}`);
      console.log(`   ${scaffold.description}\n`);
      console.log(`   Tags: ${scaffold.tags.join(", ")}`);
      console.log(`   Final merge: ${scaffold.finalMergeAgent}\n`);

      console.log("   Tasks:\n");

      // Build dependency graph
      const deps = new Map<string, Set<string>>();
      for (const task of scaffold.tasks) {
        deps.set(task.id, new Set(task.dependsOn));
      }

      // Find execution levels
      const completed = new Set<string>();
      const remaining = new Set(scaffold.tasks.map((t) => t.id));
      let level = 0;

      while (remaining.size > 0) {
        const batch: string[] = [];
        for (const taskId of remaining) {
          const taskDeps = deps.get(taskId)!;
          const allDone = Array.from(taskDeps).every((d) => completed.has(d));
          if (allDone) {
            batch.push(taskId);
          }
        }

        console.log(`   Level ${level} (parallel):`);
        for (const taskId of batch) {
          const task = scaffold.tasks.find((t) => t.id === taskId)!;
          const agent = task.agent;
          const subagentInfo = task.allowSubagents ? ` (subagents: ${task.maxSubagents || "∞"})` : "";
          console.log(`     ▶️  ${task.name} [${agent}]${subagentInfo}`);
          if (task.dependsOn.length > 0) {
            console.log(`        depends on: ${task.dependsOn.join(", ")}`);
          }
        }
        console.log();

        for (const taskId of batch) {
          completed.add(taskId);
          remaining.delete(taskId);
        }
        level++;
      }
    });

  // Run a scaffold
  speedrun
    .command("run")
    .description("Run a scaffold to generate a project")
    .argument("<scaffold>", "Scaffold name")
    .requiredOption("-n, --name <name>", "Project name")
    .requiredOption("-d, --description <description>", "Project description")
    .option("-c, --cwd <path>", "Working directory", process.cwd())
    .option("-a, --agents <agents>", "Comma-separated agents to use (default: all)")
    .option("-t, --timeoutMs <ms>", "Timeout per task in milliseconds", "300000")
    .option("--allow-api-fallback", "Allow API fallback if CLI fails", false)
    .option("-p, --max-parallel <n>", "Maximum parallel tasks", "10")
    .option("--json", "Output as JSON")
    .option("-v, --var <vars...>", "Additional variables (key=value)")
    .action(async (scaffoldName: string, options: SpeedrunCliOptions) => {
      const scaffold = getScaffold(scaffoldName);
      if (!scaffold) {
        console.error(`❌ Scaffold '${scaffoldName}' not found`);
        console.log("\nRun 'orcha speedrun list' to see available scaffolds.");
        process.exit(1);
      }

      const cwd = resolveWorkingDirectory(options.cwd);
      const projectPath = path.join(cwd, options.name!);

      // Create project directory
      if (!fs.existsSync(projectPath)) {
        fs.mkdirSync(projectPath, { recursive: true });
      }

      // Parse agents
      let agents: AgentId[] = ["codex", "claude", "gemini", "kimi"];
      if (options.agents) {
        agents = options.agents.split(",").map((a) => a.trim() as AgentId);
      }

      // Parse variables
      const variables: Record<string, string> = {};
      if (options.var) {
        for (const v of options.var) {
          const [key, ...valueParts] = v.split("=");
          if (key && valueParts.length > 0) {
            variables[key] = valueParts.join("=");
          }
        }
      }

      const config = loadConfig(cwd, {
        timeoutMs: parseInt(options.timeoutMs || "300000"),
        allowApiFallback: options.allowApiFallback,
        agents
      });

      const db = new OrchaDatabase();

      try {
        const registry = createAdapterRegistry(config);
        const engine = new SpeedrunEngine({ config, adapters: registry, db });

        const result = await engine.execute(scaffold, {
          scaffoldName,
          projectName: options.name!,
          description: options.description!,
          cwd: projectPath,
          agents,
          timeoutMs: parseInt(options.timeoutMs || "300000"),
          allowApiFallback: options.allowApiFallback || false,
          maxParallelTasks: parseInt(options.maxParallel || "10"),
          variables
        });

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        // Human readable output
        console.log("\n" + "=".repeat(60));
        console.log(`✅ Speedrun Complete: ${result.projectName}`);
        console.log("=".repeat(60));
        console.log(`\n📊 Summary:`);
        console.log(`   Scaffold: ${result.scaffoldName}`);
        console.log(`   Total Duration: ${(result.durationMs / 1000).toFixed(1)}s`);
        console.log(`   Tasks Completed: ${result.taskResults.filter((r) => r.status === "success").length}/${result.taskResults.length}`);

        if (result.filesCreated.length > 0) {
          console.log(`\n📁 Files Created:`);
          for (const file of result.filesCreated) {
            console.log(`   - ${file}`);
          }
        }

        console.log(`\n📄 Project Location: ${projectPath}`);
        console.log("\n📝 Final Integration Notes:");
        console.log(result.finalOutput.substring(0, 2000));
        if (result.finalOutput.length > 2000) {
          console.log("\n... (truncated, see full output in database)");
        }
      } finally {
        db.close();
      }
    });

  // Quick start - interactive scaffold selection
  speedrun
    .command("init")
    .description("Interactive scaffold selection and project creation")
    .argument("[project-name]", "Project name")
    .action(async (projectName?: string) => {
      const scaffolds = listScaffolds();

      console.log("\n🚀 Orcha Speedrun - Interactive Project Creation\n");

      if (!projectName) {
        console.log("Usage: orcha speedrun init <project-name>");
        console.log("\nAvailable scaffolds:\n");
        for (const scaffold of scaffolds) {
          console.log(`  ${scaffold.name.padEnd(20)} - ${scaffold.description}`);
        }
        console.log("\nExample:");
        console.log(`  orcha speedrun init my-app -- fullstack-app`);
        return;
      }

      // For now, just show available options
      console.log(`Creating project: ${projectName}\n`);
      console.log("Select a scaffold:\n");
      for (let i = 0; i < scaffolds.length; i++) {
        console.log(`  ${i + 1}. ${scaffolds[i].name}`);
        console.log(`     ${scaffolds[i].description}`);
      }
      console.log("\nRun:");
      console.log(`  orcha speedrun run <scaffold-name> -n ${projectName} -d "Your description"`);
    });
}
