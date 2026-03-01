import type { LineParser, ProcessFinalizeResult, ParserState } from "./types.js";
import type { AgentEvent } from "../types.js";

export const parseCodexLine: LineParser = (line, state) => {
  const events: AgentEvent[] = [];
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    if (parsed.type === "item.completed") {
      const item = parsed.item as Record<string, unknown> | undefined;
      if (item?.type === "agent_message") {
        const text = String(item.text ?? "");
        state.text = text;
        events.push({ type: "delta", text });
      }
    }

    if (parsed.type === "turn.completed") {
      const usage = parsed.usage as Record<string, unknown> | undefined;
      state.usage = {
        inputTokens: typeof usage?.input_tokens === "number" ? usage.input_tokens : undefined,
        outputTokens: typeof usage?.output_tokens === "number" ? usage.output_tokens : undefined
      };
      events.push({ type: "usage", usage: state.usage });
    }
  } catch {
    state.diagnostics.push(line);
    events.push({ type: "diagnostic", line });
  }

  return { events };
};

export function finalizeCodexParser(state: ParserState, exitCode: number): ProcessFinalizeResult {
  const events: AgentEvent[] = [];

  if (state.text.trim().length > 0 && !state.finalEmitted) {
    events.push({ type: "final", text: state.text, rawOutput: state.rawLines.join("\n"), usage: state.usage });
  }

  if (exitCode !== 0) {
    events.push({ type: "error", error: `codex exited with code ${exitCode}` });
  }

  return { events };
}
