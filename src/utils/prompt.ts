import type { AgentId, SafetyPolicy } from "../types.js";

const readOnlyGuard = `
Safety contract:
- Do not run tools, commands, or write/edit files.
- Operate as read-only analysis.
- If you cannot comply, respond with a refusal and explanation.
`;

export function withSafetyGuard(prompt: string, safetyPolicy: SafetyPolicy, agent: AgentId, supportsHardReadOnly: boolean): string {
  if (safetyPolicy === "strict" && !supportsHardReadOnly) {
    return `${readOnlyGuard}\nAgent: ${agent}\n\nUser prompt:\n${prompt}`;
  }

  if (safetyPolicy === "best_effort_read_only" && !supportsHardReadOnly) {
    return `${readOnlyGuard}\nAgent: ${agent}\n\nUser prompt:\n${prompt}`;
  }

  return prompt;
}
