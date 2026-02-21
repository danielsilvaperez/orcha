import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { runWorkflow } from "../../src/workflows/index.js";
import { CouncilOrchestrator } from "../../src/core/orchestrator.js";
import { CouncilDatabase } from "../../src/db/index.js";
import { defaultConfig } from "../../src/config/defaults.js";
import type { AdapterRunRequest, AgentAdapter, AgentEvent } from "../../src/types.js";

class EchoAdapter implements AgentAdapter {
  readonly source = "cli" as const;

  constructor(public readonly id: "codex" | "claude" | "gemini" | "kimi") {}

  capabilities() {
    return {
      supportsHardReadOnly: true,
      supportsStreaming: true,
      supportsUsageStats: false,
      supportsAuthStatus: false
    };
  }

  async authStatus() {
    return { ok: true, detail: "ok" };
  }

  async *run(request: AdapterRunRequest): AsyncGenerator<AgentEvent> {
    yield { type: "final", text: `echo:${request.prompt}`, rawOutput: request.prompt };
  }
}

describe("workflow engine", () => {
  test("loads and runs yaml workflow stages", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "council-workflow-"));
    const workflowDir = path.join(tempDir, ".council", "workflows");
    fs.mkdirSync(workflowDir, { recursive: true });

    const yaml = `name: testflow
version: 1
stages:
  - id: plan
    role: planner
    agent: codex
    promptTemplate: "plan {{input}}"
    onFailure: abort
  - id: critique
    role: critic
    agent: claude
    promptTemplate: "critique {{stage.plan.output}}"
    onFailure: continue
`;

    fs.writeFileSync(path.join(workflowDir, "testflow.yaml"), yaml, "utf8");

    const config = structuredClone(defaultConfig);
    const db = new CouncilDatabase(path.join(tempDir, "workflow.db"));
    const echoCodex = new EchoAdapter("codex");
    const echoClaude = new EchoAdapter("claude");

    const orchestrator = new CouncilOrchestrator({
      config,
      db,
      adapters: {
        cliAdapters: {
          codex: echoCodex,
          claude: echoClaude,
          gemini: echoCodex,
          kimi: echoCodex
        },
        apiFallbackAdapters: {}
      }
    });

    const result = await runWorkflow(orchestrator, {
      name: "testflow",
      input: "goal",
      cwd: tempDir,
      allowApiFallback: false
    });

    expect(result.stageOutputs.plan).toContain("plan goal");
    expect(result.stageOutputs.critique).toContain("critique");
    expect(result.runResults).toHaveLength(2);

    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
