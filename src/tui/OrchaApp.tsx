import React, { useMemo, useRef, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import type { AgentExecutionEvent, AgentId, AgentStatus, OrchaConfig } from "../types.js";
import type { OrchaOrchestrator } from "../core/orchestrator.js";
import { runSynthesis } from "../core/synthesizer.js";

interface AgentPaneState {
  status: AgentStatus | "idle";
  text: string;
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
  source?: "cli" | "api";
}

interface OrchaAppProps {
  config: OrchaConfig;
  orchestrator: OrchaOrchestrator;
  cwd: string;
}

const orderedAgents: AgentId[] = ["codex", "claude", "gemini", "kimi"];
const focusOrder: Array<AgentId | "synthesis" | "input"> = ["codex", "claude", "gemini", "kimi", "synthesis", "input"];

function emptyAgentState(): Record<AgentId, AgentPaneState> {
  return {
    codex: { status: "idle", text: "" },
    claude: { status: "idle", text: "" },
    gemini: { status: "idle", text: "" },
    kimi: { status: "idle", text: "" }
  };
}

function Panel({
  title,
  focused,
  children,
  status,
  source,
  metrics
}: {
  title: string;
  focused: boolean;
  children: React.ReactNode;
  status: string;
  source?: string;
  metrics?: string;
}) {
  return (
    <Box
      borderStyle="round"
      borderColor={focused ? "cyan" : "gray"}
      padding={1}
      flexDirection="column"
      width="50%"
      minHeight={10}
    >
      <Text color={focused ? "cyan" : "white"}>
        {title} [{status}]{source ? ` (${source})` : ""}
      </Text>
      {metrics ? <Text dimColor>{metrics}</Text> : null}
      <Box marginTop={1}>{children}</Box>
    </Box>
  );
}

export function OrchaApp({ config, orchestrator, cwd }: OrchaAppProps) {
  const { exit } = useApp();
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [agentStates, setAgentStates] = useState<Record<AgentId, AgentPaneState>>(() => emptyAgentState());
  const [synthesis, setSynthesis] = useState("");
  const [disagreements, setDisagreements] = useState<string[]>([]);
  const [focus, setFocus] = useState<(typeof focusOrder)[number]>("input");
  const [lastPrompt, setLastPrompt] = useState("");
  const [lastRun, setLastRun] = useState<
    | {
        prompt: string;
        results: Array<{
          agent: AgentId;
          status: "success" | "failed" | "timed_out" | "skipped";
          finalText: string;
          source: "cli" | "api";
        }>;
      }
    | undefined
  >(undefined);
  const [statusLine, setStatusLine] = useState("Ready");
  const activeRunRef = useRef<string | undefined>(undefined);

  const enabledAgents = useMemo(
    () => orderedAgents.filter((agent) => config.agents[agent].enabled),
    [config]
  );

  const onEvent = (evt: AgentExecutionEvent) => {
    if (!activeRunRef.current) {
      activeRunRef.current = evt.runId;
    }
    if (evt.runId !== activeRunRef.current) {
      return;
    }

    setAgentStates((previous) => {
      const next = { ...previous };
      const existing = next[evt.agent] ?? { status: "idle", text: "" };
      const updated: AgentPaneState = { ...existing, source: evt.source };

      if (evt.event.type === "status") {
        updated.status = evt.event.status;
      }
      if (evt.event.type === "delta") {
        updated.text += evt.event.text;
      }
      if (evt.event.type === "final") {
        updated.text = evt.event.text;
      }
      if (evt.event.type === "usage") {
        updated.inputTokens = evt.event.usage.inputTokens;
        updated.outputTokens = evt.event.usage.outputTokens;
      }
      if (evt.event.type === "error") {
        updated.error = evt.event.error;
      }

      next[evt.agent] = updated;
      return next;
    });
  };

  const runPrompt = async (promptToRun: string, agents?: AgentId[]) => {
    if (!promptToRun.trim() || running) {
      return;
    }

    setRunning(true);
    setStatusLine("Running committee...");
    setPrompt("");
    setLastPrompt(promptToRun);
    activeRunRef.current = undefined;

    setAgentStates(() => {
      const state = emptyAgentState();
      const selected = agents ?? enabledAgents;
      for (const agent of selected) {
        state[agent].status = "starting";
      }
      for (const agent of orderedAgents) {
        if (!selected.includes(agent)) {
          state[agent].status = "skipped";
        }
      }
      return state;
    });

    try {
      const runResult = await orchestrator.runCommittee(
        {
          prompt: promptToRun,
          agents: agents ?? enabledAgents,
          cwd,
          synthesis: config.defaults.synthesis,
          judgeAgent: config.defaults.judgeAgent,
          timeoutMs: config.defaults.timeoutMs,
          allowApiFallback: config.defaults.allowApiFallback
        },
        { onEvent }
      );

      setSynthesis(runResult.synthesis ?? "");
      setDisagreements(runResult.disagreements);
      setLastRun({
        prompt: promptToRun,
        results: runResult.results.map((result) => ({
          agent: result.agent,
          status: result.status,
          finalText: result.finalText,
          source: result.source
        }))
      });
      setStatusLine(`Completed run ${runResult.runId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusLine(`Run failed: ${message}`);
    } finally {
      setRunning(false);
      activeRunRef.current = undefined;
    }
  };

  const rerunFailedAgents = async () => {
    if (!lastRun || running) {
      return;
    }
    const failedAgents = lastRun.results
      .filter((result) => result.status === "failed" || result.status === "timed_out")
      .map((result) => result.agent);

    if (failedAgents.length === 0) {
      setStatusLine("No failed agents to rerun.");
      return;
    }

    await runPrompt(lastRun.prompt, failedAgents);
  };

  const rerunSynthesis = async () => {
    if (!lastRun || running) {
      return;
    }

    setStatusLine("Rerunning synthesis...");
    try {
      const judge = config.defaults.judgeAgent;
      const judgeAdapter = orchestrator.getCliAdapter(judge);

      if (!judgeAdapter) {
        setStatusLine("Judge adapter unavailable for synthesis rerun.");
        return;
      }

      const synthesisResult = await runSynthesis({
        originalPrompt: lastRun.prompt,
        results: lastRun.results.map((result) => ({
          agent: result.agent,
          status: result.status,
          finalText: result.finalText,
          rawOutput: result.finalText,
          source: result.source,
          diagnostics: [],
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          durationMs: 0
        })),
        judgeAdapter,
        cwd,
        timeoutMs: config.defaults.timeoutMs,
        safetyPolicy: config.defaults.safetyPolicy
      });

      setSynthesis(synthesisResult.synthesis);
      setDisagreements(synthesisResult.disagreements);
      setStatusLine("Synthesis refreshed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusLine(`Synthesis rerun failed: ${message}`);
    }
  };

  useInput(async (input, key) => {
    if (key.ctrl && input === "c") {
      exit();
      return;
    }

    if (input === "q") {
      exit();
      return;
    }

    if (key.tab) {
      const index = focusOrder.indexOf(focus);
      const next = focusOrder[(index + 1) % focusOrder.length];
      setFocus(next);
      return;
    }

    if (input === "1") {
      setFocus("codex");
      return;
    }
    if (input === "2") {
      setFocus("claude");
      return;
    }
    if (input === "3") {
      setFocus("gemini");
      return;
    }
    if (input === "4") {
      setFocus("kimi");
      return;
    }

    if (input === "a") {
      setFocus("input");
      setStatusLine("Input focused.");
      return;
    }

    if (input === "r") {
      await rerunFailedAgents();
      return;
    }

    if (input === "s") {
      await rerunSynthesis();
      return;
    }

  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="round" borderColor="green" paddingX={1} marginBottom={1}>
        <Text>
          Orcha CLI {running ? <Spinner type="dots" /> : ""} {running ? " running" : " idle"}
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>Agents: {enabledAgents.join(", ")}</Text>
      </Box>

      <Box flexDirection="row" flexWrap="wrap" gap={1}>
        {orderedAgents.map((agent) => {
          const pane = agentStates[agent];
          const text = pane.text.length > 600 ? `${pane.text.slice(0, 600)}...` : pane.text;
          const metrics = [
            pane.inputTokens !== undefined ? `in=${pane.inputTokens}` : undefined,
            pane.outputTokens !== undefined ? `out=${pane.outputTokens}` : undefined
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <Panel
              key={agent}
              title={agent}
              status={pane.status}
              source={pane.source}
              focused={focus === agent}
              metrics={metrics || undefined}
            >
              <Text>{pane.error ? `Error: ${pane.error}` : text || "(no output yet)"}</Text>
            </Panel>
          );
        })}
      </Box>

      <Box borderStyle="round" borderColor={focus === "synthesis" ? "cyan" : "gray"} padding={1} marginTop={1}>
        <Box flexDirection="column">
          <Text color={focus === "synthesis" ? "cyan" : "white"}>Synthesis</Text>
          <Text>{synthesis || "(synthesis pending)"}</Text>
          {disagreements.length > 0 ? <Text dimColor>{`Disagreements: ${disagreements.join(" | ")}`}</Text> : null}
        </Box>
      </Box>

      <Box borderStyle="round" borderColor={focus === "input" ? "cyan" : "gray"} paddingX={1} marginTop={1}>
        <Text color="yellow">Prompt: </Text>
        <TextInput value={prompt} onChange={setPrompt} onSubmit={(value) => runPrompt(value)} focus={focus === "input"} />
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>Status: {statusLine}</Text>
        <Text dimColor>Keys: tab switch pane | 1-4 agent pane | a input | r rerun failed | s rerun synthesis | q quit</Text>
        <Text dimColor>Safety: best-effort read-only; Gemini/Kimi guarantees are weaker in CLI mode.</Text>
      </Box>
    </Box>
  );
}
