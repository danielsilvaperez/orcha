import type { RunResult } from "../types.js";

export function printRunResultHuman(runResult: RunResult): void {
  console.log(`Run: ${runResult.runId}`);
  console.log(`Session: ${runResult.sessionId}`);
  console.log(`Duration: ${runResult.durationMs}ms`);
  console.log("");

  for (const result of runResult.results) {
    console.log(`=== ${result.agent.toUpperCase()} (${result.source}) [${result.status}] ===`);
    if (result.error) {
      console.log(`Error: ${result.error}`);
    }
    console.log(result.finalText || "(empty)");
    console.log("");
  }

  if (runResult.synthesis) {
    console.log("=== SYNTHESIS ===");
    console.log(runResult.synthesis);
    if (runResult.disagreements.length > 0) {
      console.log("\nDisagreements:");
      for (const disagreement of runResult.disagreements) {
        console.log(`- ${disagreement}`);
      }
    }
    console.log("");
  }
}
