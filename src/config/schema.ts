import { z } from "zod";

const agentIdSchema = z.enum(["codex", "claude", "gemini", "kimi"]);

const agentConfigSchema = z.object({
  enabled: z.boolean().default(true),
  model: z.string().optional(),
  timeoutMs: z.number().int().positive().optional(),
  cliPath: z.string().optional()
});

const providerConfigSchema = z.object({
  enabled: z.boolean().default(false),
  model: z.string().optional(),
  baseUrl: z.string().url().optional(),
  apiKeyEnv: z.string().min(1)
});

export const councilConfigSchema = z.object({
  version: z.literal(1).default(1),
  defaults: z.object({
    judgeAgent: agentIdSchema.default("codex"),
    synthesis: z.boolean().default(true),
    timeoutMs: z.number().int().positive().default(120000),
    safetyPolicy: z.enum(["best_effort_read_only", "strict"]).default("best_effort_read_only"),
    outputMode: z.enum(["raw_plus_synthesis", "raw_only", "synthesis_only"]).default("raw_plus_synthesis"),
    allowApiFallback: z.boolean().default(false)
  }),
  agents: z.object({
    codex: agentConfigSchema,
    claude: agentConfigSchema,
    gemini: agentConfigSchema,
    kimi: agentConfigSchema
  }),
  apiFallback: z.object({
    openai: providerConfigSchema,
    anthropic: providerConfigSchema,
    google: providerConfigSchema,
    moonshot: providerConfigSchema
  })
});

export type CouncilConfigInput = z.input<typeof councilConfigSchema>;
