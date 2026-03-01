import fs from "node:fs";
import path from "node:path";
import type { Command } from "commander";
import { defaultConfig } from "../config/defaults.js";
import { ensureConfigDirExists, toToml } from "../config/load.js";
import { getGlobalConfigPath, getProjectConfigPath, getWorkflowDir } from "../utils/path.js";

const sampleWorkflow = `name: sample
version: 1
stages:
  - id: planner
    role: planner
    agent: codex
    promptTemplate: |
      You are planning a project.
      User goal: {{input}}
      Produce an implementation plan.
    timeoutMs: 120000
    onFailure: abort
  - id: critic
    role: critic
    agent: claude
    promptTemplate: |
      Critique this plan and improve it:
      {{stage.planner.output}}
    timeoutMs: 120000
    onFailure: continue
`;

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Bootstrap global and optional local orcha config")
    .option("--with-local", "Also create project .orcha.toml")
    .option("--force", "Overwrite existing config files")
    .action((options: { withLocal?: boolean; force?: boolean }) => {
      const globalConfigPath = getGlobalConfigPath();
      ensureConfigDirExists(globalConfigPath);

      if (!fs.existsSync(globalConfigPath) || options.force) {
        fs.writeFileSync(globalConfigPath, toToml(defaultConfig), "utf8");
        console.log(`Wrote ${globalConfigPath}`);
      } else {
        console.log(`Skipped ${globalConfigPath} (already exists)`);
      }

      if (options.withLocal) {
        const localConfigPath = getProjectConfigPath(process.cwd());
        if (!fs.existsSync(localConfigPath) || options.force) {
          fs.writeFileSync(localConfigPath, toToml(defaultConfig), "utf8");
          console.log(`Wrote ${localConfigPath}`);
        } else {
          console.log(`Skipped ${localConfigPath} (already exists)`);
        }
      }

      const workflowDir = getWorkflowDir(process.cwd());
      fs.mkdirSync(workflowDir, { recursive: true });
      const samplePath = path.join(workflowDir, "sample.yaml");
      if (!fs.existsSync(samplePath) || options.force) {
        fs.writeFileSync(samplePath, sampleWorkflow, "utf8");
        console.log(`Wrote ${samplePath}`);
      } else {
        console.log(`Skipped ${samplePath} (already exists)`);
      }
    });
}
