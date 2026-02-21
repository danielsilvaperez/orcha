import { describe, expect, test } from "vitest";
import {
  createParserState,
  finalizeClaudeParser,
  finalizeCodexParser,
  finalizeGeminiParser,
  finalizeKimiParser,
  parseClaudeLine,
  parseCodexLine,
  parseGeminiLine,
  parseKimiLine
} from "../../src/parsers/index.js";

describe("parsers", () => {
  test("parses codex jsonl events", () => {
    const state = createParserState();
    parseCodexLine('{"type":"item.completed","item":{"type":"agent_message","text":"hello"}}', state);
    parseCodexLine('{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":5}}', state);

    const finalized = finalizeCodexParser(state, 0);
    const final = finalized.events.find((event) => event.type === "final");
    expect(final).toBeTruthy();
    expect(final?.type === "final" ? final.text : "").toBe("hello");
  });

  test("parses claude stream-json events", () => {
    const state = createParserState();
    parseClaudeLine(
      '{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}}',
      state
    );
    parseClaudeLine('{"type":"result","result":"Hi","usage":{"input_tokens":1,"output_tokens":2}}', state);

    const finalized = finalizeClaudeParser(state, 0);
    const final = finalized.events.find((event) => event.type === "final");
    expect(final).toBeTruthy();
    expect(final?.type === "final" ? final.text : "").toBe("Hi");
  });

  test("parses gemini stream-json events", () => {
    const state = createParserState();
    parseGeminiLine('{"type":"message","role":"assistant","content":"A","delta":true}', state);
    parseGeminiLine('{"type":"message","role":"assistant","content":"B","delta":true}', state);

    const finalized = finalizeGeminiParser(state, 0);
    const final = finalized.events.find((event) => event.type === "final");
    expect(final).toBeTruthy();
    expect(final?.type === "final" ? final.text : "").toBe("AB");
  });

  test("parses kimi stream-json events", () => {
    const state = createParserState();
    parseKimiLine('{"role":"assistant","content":[{"type":"text","text":"KM"}]}', state);

    const finalized = finalizeKimiParser(state, 0);
    const final = finalized.events.find((event) => event.type === "final");
    expect(final).toBeTruthy();
    expect(final?.type === "final" ? final.text : "").toBe("KM");
  });
});
