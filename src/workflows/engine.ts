import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import type { RunResult, WorkflowSpec } from "../types.js";
import { workflowSpecSchema } from "./schema.js";
import { getWorkflowDir } from "../utils/path.js";
import type { CouncilOrchestrator } from "../core/orchestrator.js";

export interface WorkflowRunRequest {
  name: string;
  input: string;
  cwd: string;
  sessionId?: string;
  allowApiFallback: boolean;
}

export interface WorkflowRunResult {
  workflow: WorkflowSpec;
  stageOutputs: Record<string, string>;
  runResults: RunResult[];
}

function interpolate(template: string, values: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

export function loadWorkflowSpec(cwd: string, name: string): WorkflowSpec {
  const dir = getWorkflowDir(cwd);
  const candidates = [path.join(dir, `${name}.yaml`), path.join(dir, `${name}.yml`)];

  const file = candidates.find((candidate) => fs.existsSync(candidate));
  if (!file) {
    throw new Error(`Workflow '${name}' not found in ${dir}`);
  }

  const raw = fs.readFileSync(file, "utf8");
  const parsed = YAML.parse(raw);
  return workflowSpecSchema.parse(parsed);
}

export async function runWorkflow(
  orchestrator: CouncilOrchestrator,
  request: WorkflowRunRequest
): Promise<WorkflowRunResult> {
  const workflow = loadWorkflowSpec(request.cwd, request.name);

  const stageOutputs: Record<string, string> = {};
  const runResults: RunResult[] = [];

  let previous = request.input;

  for (const stage of workflow.stages) {
    const prompt = interpolate(stage.promptTemplate, {
      input: request.input,
      previous,
      ...Object.fromEntries(Object.entries(stageOutputs).map(([key, value]) => [`stage.${key}.output`, value]))
    });

    const result = await orchestrator.runCommittee(
      {
        prompt,
        agents: [stage.agent],
        cwd: request.cwd,
        synthesis: false,
        judgeAgent: "codex",
        timeoutMs: stage.timeoutMs ?? 120000,
        allowApiFallback: request.allowApiFallback,
        sessionId: request.sessionId,
        mode: "workflow"
      },
      undefined
    );

    runResults.push(result);

    const stageResult = result.results[0];
    stageOutputs[stage.id] = stageResult.finalText;
    previous = stageResult.finalText;

    if (stageResult.status !== "success" && (stage.onFailure ?? "abort") === "abort") {
      break;
    }
  }

  return {
    workflow,
    stageOutputs,
    runResults
  };
}
