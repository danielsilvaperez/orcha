import type { AgentEvent } from "../types.js";
import type { LineParser, ParserState, ProcessFinalizeResult } from "./types.js";

export const parseGeminiLine: LineParser = (line, state) => {
  const events: AgentEvent[] = [];
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;

    if (parsed.type === "message") {
      if (parsed.role === "assistant") {
        const content = String(parsed.content ?? "");
        if (content.length > 0) {
          state.text += content;
          events.push({ type: "delta", text: content });
        }
      }
    }

    if (parsed.type === "result") {
      const stats = parsed.stats as Record<string, unknown> | undefined;
      state.usage = {
        inputTokens: typeof stats?.input_tokens === "number" ? stats.input_tokens : state.usage?.inputTokens,
        outputTokens: typeof stats?.output_tokens === "number" ? stats.output_tokens : state.usage?.outputTokens,
        costUsd: state.usage?.costUsd
      };

      if (stats && typeof stats === "object") {
        const totalTokens = (stats as { total_tokens?: number }).total_tokens;
        if (typeof totalTokens === "number" && !state.usage.outputTokens) {
          state.usage.outputTokens = totalTokens;
        }
      }

      events.push({ type: "usage", usage: state.usage });
    }
  } catch {
    state.diagnostics.push(line);
    events.push({ type: "diagnostic", line });
  }

  return { events };
};

export function finalizeGeminiParser(state: ParserState, exitCode: number): ProcessFinalizeResult {
  const events: AgentEvent[] = [];

  if (state.text.trim().length > 0 && !state.finalEmitted) {
    events.push({ type: "final", text: state.text, rawOutput: state.rawLines.join("\n"), usage: state.usage });
  }

  if (exitCode !== 0) {
    events.push({ type: "error", error: `gemini exited with code ${exitCode}` });
  }

  return { events };
}
