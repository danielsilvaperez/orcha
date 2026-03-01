import React from "react";
import { describe, expect, test } from "vitest";
import { render } from "ink-testing-library";
import { OrchaApp } from "../../src/tui/OrchaApp.js";
import { defaultConfig } from "../../src/config/defaults.js";
import type { AgentAdapter, AgentEvent } from "../../src/types.js";
import { OrchaOrchestrator } from "../../src/core/orchestrator.js";
import { OrchaDatabase } from "../../src/db/index.js";

class SilentAdapter implements AgentAdapter {
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

  async *run(): AsyncGenerator<AgentEvent> {
    yield { type: "final", text: "ok", rawOutput: "ok" };
  }
}

describe("tui", () => {
  test("renders basic shell", () => {
    const config = structuredClone(defaultConfig);
    const db = new OrchaDatabase(":memory:");
    const adapter = new SilentAdapter("codex");

    const orchestrator = new OrchaOrchestrator({
      config,
      db,
      adapters: {
        cliAdapters: { codex: adapter, claude: adapter, gemini: adapter, kimi: adapter },
        apiFallbackAdapters: {}
      }
    });

    const { lastFrame } = render(<OrchaApp config={config} orchestrator={orchestrator} cwd={process.cwd()} />);
    expect(lastFrame()).toContain("Orcha CLI");
    expect(lastFrame()).toContain("Synthesis");

    db.close();
  });
});
