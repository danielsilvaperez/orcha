import type { AgentEvent, UsageStats } from "../types.js";

export interface ParserState {
  text: string;
  rawLines: string[];
  diagnostics: string[];
  usage?: UsageStats;
  finalEmitted: boolean;
}

export interface LineParseResult {
  events: AgentEvent[];
}

export interface ProcessFinalizeResult {
  events: AgentEvent[];
}

export type LineParser = (line: string, state: ParserState) => LineParseResult;

export function createParserState(): ParserState {
  return {
    text: "",
    rawLines: [],
    diagnostics: [],
    finalEmitted: false
  };
}
