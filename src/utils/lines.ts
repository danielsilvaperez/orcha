import readline from "node:readline";
import type { Readable } from "node:stream";

export async function* streamLines(stream: Readable): AsyncIterable<string> {
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    yield line;
  }
}
