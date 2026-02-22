import type { AgentAdapter, AgentId, OrchaConfig } from "../types.js";
import { ClaudeAdapter } from "./claudeAdapter.js";
import { CodexAdapter } from "./codexAdapter.js";
import { GeminiAdapter } from "./geminiAdapter.js";
import { KimiAdapter } from "./kimiAdapter.js";
import {
  AnthropicFallbackAdapter,
  GoogleFallbackAdapter,
  MoonshotFallbackAdapter,
  OpenAiFallbackAdapter
} from "./apiAdapters.js";

export interface AdapterRegistry {
  cliAdapters: Record<AgentId, AgentAdapter>;
  apiFallbackAdapters: Partial<Record<AgentId, AgentAdapter>>;
}

export function createAdapterRegistry(config: OrchaConfig): AdapterRegistry {
  const cliAdapters: Record<AgentId, AgentAdapter> = {
    codex: new CodexAdapter(config.agents.codex.cliPath ?? "codex"),
    claude: new ClaudeAdapter(config.agents.claude.cliPath ?? "claude"),
    gemini: new GeminiAdapter(config.agents.gemini.cliPath ?? "gemini"),
    kimi: new KimiAdapter(config.agents.kimi.cliPath ?? "kimi")
  };

  const apiFallbackAdapters: Partial<Record<AgentId, AgentAdapter>> = {};

  if (config.apiFallback.openai.enabled) {
    apiFallbackAdapters.codex = new OpenAiFallbackAdapter("codex", config.apiFallback.openai);
  }

  if (config.apiFallback.anthropic.enabled) {
    apiFallbackAdapters.claude = new AnthropicFallbackAdapter("claude", config.apiFallback.anthropic);
  }

  if (config.apiFallback.google.enabled) {
    apiFallbackAdapters.gemini = new GoogleFallbackAdapter("gemini", config.apiFallback.google);
  }

  if (config.apiFallback.moonshot.enabled) {
    apiFallbackAdapters.kimi = new MoonshotFallbackAdapter("kimi", config.apiFallback.moonshot);
  }

  return {
    cliAdapters,
    apiFallbackAdapters
  };
}
