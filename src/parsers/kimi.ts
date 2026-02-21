import type { AgentEvent } from "../types.js";
import type { LineParser, ParserState, ProcessFinalizeResult } from "./types.js";

export const parseKimiLine: LineParser = (line, state) => {
  const events: AgentEvent[] = [];

  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;

    if (parsed.role === "assistant") {
      const content = Array.isArray(parsed.content) ? (parsed.content as Array<Record<string, unknown>>) : [];
      const textParts = content.filter((part) => part.type === "text").map((part) => String(part.text ?? ""));
      const text = textParts.join("");
      if (text.length > 0) {
        state.text += text;
        events.push({ type: "delta", text });
      }
    }
  } catch {
    state.diagnostics.push(line);
    events.push({ type: "diagnostic", line });
  }

  return { events };
};

export function finalizeKimiParser(state: ParserState, exitCode: number): ProcessFinalizeResult {
  const events: AgentEvent[] = [];

  if (state.text.trim().length > 0 && !state.finalEmitted) {
    events.push({ type: "final", text: state.text, rawOutput: state.rawLines.join("\n"), usage: state.usage });
  }

  if (exitCode !== 0) {
    events.push({ type: "error", error: `kimi exited with code ${exitCode}` });
  }

  return { events };
}
