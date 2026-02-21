import { describe, expect, test } from "vitest";
import { buildSynthesisPrompt, parseSynthesis } from "../../src/core/synthesizer.js";

describe("synthesizer", () => {
  test("builds synthesis prompt with rubric and responses", () => {
    const prompt = buildSynthesisPrompt("user goal", [
      {
        agent: "codex",
        status: "success",
        finalText: "response one",
        rawOutput: "response one",
        source: "cli",
        diagnostics: [],
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: 1
      },
      {
        agent: "claude",
        status: "success",
        finalText: "response two",
        rawOutput: "response two",
        source: "cli",
        diagnostics: [],
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: 1
      }
    ]);

    expect(prompt).toContain("Return valid JSON only");
    expect(prompt).toContain("Agent: codex");
    expect(prompt).toContain("Agent: claude");
  });

  test("parses json synthesis payload", () => {
    const parsed = parseSynthesis('{"synthesis":"final answer","disagreements":["a vs b"]}');
    expect(parsed.synthesis).toBe("final answer");
    expect(parsed.disagreements).toEqual(["a vs b"]);
  });

  test("falls back to raw string when json missing", () => {
    const parsed = parseSynthesis("plain text");
    expect(parsed.synthesis).toBe("plain text");
    expect(parsed.disagreements).toEqual([]);
  });
});
