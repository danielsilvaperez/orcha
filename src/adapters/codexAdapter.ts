import type { AdapterCapabilities, AdapterRunRequest, AgentAdapter, AuthStatus } from "../types.js";
import { createParserState, finalizeCodexParser, parseCodexLine } from "../parsers/index.js";
import { runCliCommand, checkCommandStatus, binaryExists } from "./cliUtils.js";
import { withSafetyGuard } from "../utils/prompt.js";

export class CodexAdapter implements AgentAdapter {
  readonly id = "codex" as const;
  readonly source = "cli" as const;

  constructor(private readonly cliPath = "codex") {}

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
    return checkCommandStatus(this.cliPath, ["login", "status"]);
  }

  async *run(request: AdapterRunRequest) {
    const prompt = withSafetyGuard(request.prompt, request.safetyPolicy, this.id, true);
    const args = ["-a", "never"];

    if (request.model) {
      args.push("-m", request.model);
    }

    args.push(
      "exec",
      "--skip-git-repo-check",
      "--sandbox",
      "read-only",
      "--json",
      "--cd",
      request.cwd,
      prompt
    );

    yield* runCliCommand({
      command: this.cliPath,
      args,
      cwd: request.cwd,
      env: { ...process.env, RUST_LOG: "error" },
      parser: parseCodexLine,
      finalize: finalizeCodexParser,
      state: createParserState(),
      signal: request.signal
    });
  }
}
