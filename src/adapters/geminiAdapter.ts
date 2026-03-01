import type { AdapterCapabilities, AdapterRunRequest, AgentAdapter, AuthStatus } from "../types.js";
import { createParserState, finalizeGeminiParser, parseGeminiLine } from "../parsers/index.js";
import { runCliCommand, binaryExists } from "./cliUtils.js";
import { withSafetyGuard } from "../utils/prompt.js";

export class GeminiAdapter implements AgentAdapter {
  readonly id = "gemini" as const;
  readonly source = "cli" as const;

  constructor(private readonly cliPath = "gemini") {}

  capabilities(): AdapterCapabilities {
    return {
      supportsHardReadOnly: false,
      supportsStreaming: true,
      supportsUsageStats: true,
      supportsAuthStatus: false
    };
  }

  async authStatus(): Promise<AuthStatus> {
    const exists = await binaryExists(this.cliPath);
    if (!exists) {
      return { ok: false, detail: `${this.cliPath} not found` };
    }
    return { ok: true, detail: "Auth status not exposed by Gemini CLI; binary detected." };
  }

  async *run(request: AdapterRunRequest) {
    const prompt = withSafetyGuard(request.prompt, request.safetyPolicy, this.id, false);
    const args = ["-p", prompt, "--output-format", "stream-json", "--approval-mode", "default", "--sandbox"];

    if (request.model) {
      args.unshift("-m", request.model);
    }

    yield* runCliCommand({
      command: this.cliPath,
      args,
      cwd: request.cwd,
      parser: parseGeminiLine,
      finalize: finalizeGeminiParser,
      state: createParserState(),
      signal: request.signal
    });
  }
}
