import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { loadConfig, toToml } from "../../src/config/load.js";
import { defaultConfig } from "../../src/config/defaults.js";

const originalHome = process.env.HOME;
let tempRoot = "";

beforeEach(() => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "council-config-"));
  process.env.HOME = tempRoot;
});

afterEach(() => {
  process.env.HOME = originalHome;
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe("config loading", () => {
  test("merges defaults, global, project, and overrides", () => {
    const globalDir = path.join(tempRoot, ".council");
    fs.mkdirSync(globalDir, { recursive: true });

    const globalConfig = structuredClone(defaultConfig);
    globalConfig.defaults.timeoutMs = 99999;
    globalConfig.agents.kimi.enabled = false;
    fs.writeFileSync(path.join(globalDir, "config.toml"), toToml(globalConfig), "utf8");

    const projectDir = path.join(tempRoot, "project");
    fs.mkdirSync(projectDir, { recursive: true });
    const projectConfig = structuredClone(defaultConfig);
    projectConfig.defaults.judgeAgent = "claude";
    projectConfig.agents.codex.enabled = false;
    fs.writeFileSync(path.join(projectDir, ".council.toml"), toToml(projectConfig), "utf8");

    const loaded = loadConfig(projectDir, {
      timeoutMs: 1234,
      allowApiFallback: true,
      agents: ["gemini", "kimi"]
    });

    expect(loaded.defaults.timeoutMs).toBe(1234);
    expect(loaded.defaults.judgeAgent).toBe("claude");
    expect(loaded.defaults.allowApiFallback).toBe(true);
    expect(loaded.agents.gemini.enabled).toBe(true);
    expect(loaded.agents.kimi.enabled).toBe(true);
    expect(loaded.agents.claude.enabled).toBe(false);
  });
});
