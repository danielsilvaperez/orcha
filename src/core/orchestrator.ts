import crypto from "node:crypto";
import type {
  AgentAdapter,
  AgentExecutionEvent,
  AgentId,
  AgentResult,
  OrchaConfig,
  RunMode,
  RunRequest,
  RunResult,
  UsageStats
} from "../types.js";
import type { OrchaDatabase } from "../db/index.js";
import type { AdapterRegistry } from "../adapters/factory.js";
import { runSynthesis } from "./synthesizer.js";

export interface OrchestratorDependencies {
  config: OrchaConfig;
  adapters: AdapterRegistry;
  db: OrchaDatabase;
}

export interface RunHooks {
  onEvent?: (event: AgentExecutionEvent) => void;
}

interface AttemptResult {
  status: AgentResult["status"];
  finalText: string;
  rawOutput: string;
  usage?: UsageStats;
  error?: string;
  diagnostics: string[];
  startedAt: string;
  endedAt: string;
  durationMs: number;
}

export class OrchaOrchestrator {
  constructor(private readonly deps: OrchestratorDependencies) {}

  getCliAdapter(agent: AgentId): AgentAdapter | undefined {
    return this.deps.adapters.cliAdapters[agent];
  }

  async runCommittee(request: RunRequest, hooks?: RunHooks): Promise<RunResult> {
    const now = new Date().toISOString();
    const mode: RunMode = request.mode ?? "committee";
    const sessionId = request.sessionId ?? crypto.randomUUID();
    const runId = crypto.randomUUID();

    if (!request.sessionId) {
      this.deps.db.createSession(sessionId, mode, request.cwd);
    }

    this.deps.db.createRun(runId, sessionId, mode, request);

    const startedAt = Date.now();

    const tasks = request.agents.map(async (agent) => {
      const result = await this.executeAgent(runId, agent, request, hooks);
      this.deps.db.saveResponse(runId, result);
      return result;
    });

    const results = await Promise.all(tasks);

    let synthesis: string | undefined;
    let disagreements: string[] = [];

    if (request.synthesis) {
      const judgeAdapter = this.deps.adapters.cliAdapters[request.judgeAgent];
      if (!judgeAdapter) {
        synthesis = `Judge adapter ${request.judgeAgent} is not available.`;
      } else {
        try {
          const output = await runSynthesis({
            originalPrompt: request.prompt,
            results,
            judgeAdapter,
            cwd: request.cwd,
            timeoutMs: request.timeoutMs,
            safetyPolicy: this.deps.config.defaults.safetyPolicy
          });
          synthesis = output.synthesis;
          disagreements = output.disagreements;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          synthesis = `Synthesis failed: ${message}`;
        }
      }
    }

    const endedAt = new Date().toISOString();
    const runResult: RunResult = {
      runId,
      sessionId,
      results,
      synthesis,
      disagreements,
      durationMs: Date.now() - startedAt,
      startedAt: now,
      endedAt
    };

    this.deps.db.finalizeRun(runResult);
    return runResult;
  }

  private emitEvent(
    runId: string,
    agent: AgentId,
    source: AgentAdapter["source"],
    event: AgentExecutionEvent["event"],
    hooks?: RunHooks
  ): void {
    hooks?.onEvent?.({ runId, agent, source, event });
    this.deps.db.appendEvent(runId, agent, source, event);
  }

  private async runAdapterAttempt(
    runId: string,
    adapter: AgentAdapter,
    request: RunRequest,
    hooks?: RunHooks
  ): Promise<AttemptResult> {
    const startedAtDate = new Date();
    const startedAt = startedAtDate.toISOString();
    let finalText = "";
    let rawOutput = "";
    const diagnostics: string[] = [];
    let usage: UsageStats | undefined;
    let error: string | undefined;
    let status: AgentResult["status"] = "success";

    const timeoutMs = request.timeoutMs;
    const controller = new AbortController();
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      for await (const event of adapter.run({
        prompt: request.prompt,
        cwd: request.cwd,
        timeoutMs,
        safetyPolicy: this.deps.config.defaults.safetyPolicy,
        model: this.deps.config.agents[adapter.id].model,
        signal: controller.signal
      })) {
        this.emitEvent(runId, adapter.id, adapter.source, event, hooks);

        switch (event.type) {
          case "delta":
            finalText += event.text;
            break;
          case "final":
            finalText = event.text;
            rawOutput = event.rawOutput;
            usage = event.usage ?? usage;
            break;
          case "usage":
            usage = {
              ...usage,
              ...event.usage
            };
            break;
          case "diagnostic":
            diagnostics.push(event.line);
            break;
          case "error":
            error = event.error;
            status = "failed";
            break;
          default:
            break;
        }
      }
    } catch (caught) {
      if (timedOut) {
        status = "timed_out";
        error = `Timed out after ${timeoutMs} ms`;
      } else {
        status = "failed";
        error = caught instanceof Error ? caught.message : String(caught);
      }
    } finally {
      clearTimeout(timeout);
    }

    if (timedOut) {
      status = "timed_out";
      error = `Timed out after ${timeoutMs} ms`;
      this.emitEvent(runId, adapter.id, adapter.source, { type: "status", status: "timed_out", detail: error }, hooks);
    }

    if (!timedOut && !error) {
      this.emitEvent(runId, adapter.id, adapter.source, { type: "status", status: "success" }, hooks);
    }

    const endedAtDate = new Date();
    return {
      status,
      finalText,
      rawOutput,
      usage,
      error,
      diagnostics,
      startedAt,
      endedAt: endedAtDate.toISOString(),
      durationMs: endedAtDate.getTime() - startedAtDate.getTime()
    };
  }

  private async executeAgent(
    runId: string,
    agentId: AgentId,
    request: RunRequest,
    hooks?: RunHooks
  ): Promise<AgentResult> {
    const adapter = this.deps.adapters.cliAdapters[agentId];
    if (!adapter) {
      const now = new Date().toISOString();
      return {
        agent: agentId,
        status: "skipped",
        finalText: "",
        rawOutput: "",
        source: "cli",
        error: `No CLI adapter found for ${agentId}`,
        diagnostics: [],
        startedAt: now,
        endedAt: now,
        durationMs: 0
      };
    }

    const firstAttempt = await this.runAdapterAttempt(runId, adapter, request, hooks);

    if (
      firstAttempt.status !== "success" &&
      request.allowApiFallback &&
      this.deps.config.defaults.allowApiFallback &&
      this.deps.adapters.apiFallbackAdapters[agentId]
    ) {
      const fallback = this.deps.adapters.apiFallbackAdapters[agentId] as AgentAdapter;
      const fallbackAttempt = await this.runAdapterAttempt(runId, fallback, request, hooks);

      if (fallbackAttempt.status === "success") {
        return {
          agent: agentId,
          status: "success",
          finalText: fallbackAttempt.finalText,
          rawOutput: fallbackAttempt.rawOutput,
          usage: fallbackAttempt.usage,
          source: fallback.source,
          diagnostics: [...firstAttempt.diagnostics, ...fallbackAttempt.diagnostics],
          error: undefined,
          startedAt: firstAttempt.startedAt,
          endedAt: fallbackAttempt.endedAt,
          durationMs: firstAttempt.durationMs + fallbackAttempt.durationMs
        };
      }

      return {
        agent: agentId,
        status: fallbackAttempt.status,
        finalText: fallbackAttempt.finalText,
        rawOutput: fallbackAttempt.rawOutput,
        usage: fallbackAttempt.usage,
        source: fallback.source,
        diagnostics: [...firstAttempt.diagnostics, ...fallbackAttempt.diagnostics],
        error: `${firstAttempt.error ?? "CLI failure"}; fallback failed: ${fallbackAttempt.error ?? "unknown"}`,
        startedAt: firstAttempt.startedAt,
        endedAt: fallbackAttempt.endedAt,
        durationMs: firstAttempt.durationMs + fallbackAttempt.durationMs
      };
    }

    return {
      agent: agentId,
      status: firstAttempt.status,
      finalText: firstAttempt.finalText,
      rawOutput: firstAttempt.rawOutput,
      usage: firstAttempt.usage,
      source: adapter.source,
      error: firstAttempt.error,
      diagnostics: firstAttempt.diagnostics,
      startedAt: firstAttempt.startedAt,
      endedAt: firstAttempt.endedAt,
      durationMs: firstAttempt.durationMs
    };
  }
}
