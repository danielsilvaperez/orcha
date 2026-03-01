import type { AgentAdapter, AgentResult, SafetyPolicy } from "../types.js";

export interface SynthesisRequest {
  originalPrompt: string;
  results: AgentResult[];
  judgeAdapter: AgentAdapter;
  cwd: string;
  timeoutMs: number;
  safetyPolicy: SafetyPolicy;
}

export interface SynthesisResult {
  synthesis: string;
  disagreements: string[];
  raw: string;
}

export function buildSynthesisPrompt(originalPrompt: string, results: AgentResult[]): string {
  const sections = results
    .map((result) => {
      const body = result.finalText.trim().length > 0 ? result.finalText : `(no answer; status=${result.status})`;
      return `Agent: ${result.agent}\nStatus: ${result.status}\nSource: ${result.source}\nResponse:\n${body}`;
    })
    .join("\n\n---\n\n");

  return [
    "You are the synthesis judge for a multi-agent committee.",
    "You must merge the responses into one actionable answer.",
    "Return valid JSON only with this exact shape:",
    '{"synthesis":"<string>","disagreements":["<string>"]}',
    "Guidelines:",
    "- Synthesis should be concise and practical.",
    "- Include critical risks or uncertainty.",
    "- disagreements should list important conflicts between agents.",
    "",
    "Original user prompt:",
    originalPrompt,
    "",
    "Agent responses:",
    sections
  ].join("\n");
}

function extractFirstJsonObject(text: string): string | undefined {
  const match = text.match(/\{[\s\S]*\}/);
  return match?.[0];
}

export function parseSynthesis(raw: string): { synthesis: string; disagreements: string[] } {
  const jsonCandidate = extractFirstJsonObject(raw);
  if (!jsonCandidate) {
    return {
      synthesis: raw.trim(),
      disagreements: []
    };
  }

  try {
    const parsed = JSON.parse(jsonCandidate) as { synthesis?: unknown; disagreements?: unknown };
    const synthesis = typeof parsed.synthesis === "string" ? parsed.synthesis : raw.trim();
    const disagreements = Array.isArray(parsed.disagreements)
      ? parsed.disagreements.filter((item): item is string => typeof item === "string")
      : [];
    return { synthesis, disagreements };
  } catch {
    return {
      synthesis: raw.trim(),
      disagreements: []
    };
  }
}

export async function runSynthesis(request: SynthesisRequest): Promise<SynthesisResult> {
  const synthesisPrompt = buildSynthesisPrompt(request.originalPrompt, request.results);

  let finalText = "";
  let rawOutput = "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs);

  try {
    for await (const event of request.judgeAdapter.run({
      prompt: synthesisPrompt,
      cwd: request.cwd,
      timeoutMs: request.timeoutMs,
      safetyPolicy: request.safetyPolicy,
      signal: controller.signal
    })) {
      if (event.type === "delta") {
        finalText += event.text;
      }
      if (event.type === "final") {
        finalText = event.text;
        rawOutput = event.rawOutput;
      }
      if (event.type === "error") {
        throw new Error(event.error);
      }
    }
  } finally {
    clearTimeout(timeout);
  }

  const raw = finalText || rawOutput;
  const parsed = parseSynthesis(raw);
  return {
    synthesis: parsed.synthesis,
    disagreements: parsed.disagreements,
    raw
  };
}
