# Orcha

**Orcha** is a multi-agent orchestration CLI for turning ambitious software briefs into coordinated parallel execution across **Codex, Claude, Gemini, and Kimi**.

Unlike simple multi-agent chat, Orcha is built around dependency-aware scaffolds, subagent leverage, and structured merge steps so multi-model collaboration produces shippable project output rather than disconnected answers.

## At a Glance

| Dimension | Summary |
| --- | --- |
| Core idea | Convert one software brief into a coordinated multi-agent execution plan |
| Best for | Rapid prototyping, scaffold generation, and parallel implementation workflows |
| Differentiator | Dependency-aware batching plus subagent leverage across multiple model families |
| Output | Working project scaffolds, task graphs, and merge-ready implementation artifacts |

## What Orcha Optimizes For

Orcha is built for builders who care about throughput without surrendering structure. It does not simply ask several models the same question. It distributes work, respects dependency order, and turns parallel agent effort into something closer to a delivery pipeline than a brainstorm.

## Install

```bash
pnpm install
pnpm build
```

For global usage:

```bash
npm i -g .
```

## Fast First Command

```bash
orcha speedrun run fullstack-app \
  -n my-project \
  -d "A task management app with real-time collaboration"
```

This is the quickest way to see Orcha's orchestration model in action: one brief, multiple agents, explicit task dependencies, and a structured output directory.

## Commands

### Quick Ask (Committee Mode)
Get all agents to answer a question simultaneously:

```bash
orcha ask "How should I structure this feature?"
```

### Speedrun - Multi-Agent Project Scaffolding
**The main event.** Deploy all four AI tools in parallel to scaffold complete projects:

```bash
# List available scaffolds
orcha speedrun list

# Fullstack web app
orcha speedrun run fullstack-app \
  -n my-project \
  -d "A task management app with real-time collaboration"

# Microservices architecture  
orcha speedrun run microservices \
  -n order-service \
  -d "E-commerce order processing system"

# AI-native application
orcha speedrun run ai-native-app \
  -n rag-chatbot \
  -d "RAG-powered customer support chatbot"
```

### View Scaffold Task Graph
See how tasks will be parallelized before running:

```bash
orcha speedrun show fullstack-app
```

### Workflow Mode (Sequential)
For sequential agent workflows:

```bash
orcha workflow run sample --input "Build an API plan"
```

### Other Commands

```bash
orcha repl              # Interactive REPL
orcha doctor            # Check agent health
orcha init --with-local # Bootstrap config
```

## Speedrun: How It Works

### 1. Dependency Graph Analysis
Scaffolds define tasks with dependencies. Orcha automatically:
- Builds a dependency graph
- Identifies parallelizable task batches
- Executes each batch across available agents

### 2. Subagent Delegation
Each AI tool receives instructions to use **its own subagent capabilities**:
- **Claude**: Can spawn subagents for complex analysis
- **Codex**: Can delegate implementation tasks  
- **Kimi**: Can parallelize component development
- **Gemini**: Can research and evaluate options

### 3. Smart Task Distribution
```
Batch 0 (Parallel):
  ├─ Requirements Analysis (Claude + 3 subagents)
  └─ Domain Analysis (Gemini + 2 subagents)

Batch 1 (Parallel):
  ├─ Architecture Design (Gemini) [depends: requirements]
  ├─ Database Schema (Codex) [depends: requirements]
  └─ API Design (Claude) [depends: requirements]

Batch 2 (Parallel):
  ├─ Backend Implementation (Codex + 4 subagents)
  └─ Frontend Components (Kimi + 5 subagents)

Batch 3:
  └─ Integration (Kimi) [depends: backend, frontend]

Final:
  └─ Synthesis & Review (Claude)
```

### 4. Final Integration
A designated "merge agent" reviews all outputs and produces:
- Integration verification
- Cohesive project structure
- Any missing glue code
- Deployment instructions

## Available Scaffolds

### `fullstack-app`
Modern React + API application
- Requirements analysis with multi-perspective review
- Parallel backend/frontend development
- Database schema + API contract alignment
- DevOps & testing setup

### `microservices`
Distributed system architecture
- Domain-driven design with bounded contexts
- Service mesh configuration
- Event-driven messaging setup
- K8s manifests & observability

### `ai-native-app`
LLM-powered applications
- RAG pipeline implementation
- Vector database setup
- Agent framework
- Prompt management & evaluation

## Config

- Global: `~/.council/config.toml`
- Project: `<cwd>/.council.toml`
- Workflows: `<cwd>/.council/workflows/*.yaml`

Run `orcha init` to bootstrap defaults.

## Why Orcha?

| Approach | Limitation | Orcha Solution |
|----------|-----------|------------------|
| Single AI tool | Limited perspective | **4 specialized tools** collaborating |
| Sequential agent chains | Slow execution | **Parallel dependency graph** execution |
| Simple prompting | No delegation | **Subagent-aware** prompts |
| Manual project setup | Inconsistent | **Structured scaffolds** with best practices |

## Example: Building a Fullstack App

```bash
# Start the speedrun
orcha speedrun run fullstack-app \
  -n taskmaster \
  -d "A task management app with real-time collaboration, slack integration, and AI task prioritization"

# Orcha will:
# 1. Run requirements analysis (Claude spawns 3 subagents for different perspectives)
# 2. Run architecture design in parallel (Gemini evaluates tech options)
# 3. Generate database schema and API specs simultaneously
# 4. Execute backend + frontend development in parallel
#    - Codex delegates endpoint groups to subagents
#    - Kimi delegates component groups to subagents
# 5. Integrate frontend with backend APIs
# 6. Generate deployment configs
# 7. Final review by Claude for consistency

# Result: Complete project in taskmaster/ directory
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Speedrun Engine                        │
├─────────────────────────────────────────────────────────────┤
│  Scaffold Spec → Task Graph → Parallel Batches → Execution │
├─────────────────────────────────────────────────────────────┤
│  Agent Pool: Codex │ Claude │ Gemini │ Kimi                 │
│  Each can spawn their own subagents                          │
├─────────────────────────────────────────────────────────────┤
│  Final Merge: Integration review and synthesis              │
└─────────────────────────────────────────────────────────────┘
```

## License

MIT
