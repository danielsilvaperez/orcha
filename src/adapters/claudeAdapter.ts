import type { AdapterCapabilities, AdapterRunRequest, AgentAdapter, AuthStatus } from "../types.js";
import { createParserState, finalizeClaudeParser, parseClaudeLine } from "../parsers/index.js";
import { runCliCommand, checkCommandStatus, binaryExists } from "./cliUtils.js";
import { withSafetyGuard } from "../utils/prompt.js";

export class ClaudeAdapter implements AgentAdapter {
  readonly id = "claude" as const;
  readonly source = "cli" as const;

  constructor(private readonly cliPath = "claude") {}

  capabilities(): AdapterCapabilities {
    return {
      supportsHardReadOnly: true,
      supportsStreaming: true,
      supportsUsageStats: true,
      supportsAuthStatus: true
    };
  }

  async authStatus(): Promise<AuthStatus> {
    const exists = await binaryExists(this.cliPath);
    if (!exists) {
      return { ok: false, detail: `${this.cliPath} not found` };
    }
    return checkCommandStatus(this.cliPath, ["auth", "status"]);
  }

  async *run(request: AdapterRunRequest) {
    const prompt = withSafetyGuard(request.prompt, request.safetyPolicy, this.id, true);

    const args = [
      "-p",
      "--verbose",
      "--output-format",
      "stream-json",
      "--permission-mode",
      "plan",
      "--no-session-persistence"
    ];

    if (request.model) {
      args.push("--model", request.model);
    }

    args.push(prompt);

    yield* runCliCommand({
      command: this.cliPath,
      args,
      cwd: request.cwd,
      parser: parseClaudeLine,
      finalize: finalizeClaudeParser,
      state: createParserState(),
      signal: request.signal
    });
  }
}
