import type { AgentId } from "../types.js";

export type TaskStatus = "pending" | "running" | "success" | "failed" | "skipped";

export interface ScaffoldTask {
  id: string;
  name: string;
  description: string;
  agent: AgentId;
  dependsOn: string[];
  promptTemplate: string;
  timeoutMs?: number;
  allowSubagents: boolean;
  maxSubagents?: number;
  outputFiles?: string[];
  mergeStrategy?: "concat" | "synthesize" | "replace";
}

export interface ScaffoldSpec {
  name: string;
  version: 1;
  description: string;
  tags: string[];
  tasks: ScaffoldTask[];
  finalMergeAgent: AgentId;
  finalMergePrompt: string;
}

export interface TaskResult {
  taskId: string;
  agent: AgentId;
  status: TaskStatus;
  output: string;
  filesCreated: string[];
  subagentResults?: SubagentResult[];
  startedAt: string;
  endedAt: string;
  durationMs: number;
  error?: string;
}

export interface SubagentResult {
  subagentId: string;
  task: string;
  output: string;
  status: "success" | "failed";
}

export interface SpeedrunRequest {
  scaffoldName: string;
  projectName: string;
  description: string;
  cwd: string;
  agents: AgentId[];
  timeoutMs: number;
  allowApiFallback: boolean;
  maxParallelTasks: number;
  variables: Record<string, string>;
}

export interface SpeedrunResult {
  scaffoldName: string;
  projectName: string;
  taskResults: TaskResult[];
  finalOutput: string;
  filesCreated: string[];
  durationMs: number;
  startedAt: string;
  endedAt: string;
}

export interface TaskGraph {
  tasks: Map<string, ScaffoldTask>;
  dependencies: Map<string, Set<string>>;
  dependents: Map<string, Set<string>>;
}

export interface ParallelBatch {
  level: number;
  tasks: string[];
}
