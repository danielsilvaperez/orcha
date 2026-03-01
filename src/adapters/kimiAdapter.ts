import type { AdapterCapabilities, AdapterRunRequest, AgentAdapter, AuthStatus } from "../types.js";
import { createParserState, finalizeKimiParser, parseKimiLine } from "../parsers/index.js";
import { runCliCommand, binaryExists } from "./cliUtils.js";
import { withSafetyGuard } from "../utils/prompt.js";

export class KimiAdapter implements AgentAdapter {
  readonly id = "kimi" as const;
  readonly source = "cli" as const;

  constructor(private readonly cliPath = "kimi") {}

  capabilities(): AdapterCapabilities {
    return {
      supportsHardReadOnly: false,
      supportsStreaming: true,
      supportsUsageStats: false,
      supportsAuthStatus: false
    };
  }

  async authStatus(): Promise<AuthStatus> {
    const exists = await binaryExists(this.cliPath);
    if (!exists) {
      return { ok: false, detail: `${this.cliPath} not found` };
    }
    return { ok: true, detail: "Auth status not exposed by Kimi CLI; binary detected." };
  }

  async *run(request: AdapterRunRequest) {
    const prompt = withSafetyGuard(request.prompt, request.safetyPolicy, this.id, false);
    const args = [
      "--print",
      "--output-format",
      "stream-json",
      "--prompt",
      prompt,
      "--work-dir",
      request.cwd
    ];

    if (request.model) {
      args.unshift("--model", request.model);
    }

    yield* runCliCommand({
      command: this.cliPath,
      args,
      cwd: request.cwd,
      parser: parseKimiLine,
      finalize: finalizeKimiParser,
      state: createParserState(),
      signal: request.signal
    });
  }
}
