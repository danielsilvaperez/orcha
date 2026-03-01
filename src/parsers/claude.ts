import type { AgentEvent } from "../types.js";
import type { LineParser, ParserState, ProcessFinalizeResult } from "./types.js";

export const parseClaudeLine: LineParser = (line, state) => {
  const events: AgentEvent[] = [];
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;

    if (parsed.type === "stream_event") {
      const event = parsed.event as Record<string, unknown> | undefined;
      if (event?.type === "content_block_delta") {
        const delta = event.delta as Record<string, unknown> | undefined;
        if (delta?.type === "text_delta") {
          const text = String(delta.text ?? "");
          state.text += text;
          events.push({ type: "delta", text });
        }
      }
      if (event?.type === "message_delta") {
        const usage = event.usage as Record<string, unknown> | undefined;
        if (usage) {
          state.usage = {
            inputTokens: typeof usage.input_tokens === "number" ? usage.input_tokens : state.usage?.inputTokens,
            outputTokens: typeof usage.output_tokens === "number" ? usage.output_tokens : state.usage?.outputTokens,
            costUsd: state.usage?.costUsd
          };
          events.push({ type: "usage", usage: state.usage });
        }
      }
    }

    if (parsed.type === "assistant") {
      const message = parsed.message as Record<string, unknown> | undefined;
      const content = Array.isArray(message?.content) ? (message?.content as Array<Record<string, unknown>>) : [];
      const texts = content.filter((part) => part.type === "text").map((part) => String(part.text ?? ""));
      if (texts.length > 0) {
        state.text = texts.join("");
      }
    }

    if (parsed.type === "result") {
      if (typeof parsed.result === "string" && parsed.result.length > 0) {
        state.text = parsed.result;
      }
      const usage = parsed.usage as Record<string, unknown> | undefined;
      state.usage = {
        inputTokens: typeof usage?.input_tokens === "number" ? usage.input_tokens : state.usage?.inputTokens,
        outputTokens: typeof usage?.output_tokens === "number" ? usage.output_tokens : state.usage?.outputTokens,
        costUsd: typeof parsed.total_cost_usd === "number" ? parsed.total_cost_usd : state.usage?.costUsd
      };
      events.push({ type: "usage", usage: state.usage });
    }
  } catch {
    state.diagnostics.push(line);
    events.push({ type: "diagnostic", line });
  }

  return { events };
};

export function finalizeClaudeParser(state: ParserState, exitCode: number): ProcessFinalizeResult {
  const events: AgentEvent[] = [];

  if (state.text.trim().length > 0 && !state.finalEmitted) {
    events.push({ type: "final", text: state.text, rawOutput: state.rawLines.join("\n"), usage: state.usage });
  }

  if (exitCode !== 0) {
    events.push({ type: "error", error: `claude exited with code ${exitCode}` });
  }

  return { events };
}
