import type { CouncilConfig } from "../types.js";

export const defaultConfig: CouncilConfig = {
  version: 1,
  defaults: {
    judgeAgent: "codex",
    synthesis: true,
    timeoutMs: 120000,
    safetyPolicy: "best_effort_read_only",
    outputMode: "raw_plus_synthesis",
    allowApiFallback: false
  },
  agents: {
    codex: { enabled: true },
    claude: { enabled: true },
    gemini: { enabled: true },
    kimi: { enabled: true }
  },
  apiFallback: {
    openai: {
      enabled: false,
      model: "gpt-5-mini",
      baseUrl: "https://api.openai.com/v1",
      apiKeyEnv: "OPENAI_API_KEY"
    },
    anthropic: {
      enabled: false,
      model: "claude-sonnet-4-5",
      baseUrl: "https://api.anthropic.com/v1",
      apiKeyEnv: "ANTHROPIC_API_KEY"
    },
    google: {
      enabled: false,
      model: "gemini-2.5-pro",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      apiKeyEnv: "GOOGLE_API_KEY"
    },
    moonshot: {
      enabled: false,
      model: "kimi-k2-0711-preview",
      baseUrl: "https://api.moonshot.ai/v1",
      apiKeyEnv: "MOONSHOT_API_KEY"
    }
  }
};
