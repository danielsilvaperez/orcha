# Council CLI

Council is a multi-agent coding roundtable CLI that orchestrates Codex, Claude, Gemini, and Kimi.

## Install

```bash
pnpm install
pnpm build
```

For global usage:

```bash
npm i -g .
```

## Commands

```bash
council
council ask "How should I structure this feature?"
council repl
council doctor
council init --with-local
council workflow run sample --input "Build an API plan"
```

## Config

- Global: `~/.council/config.toml`
- Project: `<cwd>/.council.toml`
- Workflows: `<cwd>/.council/workflows/*.yaml`

Run `council init` to bootstrap defaults.
