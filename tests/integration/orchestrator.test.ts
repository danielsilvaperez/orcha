import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { OrchaOrchestrator } from "../../src/core/orchestrator.js";
import { OrchaDatabase } from "../../src/db/index.js";
import { defaultConfig } from "../../src/config/defaults.js";
import type { AdapterRunRequest, AgentAdapter, AgentEvent, AgentId } from "../../src/types.js";

class ScriptedAdapter implements AgentAdapter {
  readonly source = "cli" as const;

  constructor(
    public readonly id: AgentId,
    private readonly script: (request: AdapterRunRequest) => AsyncGenerator<AgentEvent>
  ) {}

  capabilities() {
    return {
      supportsHardReadOnly: true,
      supportsStreaming: true,
      supportsUsageStats: true,
      supportsAuthStatus: true
    };
  }

  async authStatus() {
    return { ok: true, detail: "ok" };
  }

  run(request: AdapterRunRequest): AsyncIterable<AgentEvent> {
    return this.script(request);
  }
}

class ApiSuccessAdapter implements AgentAdapter {
  readonly source = "api" as const;

  constructor(public readonly id: AgentId) {}

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

  async *run(): AsyncGenerator<AgentEvent> {
    yield { type: "final", text: "api saved it", rawOutput: "api saved it" };
  }
}

const tempFiles: string[] = [];

afterEach(() => {
  for (const file of tempFiles) {
    fs.rmSync(file, { force: true });
  }
});

function createDbPath(): string {
  const file = path.join(os.tmpdir(), `orcha-test-${Date.now()}-${Math.random()}.db`);
  tempFiles.push(file);
  return file;
}

describe("orchestrator", () => {
  test("soft-timeout continues and still synthesizes", async () => {
    const codex = new ScriptedAdapter("codex", async function* (request) {
      if (request.prompt.includes("Return valid JSON only")) {
        yield { type: "final", text: '{"synthesis":"merged","disagreements":["difference"]}', rawOutput: "" };
        return;
      }
      yield { type: "status", status: "running" };
      yield { type: "final", text: "codex response", rawOutput: "codex response" };
    });

    const claude = new ScriptedAdapter("claude", async function* (request) {
      await new Promise((resolve) => setTimeout(resolve, request.timeoutMs + 30));
      yield { type: "final", text: "late response", rawOutput: "late response" };
    });

    const db = new OrchaDatabase(createDbPath());
    const config = structuredClone(defaultConfig);
    const orchestrator = new OrchaOrchestrator({
      config,
      db,
      adapters: {
        cliAdapters: { codex, claude, gemini: claude, kimi: claude },
        apiFallbackAdapters: {}
      }
    });

    const result = await orchestrator.runCommittee({
      prompt: "test timeout behavior",
      agents: ["codex", "claude"],
      cwd: process.cwd(),
      synthesis: true,
      judgeAgent: "codex",
      timeoutMs: 50,
      allowApiFallback: false
    });

    expect(result.results.find((item) => item.agent === "codex")?.status).toBe("success");
    expect(result.results.find((item) => item.agent === "claude")?.status).toBe("timed_out");
    expect(result.synthesis).toBe("merged");
    expect(result.disagreements).toEqual(["difference"]);

    db.close();
  });

  test("api fallback only triggers when enabled", async () => {
    const failingCli = new ScriptedAdapter("codex", async function* () {
      yield { type: "error", error: "cli failed" };
    });

    const apiAdapter = new ApiSuccessAdapter("codex");

    const config = structuredClone(defaultConfig);
    config.defaults.allowApiFallback = true;

    const db = new OrchaDatabase(createDbPath());
    const orchestrator = new OrchaOrchestrator({
      config,
      db,
      adapters: {
        cliAdapters: { codex: failingCli, claude: failingCli, gemini: failingCli, kimi: failingCli },
        apiFallbackAdapters: { codex: apiAdapter }
      }
    });

    const withFallback = await orchestrator.runCommittee({
      prompt: "fallback",
      agents: ["codex"],
      cwd: process.cwd(),
      synthesis: false,
      judgeAgent: "codex",
      timeoutMs: 100,
      allowApiFallback: true
    });

    expect(withFallback.results[0]?.status).toBe("success");
    expect(withFallback.results[0]?.source).toBe("api");

    const withoutFallback = await orchestrator.runCommittee({
      prompt: "no fallback",
      agents: ["codex"],
      cwd: process.cwd(),
      synthesis: false,
      judgeAgent: "codex",
      timeoutMs: 100,
      allowApiFallback: false
    });

    expect(withoutFallback.results[0]?.status).toBe("failed");
    expect(withoutFallback.results[0]?.source).toBe("cli");

    db.close();
  });
});
