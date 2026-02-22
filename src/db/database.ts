import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import BetterSqlite3 from "better-sqlite3";
import type { AgentEvent, AgentResult, RunMode, RunRequest, RunResult, WorkflowSpec } from "../types.js";
import type { SpeedrunResult, TaskResult } from "../speedrun/types.js";
import { getDbPath } from "../utils/path.js";
import { runMigrations } from "./migrations.js";

export class OrchaDatabase {
  private readonly db: BetterSqlite3.Database;

  constructor(dbPath: string = getDbPath()) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new BetterSqlite3(dbPath);
    runMigrations(this.db);
  }

  close(): void {
    this.db.close();
  }

  createSession(id: string, mode: RunMode, cwd: string): void {
    this.db
      .prepare(
        `INSERT INTO sessions (id, mode, cwd, created_at) VALUES (@id, @mode, @cwd, @created_at)`
      )
      .run({ id, mode, cwd, created_at: new Date().toISOString() });
  }

  createRun(runId: string, sessionId: string, mode: RunMode, request: RunRequest): void {
    this.db
      .prepare(
        `INSERT INTO runs (
          id, session_id, mode, prompt, synthesis, judge_agent, timeout_ms, allow_api_fallback,
          cwd, status, started_at
        ) VALUES (
          @id, @session_id, @mode, @prompt, @synthesis, @judge_agent, @timeout_ms, @allow_api_fallback,
          @cwd, @status, @started_at
        )`
      )
      .run({
        id: runId,
        session_id: sessionId,
        mode,
        prompt: request.prompt,
        synthesis: request.synthesis ? 1 : 0,
        judge_agent: request.judgeAgent,
        timeout_ms: request.timeoutMs,
        allow_api_fallback: request.allowApiFallback ? 1 : 0,
        cwd: request.cwd,
        status: "running",
        started_at: new Date().toISOString()
      });
  }

  appendEvent(runId: string, agent: string, source: string, event: AgentEvent): void {
    this.db
      .prepare(
        `INSERT INTO events (run_id, agent, source, event_type, payload_json, created_at)
         VALUES (@run_id, @agent, @source, @event_type, @payload_json, @created_at)`
      )
      .run({
        run_id: runId,
        agent,
        source,
        event_type: event.type,
        payload_json: JSON.stringify(event),
        created_at: new Date().toISOString()
      });
  }

  saveResponse(runId: string, result: AgentResult): void {
    this.db
      .prepare(
        `INSERT INTO responses (
          id, run_id, agent, status, source, final_text, raw_output, diagnostics_json, error,
          input_tokens, output_tokens, cost_usd, started_at, ended_at, duration_ms
        ) VALUES (
          @id, @run_id, @agent, @status, @source, @final_text, @raw_output, @diagnostics_json, @error,
          @input_tokens, @output_tokens, @cost_usd, @started_at, @ended_at, @duration_ms
        )`
      )
      .run({
        id: crypto.randomUUID(),
        run_id: runId,
        agent: result.agent,
        status: result.status,
        source: result.source,
        final_text: result.finalText,
        raw_output: result.rawOutput,
        diagnostics_json: JSON.stringify(result.diagnostics),
        error: result.error ?? null,
        input_tokens: result.usage?.inputTokens ?? null,
        output_tokens: result.usage?.outputTokens ?? null,
        cost_usd: result.usage?.costUsd ?? null,
        started_at: result.startedAt,
        ended_at: result.endedAt,
        duration_ms: result.durationMs
      });
  }

  finalizeRun(runResult: RunResult): void {
    this.db
      .prepare(
        `UPDATE runs
         SET status = @status,
             ended_at = @ended_at,
             duration_ms = @duration_ms,
             synthesis_text = @synthesis_text,
             disagreements_json = @disagreements_json
         WHERE id = @id`
      )
      .run({
        id: runResult.runId,
        status: "completed",
        ended_at: runResult.endedAt,
        duration_ms: runResult.durationMs,
        synthesis_text: runResult.synthesis ?? null,
        disagreements_json: JSON.stringify(runResult.disagreements)
      });
  }

  saveWorkflow(spec: WorkflowSpec): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO workflows (id, name, version, spec_yaml, created_at, updated_at)
         VALUES (@id, @name, @version, @spec_yaml, @created_at, @updated_at)
         ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         version = excluded.version,
         spec_yaml = excluded.spec_yaml,
         updated_at = excluded.updated_at`
      )
      .run({
        id: spec.name,
        name: spec.name,
        version: spec.version,
        spec_yaml: JSON.stringify(spec),
        created_at: now,
        updated_at: now
      });
  }

  saveSpeedrun(result: SpeedrunResult): void {
    const speedrunId = crypto.randomUUID();

    this.db
      .prepare(
        `INSERT INTO speedruns (
          id, scaffold_name, project_name, final_output, files_created_json,
          duration_ms, started_at, ended_at
        ) VALUES (
          @id, @scaffold_name, @project_name, @final_output, @files_created_json,
          @duration_ms, @started_at, @ended_at
        )`
      )
      .run({
        id: speedrunId,
        scaffold_name: result.scaffoldName,
        project_name: result.projectName,
        final_output: result.finalOutput,
        files_created_json: JSON.stringify(result.filesCreated),
        duration_ms: result.durationMs,
        started_at: result.startedAt,
        ended_at: result.endedAt
      });

    const taskStmt = this.db.prepare(
      `INSERT INTO speedrun_tasks (
        id, speedrun_id, task_id, agent, status, output, files_created_json, error,
        started_at, ended_at, duration_ms
      ) VALUES (
        @id, @speedrun_id, @task_id, @agent, @status, @output, @files_created_json, @error,
        @started_at, @ended_at, @duration_ms
      )`
    );

    for (const task of result.taskResults) {
      taskStmt.run({
        id: crypto.randomUUID(),
        speedrun_id: speedrunId,
        task_id: task.taskId,
        agent: task.agent,
        status: task.status,
        output: task.output,
        files_created_json: JSON.stringify(task.filesCreated),
        error: task.error ?? null,
        started_at: task.startedAt,
        ended_at: task.endedAt,
        duration_ms: task.durationMs
      });
    }
  }
}
