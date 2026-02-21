import { execa } from "execa";
import type { AgentEvent, AuthStatus } from "../types.js";
import { streamLines } from "../utils/lines.js";
import type { LineParser, ParserState, ProcessFinalizeResult } from "../parsers/index.js";

export interface CliRunOptions {
  command: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  parser: LineParser;
  finalize: (state: ParserState, exitCode: number) => ProcessFinalizeResult;
  state: ParserState;
  signal?: AbortSignal;
}

export async function binaryExists(command: string): Promise<boolean> {
  try {
    await execa("which", [command]);
    return true;
  } catch {
    return false;
  }
}

export async function checkCommandStatus(command: string, args: string[]): Promise<AuthStatus> {
  try {
    const result = await execa(command, args, { reject: false });
    if (result.exitCode === 0) {
      return { ok: true, detail: (result.stdout || "ok").trim() };
    }
    return {
      ok: false,
      detail: (result.stderr || result.stdout || `Command failed with code ${result.exitCode}`).trim()
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, detail: message };
  }
}

export async function* runCliCommand(options: CliRunOptions): AsyncIterable<AgentEvent> {
  const { command, args, cwd, env, parser, finalize, state, signal } = options;

  yield { type: "status", status: "starting", detail: `${command} ${args.join(" ")}` };

  const subprocess = execa(command, args, {
    cwd,
    env,
    all: true,
    reject: false,
    cancelSignal: signal
  });

  yield { type: "status", status: "running" };

  if (!subprocess.all) {
    throw new Error(`${command} did not expose combined output stream.`);
  }

  for await (const line of streamLines(subprocess.all)) {
    state.rawLines.push(line);
    const parsed = parser(line, state);
    for (const event of parsed.events) {
      if (event.type === "final") {
        state.finalEmitted = true;
      }
      yield event;
    }
  }

  const result = await subprocess;
  const finalized = finalize(state, result.exitCode ?? 0);
  for (const event of finalized.events) {
    if (event.type === "final") {
      state.finalEmitted = true;
    }
    yield event;
  }
}
