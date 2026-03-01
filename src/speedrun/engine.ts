import crypto from "node:crypto";
import type { AgentAdapter, AgentId, OrchaConfig } from "../types.js";
import type { OrchaDatabase } from "../db/index.js";
import type { AdapterRegistry } from "../adapters/factory.js";
import {
  type ScaffoldSpec,
  type ScaffoldTask,
  type SpeedrunRequest,
  type SpeedrunResult,
  type TaskResult,
  type TaskGraph,
  type ParallelBatch,
  type TaskStatus
} from "./types.js";

export interface SpeedrunEngineDependencies {
  config: OrchaConfig;
  adapters: AdapterRegistry;
  db: OrchaDatabase;
}

export class SpeedrunEngine {
  private taskResults = new Map<string, TaskResult>();
  private runningTasks = new Map<string, AbortController>();

  constructor(private readonly deps: SpeedrunEngineDependencies) {}

  async execute(scaffold: ScaffoldSpec, request: SpeedrunRequest): Promise<SpeedrunResult> {
    const startedAt = Date.now();
    const startedAtISO = new Date(startedAt).toISOString();
    const sessionId = crypto.randomUUID();

    // Build dependency graph
    const graph = this.buildTaskGraph(scaffold.tasks);

    // Create parallel execution batches
    const batches = this.createParallelBatches(graph);

    console.log(`\n🚀 Starting Speedrun: ${request.projectName}`);
    console.log(`📋 Scaffold: ${scaffold.name}`);
    console.log(`📊 Total tasks: ${scaffold.tasks.length}`);
    console.log(`⚡ Parallel batches: ${batches.length}\n`);

    // Execute batches in order
    for (const batch of batches) {
      console.log(`\n📦 Executing batch ${batch.level} (${batch.tasks.length} tasks in parallel)`);

      const batchPromises = batch.tasks.map((taskId) =>
        this.executeTask(taskId, graph, request, sessionId)
      );

      const batchResults = await Promise.all(batchPromises);

      // Check for failures that should stop execution
      const failures = batchResults.filter((r) => r.status === "failed");
      if (failures.length > 0) {
        const criticalFailures = failures.filter((f) => {
          const task = graph.tasks.get(f.taskId)!;
          // Check if other tasks depend on this
          const dependents = graph.dependents.get(f.taskId) || new Set();
          return dependents.size > 0;
        });

        if (criticalFailures.length > 0) {
          console.log(`\n❌ Critical task failures detected. Stopping speedrun.`);
          break;
        }
      }
    }

    // Execute final merge
    const finalOutput = await this.executeFinalMerge(scaffold, request, sessionId);

    const endedAt = Date.now();
    const endedAtISO = new Date(endedAt).toISOString();

    const result: SpeedrunResult = {
      scaffoldName: scaffold.name,
      projectName: request.projectName,
      taskResults: Array.from(this.taskResults.values()),
      finalOutput,
      filesCreated: this.collectAllFiles(),
      durationMs: endedAt - startedAt,
      startedAt: startedAtISO,
      endedAt: endedAtISO
    };

    // Save to database
    this.deps.db.saveSpeedrun(result);

    return result;
  }

  private buildTaskGraph(tasks: ScaffoldTask[]): TaskGraph {
    const graph: TaskGraph = {
      tasks: new Map(),
      dependencies: new Map(),
      dependents: new Map()
    };

    // Index all tasks
    for (const task of tasks) {
      graph.tasks.set(task.id, task);
      graph.dependencies.set(task.id, new Set(task.dependsOn));
      graph.dependents.set(task.id, new Set());
    }

    // Build reverse dependency map
    for (const task of tasks) {
      for (const depId of task.dependsOn) {
        const dependents = graph.dependents.get(depId);
        if (dependents) {
          dependents.add(task.id);
        }
      }
    }

    return graph;
  }

  private createParallelBatches(graph: TaskGraph): ParallelBatch[] {
    const batches: ParallelBatch[] = [];
    const completed = new Set<string>();
    const remaining = new Set(graph.tasks.keys());
    let level = 0;

    while (remaining.size > 0) {
      const batchTasks: string[] = [];

      for (const taskId of remaining) {
        const deps = graph.dependencies.get(taskId)!;
        const allDepsCompleted = Array.from(deps).every((d) => completed.has(d));

        if (allDepsCompleted) {
          batchTasks.push(taskId);
        }
      }

      if (batchTasks.length === 0) {
        // Circular dependency or issue
        throw new Error(`Circular dependency detected or stuck tasks: ${Array.from(remaining).join(", ")}`);
      }

      batches.push({ level: level++, tasks: batchTasks });

      for (const taskId of batchTasks) {
        completed.add(taskId);
        remaining.delete(taskId);
      }
    }

    return batches;
  }

  private async executeTask(
    taskId: string,
    graph: TaskGraph,
    request: SpeedrunRequest,
    sessionId: string
  ): Promise<TaskResult> {
    const task = graph.tasks.get(taskId)!;
    const adapter = this.getAdapterForTask(task, request);

    if (!adapter) {
      const failedResult: TaskResult = {
        taskId,
        agent: task.agent,
        status: "failed",
        output: "",
        filesCreated: [],
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: 0,
        error: `No adapter available for agent: ${task.agent}`
      };
      this.taskResults.set(taskId, failedResult);
      return failedResult;
    }

    const controller = new AbortController();
    this.runningTasks.set(taskId, controller);

    const startedAt = Date.now();
    const startedAtISO = new Date(startedAt).toISOString();

    console.log(`  ▶️  Starting: ${task.name} (${task.agent})`);

    try {
      // Interpolate prompt with previous results
      const prompt = this.interpolatePrompt(task.promptTemplate, request, graph);

      // Add subagent instructions if enabled
      const finalPrompt = task.allowSubagents
        ? this.addSubagentInstructions(prompt, task)
        : prompt;

      let output = "";
      let filesCreated: string[] = [];

      for await (const event of adapter.run({
        prompt: finalPrompt,
        cwd: request.cwd,
        timeoutMs: task.timeoutMs ?? request.timeoutMs,
        safetyPolicy: this.deps.config.defaults.safetyPolicy,
        model: this.deps.config.agents[task.agent].model,
        signal: controller.signal
      })) {
        if (event.type === "delta") {
          output += event.text;
        }
        if (event.type === "final") {
          output = event.text;
          // Extract file mentions from output
          filesCreated = this.extractFileReferences(output, task.outputFiles);
        }
        if (event.type === "error") {
          throw new Error(event.error);
        }
      }

      const endedAt = Date.now();
      const result: TaskResult = {
        taskId,
        agent: task.agent,
        status: "success",
        output,
        filesCreated,
        startedAt: startedAtISO,
        endedAt: new Date(endedAt).toISOString(),
        durationMs: endedAt - startedAt
      };

      this.taskResults.set(taskId, result);
      console.log(`  ✅ Completed: ${task.name} (${result.durationMs}ms)`);

      return result;
    } catch (error) {
      const endedAt = Date.now();
      const errorMessage = error instanceof Error ? error.message : String(error);

      const result: TaskResult = {
        taskId,
        agent: task.agent,
        status: "failed",
        output: "",
        filesCreated: [],
        startedAt: startedAtISO,
        endedAt: new Date(endedAt).toISOString(),
        durationMs: endedAt - startedAt,
        error: errorMessage
      };

      this.taskResults.set(taskId, result);
      console.log(`  ❌ Failed: ${task.name} - ${errorMessage}`);

      return result;
    } finally {
      this.runningTasks.delete(taskId);
    }
  }

  private getAdapterForTask(task: ScaffoldTask, request: SpeedrunRequest): AgentAdapter | undefined {
    // Check if preferred agent is available
    if (request.agents.includes(task.agent)) {
      return this.deps.adapters.cliAdapters[task.agent];
    }

    // Fall back to any available agent
    for (const agent of request.agents) {
      const adapter = this.deps.adapters.cliAdapters[agent];
      if (adapter) return adapter;
    }

    return undefined;
  }

  private interpolatePrompt(
    template: string,
    request: SpeedrunRequest,
    graph: TaskGraph
  ): string {
    let result = template;

    // Replace basic variables
    result = result.replace(/\{\{projectName\}\}/g, request.projectName);
    result = result.replace(/\{\{description\}\}/g, request.description);

    // Replace custom variables
    for (const [key, value] of Object.entries(request.variables)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }

    // Replace stage outputs
    const stageRegex = /\{\{stage\.(\w+)\.output\}\}/g;
    let match;
    while ((match = stageRegex.exec(result)) !== null) {
      const stageId = match[1];
      const stageResult = this.taskResults.get(stageId);
      const replacement = stageResult?.output || "(pending)";
      result = result.replace(match[0], replacement);
    }

    return result;
  }

  private addSubagentInstructions(prompt: string, task: ScaffoldTask): string {
    const instructions = `

---
🔧 SUBAGENT DELEGATION ENABLED

You have access to subagent capabilities. For this task:
"${task.name}"

Break down your work and delegate to subagents when beneficial:
- Use subagents for parallel exploration of different approaches
- Delegate independent subtasks
- Use subagents to review or validate your work
- Maximum recommended subagents: ${task.maxSubagents || "unlimited"}

If you use subagents, document:
1. What you delegated to each subagent
2. The results they returned
3. How you integrated their work

Proceed with the task using your subagents strategically for maximum efficiency.
---

`;

    return instructions + prompt;
  }

  private extractFileReferences(output: string, expectedFiles?: string[]): string[] {
    const files: string[] = [];

    // Look for file paths in code blocks
    const fileRegex = /```\w*:\s*(.+?)(?:\n|$)/g;
    let match;
    while ((match = fileRegex.exec(output)) !== null) {
      files.push(match[1].trim());
    }

    // Look for explicit file mentions
    const pathRegex = /(?:file|path):\s*['"]?([\w/.-]+)['"]?/gi;
    while ((match = pathRegex.exec(output)) !== null) {
      files.push(match[1].trim());
    }

    // Add expected files if they seem to be created
    if (expectedFiles) {
      for (const file of expectedFiles) {
        if (!files.includes(file)) {
          files.push(file);
        }
      }
    }

    return [...new Set(files)];
  }

  private async executeFinalMerge(
    scaffold: ScaffoldSpec,
    request: SpeedrunRequest,
    sessionId: string
  ): Promise<string> {
    console.log(`\n🔄 Executing final merge with ${scaffold.finalMergeAgent}...`);

    const adapter = this.deps.adapters.cliAdapters[scaffold.finalMergeAgent];
    if (!adapter) {
      return "Final merge skipped: adapter not available";
    }

    // Build context from all task results
    const taskOutputs = Array.from(this.taskResults.entries())
      .map(([taskId, result]) => {
        const task = scaffold.tasks.find((t) => t.id === taskId);
        return `
=== ${task?.name || taskId} (${result.agent}) ===
Status: ${result.status}
Duration: ${result.durationMs}ms
Files: ${result.filesCreated.join(", ") || "none"}

Output:
${result.output}
`;
      })
      .join("\n\n---\n\n");

    const mergePrompt = `${scaffold.finalMergePrompt}

Project: ${request.projectName}
Description: ${request.description}

All Task Results:
${taskOutputs}`;

    let finalOutput = "";

    try {
      for await (const event of adapter.run({
        prompt: mergePrompt,
        cwd: request.cwd,
        timeoutMs: request.timeoutMs,
        safetyPolicy: this.deps.config.defaults.safetyPolicy,
        model: this.deps.config.agents[scaffold.finalMergeAgent].model
      })) {
        if (event.type === "delta") {
          finalOutput += event.text;
        }
        if (event.type === "final") {
          finalOutput = event.text;
        }
      }

      console.log(`✅ Final merge completed`);
      return finalOutput;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`❌ Final merge failed: ${message}`);
      return `Final merge failed: ${message}\n\nRaw task outputs:\n${taskOutputs}`;
    }
  }

  private collectAllFiles(): string[] {
    const allFiles = new Set<string>();
    for (const result of this.taskResults.values()) {
      for (const file of result.filesCreated) {
        allFiles.add(file);
      }
    }
    return Array.from(allFiles);
  }

  stop(): void {
    for (const [taskId, controller] of this.runningTasks) {
      console.log(`🛑 Stopping task: ${taskId}`);
      controller.abort();
    }
  }
}
