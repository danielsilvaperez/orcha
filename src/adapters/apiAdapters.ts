import type { AdapterCapabilities, AdapterRunRequest, AgentAdapter, AgentEvent, AuthStatus, UsageStats } from "../types.js";
import type { ApiProviderConfig, AgentId } from "../types.js";

abstract class BaseApiAdapter implements AgentAdapter {
  readonly source = "api" as const;

  protected constructor(
    public readonly id: AgentId,
    private readonly providerName: string,
    protected readonly providerConfig: ApiProviderConfig
  ) {}

  capabilities(): AdapterCapabilities {
    return {
      supportsHardReadOnly: true,
      supportsStreaming: false,
      supportsUsageStats: true,
      supportsAuthStatus: true
    };
  }

  async authStatus(): Promise<AuthStatus> {
    const key = process.env[this.providerConfig.apiKeyEnv];
    if (!key) {
      return { ok: false, detail: `${this.providerConfig.apiKeyEnv} is not set` };
    }
    return { ok: true, detail: `${this.providerName} API key detected via ${this.providerConfig.apiKeyEnv}` };
  }

  async *run(request: AdapterRunRequest): AsyncGenerator<AgentEvent> {
    yield { type: "status", status: "starting", detail: `${this.providerName} API fallback` };
    yield { type: "status", status: "running" };

    const key = process.env[this.providerConfig.apiKeyEnv];
    if (!key) {
      yield { type: "error", error: `${this.providerConfig.apiKeyEnv} is not set` };
      return;
    }

    try {
      const { text, usage } = await this.invoke(request.prompt, key, request.model ?? this.providerConfig.model);
      if (usage) {
        yield { type: "usage", usage };
      }
      yield { type: "final", text, rawOutput: text, usage };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      yield { type: "error", error: message };
    }
  }

  protected abstract invoke(prompt: string, key: string, model?: string): Promise<{ text: string; usage?: UsageStats }>;
}

export class OpenAiFallbackAdapter extends BaseApiAdapter {
  constructor(id: AgentId, providerConfig: ApiProviderConfig) {
    super(id, "OpenAI", providerConfig);
  }

  protected async invoke(prompt: string, key: string, model = "gpt-5-mini"): Promise<{ text: string; usage?: UsageStats }> {
    const baseUrl = this.providerConfig.baseUrl ?? "https://api.openai.com/v1";
    const response = await fetch(`${baseUrl}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model,
        input: prompt
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI fallback failed: ${response.status} ${await response.text()}`);
    }

    const json = (await response.json()) as Record<string, unknown>;
    const text =
      (json.output_text as string | undefined) ??
      (Array.isArray(json.output)
        ? (json.output as Array<Record<string, unknown>>)
            .flatMap((item) => (Array.isArray(item.content) ? (item.content as Array<Record<string, unknown>>) : []))
            .map((content) => String(content.text ?? ""))
            .join("\n")
        : "");

    const usage = json.usage as Record<string, unknown> | undefined;
    return {
      text: text || "",
      usage: {
        inputTokens: typeof usage?.input_tokens === "number" ? usage.input_tokens : undefined,
        outputTokens: typeof usage?.output_tokens === "number" ? usage.output_tokens : undefined
      }
    };
  }
}

export class AnthropicFallbackAdapter extends BaseApiAdapter {
  constructor(id: AgentId, providerConfig: ApiProviderConfig) {
    super(id, "Anthropic", providerConfig);
  }

  protected async invoke(prompt: string, key: string, model = "claude-sonnet-4-5"): Promise<{ text: string; usage?: UsageStats }> {
    const baseUrl = this.providerConfig.baseUrl ?? "https://api.anthropic.com/v1";
    const response = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic fallback failed: ${response.status} ${await response.text()}`);
    }

    const json = (await response.json()) as Record<string, unknown>;
    const content = Array.isArray(json.content) ? (json.content as Array<Record<string, unknown>>) : [];
    const text = content.filter((item) => item.type === "text").map((item) => String(item.text ?? "")).join("\n");
    const usage = json.usage as Record<string, unknown> | undefined;

    return {
      text,
      usage: {
        inputTokens: typeof usage?.input_tokens === "number" ? usage.input_tokens : undefined,
        outputTokens: typeof usage?.output_tokens === "number" ? usage.output_tokens : undefined
      }
    };
  }
}

export class GoogleFallbackAdapter extends BaseApiAdapter {
  constructor(id: AgentId, providerConfig: ApiProviderConfig) {
    super(id, "Google", providerConfig);
  }

  protected async invoke(prompt: string, key: string, model = "gemini-2.5-pro"): Promise<{ text: string; usage?: UsageStats }> {
    const baseUrl = this.providerConfig.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
    const response = await fetch(`${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      })
    });

    if (!response.ok) {
      throw new Error(`Google fallback failed: ${response.status} ${await response.text()}`);
    }

    const json = (await response.json()) as Record<string, unknown>;
    const candidates = Array.isArray(json.candidates) ? (json.candidates as Array<Record<string, unknown>>) : [];
    const first = candidates[0] as Record<string, unknown> | undefined;
    const content = first?.content as Record<string, unknown> | undefined;
    const parts = Array.isArray(content?.parts) ? (content?.parts as Array<Record<string, unknown>>) : [];
    const text = parts.map((part) => String(part.text ?? "")).join("\n");

    return { text };
  }
}

export class MoonshotFallbackAdapter extends BaseApiAdapter {
  constructor(id: AgentId, providerConfig: ApiProviderConfig) {
    super(id, "Moonshot", providerConfig);
  }

  protected async invoke(prompt: string, key: string, model = "kimi-k2-0711-preview"): Promise<{ text: string; usage?: UsageStats }> {
    const baseUrl = this.providerConfig.baseUrl ?? "https://api.moonshot.ai/v1";
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2
      })
    });

    if (!response.ok) {
      throw new Error(`Moonshot fallback failed: ${response.status} ${await response.text()}`);
    }

    const json = (await response.json()) as Record<string, unknown>;
    const choices = Array.isArray(json.choices) ? (json.choices as Array<Record<string, unknown>>) : [];
    const message = choices[0]?.message as Record<string, unknown> | undefined;
    const text = String(message?.content ?? "");

    const usage = json.usage as Record<string, unknown> | undefined;
    return {
      text,
      usage: {
        inputTokens: typeof usage?.prompt_tokens === "number" ? usage.prompt_tokens : undefined,
        outputTokens: typeof usage?.completion_tokens === "number" ? usage.completion_tokens : undefined
      }
    };
  }
}
