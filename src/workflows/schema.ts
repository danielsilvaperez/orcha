import { z } from "zod";

export const workflowStageSchema = z.object({
  id: z.string().min(1),
  role: z.string().min(1),
  agent: z.enum(["codex", "claude", "gemini", "kimi"]),
  promptTemplate: z.string().min(1),
  timeoutMs: z.number().int().positive().optional(),
  onFailure: z.enum(["abort", "continue"]).default("abort")
});

export const workflowSpecSchema = z.object({
  name: z.string().min(1),
  version: z.literal(1),
  stages: z.array(workflowStageSchema).min(1)
});
