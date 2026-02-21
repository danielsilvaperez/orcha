export type AgentId = "codex" | "claude" | "gemini" | "kimi";

export type RunMode = "committee" | "workflow";

export type SafetyPolicy = "best_effort_read_only" | "strict";

export type AgentStatus = "starting" | "running" | "success" | "failed" | "timed_out" | "skipped";

export type ResponseSource = "cli" | "api";

export interface UsageStats {
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
}

export interface AdapterCapabilities {
  supportsHardReadOnly: boolean;
  supportsStreaming: boolean;
  supportsUsageStats: boolean;
  supportsAuthStatus: boolean;
}

export interface AuthStatus {
  ok: boolean;
  detail: string;
}

export type AgentEvent =
  | { type: "status"; status: AgentStatus; detail?: string }
  | { type: "delta"; text: string }
  | { type: "usage"; usage: UsageStats }
  | { type: "diagnostic"; line: string }
  | { type: "error"; error: string }
  | { type: "final"; text: string; rawOutput: string; usage?: UsageStats };

export interface AdapterRunRequest {
  prompt: string;
  cwd: string;
  timeoutMs: number;
  safetyPolicy: SafetyPolicy;
  model?: string;
  signal?: AbortSignal;
}

export interface AgentAdapter {
  id: AgentId;
  source: ResponseSource;
  capabilities(): AdapterCapabilities;
  authStatus(): Promise<AuthStatus>;
  run(request: AdapterRunRequest): AsyncIterable<AgentEvent>;
}

export interface RunRequest {
  prompt: string;
  agents: AgentId[];
  cwd: string;
  synthesis: boolean;
  judgeAgent: AgentId;
  timeoutMs: number;
  allowApiFallback: boolean;
  sessionId?: string;
  mode?: RunMode;
}

export interface AgentResult {
  agent: AgentId;
  status: "success" | "failed" | "timed_out" | "skipped";
  finalText: string;
  rawOutput: string;
  usage?: UsageStats;
  source: ResponseSource;
  error?: string;
  diagnostics: string[];
  startedAt: string;
  endedAt: string;
  durationMs: number;
}

export interface RunResult {
  runId: string;
  sessionId: string;
  results: AgentResult[];
  synthesis?: string;
  disagreements: string[];
  durationMs: number;
  startedAt: string;
  endedAt: string;
}

export interface AgentExecutionEvent {
  runId: string;
  agent: AgentId;
  source: ResponseSource;
  event: AgentEvent;
}

export interface CouncilAgentConfig {
  enabled: boolean;
  model?: string;
  timeoutMs?: number;
  cliPath?: string;
}

export interface ApiProviderConfig {
  enabled: boolean;
  model?: string;
  baseUrl?: string;
  apiKeyEnv: string;
}

export interface CouncilConfig {
  version: 1;
  defaults: {
    judgeAgent: AgentId;
    synthesis: boolean;
    timeoutMs: number;
    safetyPolicy: SafetyPolicy;
    outputMode: "raw_plus_synthesis" | "raw_only" | "synthesis_only";
    allowApiFallback: boolean;
  };
  agents: Record<AgentId, CouncilAgentConfig>;
  apiFallback: {
    openai: ApiProviderConfig;
    anthropic: ApiProviderConfig;
    google: ApiProviderConfig;
    moonshot: ApiProviderConfig;
  };
}

export interface WorkflowStage {
  id: string;
  role: "planner" | "researcher" | "critic" | "synthesizer" | string;
  agent: AgentId;
  promptTemplate: string;
  timeoutMs?: number;
  onFailure?: "abort" | "continue";
}

export interface WorkflowSpec {
  name: string;
  version: 1;
  stages: WorkflowStage[];
}
