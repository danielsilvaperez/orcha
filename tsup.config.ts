import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "node20",
  sourcemap: true,
  splitting: false,
  clean: true,
  dts: true,
  banner: {
    js: "#!/usr/bin/env node"
  }
});
