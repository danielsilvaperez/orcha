import type { ScaffoldSpec } from "../speedrun/types.js";

export const fullstackAppScaffold: ScaffoldSpec = {
  name: "fullstack-app",
  version: 1,
  description: "Modern fullstack application with React frontend and API backend",
  tags: ["web", "react", "api", "fullstack"],
  finalMergeAgent: "claude",
  finalMergePrompt: `You are the project integration lead. 

Review all the work from the specialized teams below and create a cohesive, production-ready fullstack application. 

Your responsibilities:
1. Ensure consistency between API contracts (backend) and data fetching (frontend)
2. Verify that database schemas match API payloads
3. Check that component hierarchy aligns with the architecture
4. Identify any missing integration points
5. Produce final file structure and any missing glue code

Respond with:
1. A summary of integration points verified
2. Any discrepancies found and how to fix them  
3. The final unified file structure
4. Any additional files needed for integration`,
  tasks: [
    {
      id: "requirements-analysis",
      name: "Requirements Analysis",
      description: "Analyze project requirements and create detailed specifications",
      agent: "claude",
      dependsOn: [],
      allowSubagents: true,
      maxSubagents: 3,
      promptTemplate: `Analyze the following project and create detailed requirements:

Project: {{projectName}}
Description: {{description}}

Create comprehensive requirements covering:
1. Functional requirements (user stories, features)
2. Non-functional requirements (performance, security, scalability)
3. API contract requirements  
4. Data model requirements
5. UI/UX requirements
6. Integration requirements

Use your subagents if available to research best practices for similar projects.

Respond with a structured requirements document that other agents can use as reference.`,
      timeoutMs: 180000
    },
    {
      id: "architecture-design",
      name: "Architecture Design",
      description: "Design system architecture and technology choices",
      agent: "gemini",
      dependsOn: ["requirements-analysis"],
      allowSubagents: true,
      maxSubagents: 2,
      promptTemplate: `Design the system architecture for:

Project: {{projectName}}
Description: {{description}}

Requirements from analysis phase:
{{stage.requirements-analysis.output}}

Your task:
1. Recommend technology stack with justifications
2. Design high-level system architecture (components, services)
3. Define data flow between frontend and backend
4. Plan deployment architecture
5. Identify potential bottlenecks and mitigation strategies

Use subagents to evaluate different technology options in parallel if available.

Respond with architecture diagrams (as text/ASCII or descriptions) and technology decisions.`,
      timeoutMs: 180000
    },
    {
      id: "database-schema",
      name: "Database Schema Design",
      description: "Design database schema and models",
      agent: "codex",
      dependsOn: ["requirements-analysis", "architecture-design"],
      allowSubagents: false,
      promptTemplate: `Design the database schema for:

Project: {{projectName}}

Requirements:
{{stage.requirements-analysis.output}}

Architecture:
{{stage.architecture-design.output}}

Create:
1. Complete database schema with tables/collections
2. Field definitions with types and constraints
3. Relationships and foreign keys
4. Indexes for performance
5. Migration scripts (if applicable)
6. Seed data recommendations

Respond with SQL/DDL or schema definitions that can be directly used.`,
      outputFiles: ["schema.sql", "migrations/001_initial.sql"],
      timeoutMs: 120000
    },
    {
      id: "backend-api",
      name: "Backend API Implementation",
      description: "Implement backend API endpoints and business logic",
      agent: "codex",
      dependsOn: ["architecture-design", "database-schema"],
      allowSubagents: true,
      maxSubagents: 4,
      promptTemplate: `Implement the backend API for:

Project: {{projectName}}

Architecture:
{{stage.architecture-design.output}}

Database Schema:
{{stage.database-schema.output}}

Your task:
1. Set up project structure and dependencies
2. Implement all API endpoints following REST/GraphQL best practices
3. Implement data models and database access layer
4. Add input validation and error handling
5. Implement authentication/authorization if needed
6. Add unit tests for critical paths

Use your subagents to work on different endpoint groups in parallel.

Respond with the complete file structure and all source code files.`,
      outputFiles: ["src/server.ts", "src/routes/", "src/models/", "src/middleware/"],
      timeoutMs: 300000
    },
    {
      id: "frontend-components",
      name: "Frontend Component Architecture",
      description: "Design and implement React components",
      agent: "kimi",
      dependsOn: ["architecture-design"],
      allowSubagents: true,
      maxSubagents: 5,
      promptTemplate: `Implement the React frontend for:

Project: {{projectName}}

Architecture:
{{stage.architecture-design.output}}

Your task:
1. Set up React project structure with proper folder organization
2. Create component hierarchy and design system
3. Implement core UI components (buttons, forms, layouts, navigation)
4. Implement data fetching hooks and state management
5. Create page components for main routes
6. Add responsive design and accessibility
7. Add component tests

Use your subagents to build different component groups in parallel (e.g., one for forms, one for data display, etc).

Respond with the complete file structure and all source code.`,
      outputFiles: ["src/App.tsx", "src/components/", "src/hooks/", "src/pages/", "src/store/"],
      timeoutMs: 300000
    },
    {
      id: "frontend-backend-integration",
      name: "Frontend-Backend Integration",
      description: "Connect frontend to backend APIs",
      agent: "kimi",
      dependsOn: ["frontend-components", "backend-api"],
      allowSubagents: false,
      promptTemplate: `Integrate the frontend with the backend API:

Backend API:
{{stage.backend-api.output}}

Frontend Components:
{{stage.frontend-components.output}}

Your task:
1. Create API client/service layer matching backend endpoints
2. Update components to use real data from API
3. Implement error handling and loading states
4. Add form submissions and validation
5. Ensure TypeScript types match API contracts
6. Add request/response interceptors if needed

Respond with the integration code and any necessary component updates.`,
      outputFiles: ["src/services/api.ts", "src/types/api.ts"],
      timeoutMs: 180000
    },
    {
      id: "devops-setup",
      name: "DevOps & Deployment Setup",
      description: "Configure CI/CD, Docker, and deployment",
      agent: "gemini",
      dependsOn: ["architecture-design"],
      allowSubagents: false,
      promptTemplate: `Set up DevOps and deployment configuration for:

Project: {{projectName}}

Architecture:
{{stage.architecture-design.output}}

Create:
1. Dockerfile for frontend and backend
2. Docker Compose for local development
3. GitHub Actions/GitLab CI workflows
4. Environment configuration (.env templates)
5. Deployment scripts for cloud platforms
6. Health checks and monitoring setup
7. SSL/TLS configuration

Respond with all configuration files and deployment instructions.`,
      outputFiles: ["Dockerfile", "docker-compose.yml", ".github/workflows/ci.yml", "scripts/deploy.sh"],
      timeoutMs: 180000
    },
    {
      id: "testing-strategy",
      name: "Testing Strategy & Implementation",
      description: "Comprehensive test suite",
      agent: "claude",
      dependsOn: ["backend-api", "frontend-components"],
      allowSubagents: true,
      maxSubagents: 3,
      promptTemplate: `Create comprehensive tests for:

Backend:
{{stage.backend-api.output}}

Frontend:
{{stage.frontend-components.output}}

Your task:
1. Unit tests for backend services and utilities
2. API integration tests
3. Frontend component tests (React Testing Library)
4. E2E test scenarios (Cypress/Playwright)
5. Test data factories and mocks
6. Performance test plan

Use subagents to generate different test suites in parallel.

Respond with complete test files and testing documentation.`,
      outputFiles: ["tests/", "cypress/", "playwright.config.ts"],
      timeoutMs: 240000
    }
  ]
};

export const microservicesScaffold: ScaffoldSpec = {
  name: "microservices",
  version: 1,
  description: "Distributed microservices architecture with service mesh",
  tags: ["microservices", "distributed", "kubernetes", "grpc"],
  finalMergeAgent: "gemini",
  finalMergePrompt: `You are the systems integration architect.

Review all microservice designs and ensure:
1. Service boundaries are well-defined (no circular dependencies)
2. Inter-service communication patterns are consistent
3. Data consistency strategies are documented
4. Service discovery and configuration are unified
5. Observability is consistent across all services

Produce the final service topology and integration guide.`,
  tasks: [
    {
      id: "domain-analysis",
      name: "Domain Analysis & Service Boundaries",
      description: "Identify bounded contexts and service boundaries",
      agent: "claude",
      dependsOn: [],
      allowSubagents: true,
      maxSubagents: 3,
      promptTemplate: `Perform domain-driven design analysis for:

Project: {{projectName}}
Description: {{description}}

Your task:
1. Identify core domains and subdomains
2. Define bounded contexts
3. Map context relationships and integrations
4. Identify aggregates and entities per context
5. Design domain events for async communication
6. Document ubiquitous language per context

Use subagents to analyze different domains in parallel.

Respond with domain model, service boundaries, and context map.`,
      timeoutMs: 240000
    },
    {
      id: "api-gateway-design",
      name: "API Gateway Design",
      description: "Design the API gateway and routing strategy",
      agent: "gemini",
      dependsOn: ["domain-analysis"],
      allowSubagents: false,
      promptTemplate: `Design the API Gateway for the microservices:

Domain Analysis:
{{stage.domain-analysis.output}}

Your task:
1. Design gateway routing rules
2. Implement authentication/authorization at gateway level
3. Design rate limiting and throttling strategy
4. Plan request/response transformation
5. Design caching strategy
6. Implement circuit breaker patterns

Respond with gateway configuration and routing rules.`,
      outputFiles: ["gateway/config.yml", "gateway/middleware/"],
      timeoutMs: 180000
    },
    {
      id: "service-auth",
      name: "Auth Service Implementation",
      description: "Centralized authentication service",
      agent: "codex",
      dependsOn: ["api-gateway-design"],
      allowSubagents: false,
      promptTemplate: `Implement the Authentication Service:

Gateway Design:
{{stage.api-gateway-design.output}}

Create a complete auth service with:
1. User registration and login
2. JWT token generation and validation
3. OAuth2/OIDC integration (if applicable)
4. Password reset flows
5. Session management
6. Service-to-service authentication

Include gRPC/HTTP handlers and database schema.`,
      outputFiles: ["services/auth/"],
      timeoutMs: 240000
    },
    {
      id: "core-services",
      name: "Core Business Services",
      description: "Implement core domain services in parallel",
      agent: "codex",
      dependsOn: ["domain-analysis", "service-auth"],
      allowSubagents: true,
      maxSubagents: 6,
      promptTemplate: `Implement the core microservices based on domain analysis:

Domain Analysis:
{{stage.domain-analysis.output}}

Auth Service (for reference):
{{stage.service-auth.output}}

Your task:
1. Generate service implementations for each bounded context
2. Each service should have: API handlers, business logic, data layer
3. Implement gRPC and/or HTTP endpoints
4. Add health checks and readiness probes
5. Implement graceful shutdown
6. Add structured logging and tracing hooks

Use subagents to implement each service in parallel.

Respond with complete source code for all services.`,
      outputFiles: ["services/"],
      timeoutMs: 360000
    },
    {
      id: "event-bus",
      name: "Event Bus & Async Messaging",
      description: "Implement event-driven communication",
      agent: "gemini",
      dependsOn: ["domain-analysis"],
      allowSubagents: false,
      promptTemplate: `Design and implement the event bus infrastructure:

Domain Events from Analysis:
{{stage.domain-analysis.output}}

Your task:
1. Design event schema registry
2. Implement event publisher/subscriber patterns
3. Set up message broker configuration (Kafka/RabbitMQ/NATS)
4. Implement dead letter queues
5. Design event sourcing where appropriate
6. Add idempotency handling
7. Implement saga pattern for distributed transactions

Respond with event definitions and infrastructure code.`,
      outputFiles: ["events/", "infra/kafka/", "infra/nats/"],
      timeoutMs: 240000
    },
    {
      id: "observability",
      name: "Observability Stack",
      description: "Logging, metrics, and distributed tracing",
      agent: "kimi",
      dependsOn: ["core-services"],
      allowSubagents: false,
      promptTemplate: `Implement comprehensive observability:

Services:
{{stage.core-services.output}}

Create:
1. Structured logging configuration (JSON format)
2. Metrics collection (Prometheus)
3. Distributed tracing (OpenTelemetry/Jaeger)
4. Health check aggregation
5. Alerting rules
6. Grafana dashboards
7. Log aggregation (ELK/Loki)

Include configuration files and code instrumentation.`,
      outputFiles: ["observability/", "infra/prometheus/", "infra/grafana/"],
      timeoutMs: 180000
    },
    {
      id: "k8s-config",
      name: "Kubernetes Configuration",
      description: "K8s manifests and Helm charts",
      agent: "gemini",
      dependsOn: ["core-services", "event-bus", "observability"],
      allowSubagents: true,
      maxSubagents: 4,
      promptTemplate: `Create Kubernetes deployment configuration:

Services:
{{stage.core-services.output}}

Event Bus:
{{stage.event-bus.output}}

Observability:
{{stage.observability.output}}

Generate:
1. Deployment manifests for each service
2. Service definitions and ingress rules
3. ConfigMaps and Secrets management
4. Horizontal Pod Autoscaler configs
5. Helm charts with values files
6. Istio/Linkerd service mesh config (if applicable)
7. PodDisruptionBudgets and resource limits

Use subagents for different service groups.

Respond with all K8s YAML and Helm templates.`,
      outputFiles: ["k8s/", "helm/"],
      timeoutMs: 240000
    }
  ]
};

export const aiNativeAppScaffold: ScaffoldSpec = {
  name: "ai-native-app",
  version: 1,
  description: "AI-powered application with LLM integration, RAG, and agents",
  tags: ["ai", "llm", "rag", "agents", "vector-db"],
  finalMergeAgent: "claude",
  finalMergePrompt: `You are the AI systems integration lead.

Review the AI-native application components and ensure:
1. LLM integration patterns are consistent
2. RAG pipeline components work together end-to-end
3. Agent orchestration is coherent
4. Prompts are versioned and organized
5. Vector database schemas match embedding models
6. Cost optimization strategies are in place

Produce the final integrated system architecture and deployment guide.`,
  tasks: [
    {
      id: "ai-architecture",
      name: "AI Architecture Design",
      description: "Design LLM integration and AI component architecture",
      agent: "claude",
      dependsOn: [],
      allowSubagents: true,
      maxSubagents: 3,
      promptTemplate: `Design the AI architecture for:

Project: {{projectName}}
Description: {{description}}

Your task:
1. Select appropriate LLM(s) for different use cases
2. Design RAG architecture (chunking, embedding, retrieval)
3. Plan agent workflows and tool use
4. Design prompt management system
5. Plan vector database schema
6. Design evaluation framework
7. Plan cost optimization and caching strategy
8. Design safety/guardrail mechanisms

Use subagents to research different LLM options and RAG strategies.

Respond with comprehensive AI architecture document.`,
      timeoutMs: 240000
    },
    {
      id: "vector-db-setup",
      name: "Vector Database Setup",
      description: "Configure vector database and embedding pipeline",
      agent: "codex",
      dependsOn: ["ai-architecture"],
      allowSubagents: false,
      promptTemplate: `Implement the vector database infrastructure:

AI Architecture:
{{stage.ai-architecture.output}}

Your task:
1. Set up vector database (Pinecone/Weaviate/Chroma/pgvector)
2. Design collection/index schemas
3. Implement embedding pipeline
4. Create data ingestion scripts
5. Implement hybrid search (vector + keyword)
6. Add metadata filtering
7. Set up backup and migration strategies

Include configuration and all code.`,
      outputFiles: ["vector-db/", "embeddings/"],
      timeoutMs: 180000
    },
    {
      id: "rag-pipeline",
      name: "RAG Pipeline Implementation",
      description: "Complete retrieval-augmented generation system",
      agent: "kimi",
      dependsOn: ["vector-db-setup"],
      allowSubagents: true,
      maxSubagents: 3,
      promptTemplate: `Implement the RAG pipeline:

Vector DB Setup:
{{stage.vector-db-setup.output}}

Your task:
1. Document chunking strategies (semantic, fixed, recursive)
2. Implement preprocessing and cleaning
3. Build retrieval logic with re-ranking
4. Implement context assembly
5. Add query rewriting/expansion
6. Implement conversation history management
7. Add citation/source tracking
8. Build evaluation metrics

Use subagents to test different chunking and retrieval strategies.

Respond with complete RAG implementation.`,
      outputFiles: ["rag/chunking.py", "rag/retrieval.py", "rag/context.py"],
      timeoutMs: 240000
    },
    {
      id: "llm-gateway",
      name: "LLM Gateway & Routing",
      description: "Unified LLM access with fallback and routing",
      agent: "gemini",
      dependsOn: ["ai-architecture"],
      allowSubagents: false,
      promptTemplate: `Build the LLM Gateway service:

AI Architecture:
{{stage.ai-architecture.output}}

Your task:
1. Design unified API for multiple LLM providers
2. Implement provider routing based on use case
3. Add fallback logic between providers
4. Implement request batching
5. Add response streaming support
6. Build usage tracking and rate limiting
7. Implement prompt caching
8. Add model performance metrics

Include gateway service code and configuration.`,
      outputFiles: ["llm-gateway/"],
      timeoutMs: 180000
    },
    {
      id: "ai-agents",
      name: "AI Agents Implementation",
      description: "Autonomous agents with tool use",
      agent: "claude",
      dependsOn: ["llm-gateway", "rag-pipeline"],
      allowSubagents: true,
      maxSubagents: 4,
      promptTemplate: `Implement AI agents:

LLM Gateway:
{{stage.llm-gateway.output}}

RAG Pipeline:
{{stage.rag-pipeline.output}}

Your task:
1. Design agent framework (ReAct, Plan-and-Solve, etc.)
2. Implement tool definitions and schemas
3. Build agent memory/conversation management
4. Implement multi-agent collaboration patterns
5. Add agent observability and tracing
6. Build agent evaluation framework
7. Implement human-in-the-loop checkpoints

Use subagents to implement different agent types in parallel.

Respond with complete agent framework code.`,
      outputFiles: ["agents/", "tools/"],
      timeoutMs: 300000
    },
    {
      id: "prompt-management",
      name: "Prompt Management System",
      description: "Versioned prompts with A/B testing",
      agent: "kimi",
      dependsOn: ["ai-architecture"],
      allowSubagents: false,
      promptTemplate: `Build the prompt management system:

AI Architecture:
{{stage.ai-architecture.output}}

Your task:
1. Design prompt versioning scheme
2. Implement prompt templating (Jinja2/similar)
3. Build prompt registry and storage
4. Add A/B testing framework for prompts
5. Implement prompt performance tracking
6. Build prompt optimization suggestions
7. Add prompt evaluation/testing tools
8. Implement dynamic prompt selection

Include all code and configuration.`,
      outputFiles: ["prompts/", "prompts/registry.py"],
      timeoutMs: 180000
    },
    {
      id: "ai-evaluation",
      name: "AI Evaluation & Testing",
      description: "Comprehensive LLM and RAG evaluation",
      agent: "gemini",
      dependsOn: ["rag-pipeline", "ai-agents"],
      allowSubagents: true,
      maxSubagents: 3,
      promptTemplate: `Create AI evaluation framework:

RAG Pipeline:
{{stage.rag-pipeline.output}}

AI Agents:
{{stage.ai-agents.output}}

Your task:
1. Design evaluation datasets and benchmarks
2. Implement RAG evaluation metrics (retrieval accuracy, answer relevance)
3. Build LLM output evaluators (LLM-as-judge)
4. Implement A/B testing framework
5. Add regression testing for prompts
6. Build cost/performance trade-off analysis
7. Implement red-teaming tests
8. Create evaluation dashboards

Use subagents to generate test datasets and evaluation criteria.

Respond with complete evaluation framework.`,
      outputFiles: ["evaluation/", "tests/e2e/ai/"],
      timeoutMs: 240000
    }
  ]
};

export const tsLibraryScaffold: ScaffoldSpec = {
  name: "ts-library",
  version: 1,
  description: "TypeScript library with modern tooling, dual CJS/ESM exports, and comprehensive testing",
  tags: ["typescript", "library", "npm", "package"],
  finalMergeAgent: "codex",
  finalMergePrompt: `You are the library integration lead.

Review all contributions and ensure:
1. API surface is consistent and well-documented
2. Type definitions are complete and accurate
3. Build configuration produces valid CJS + ESM outputs
4. Test coverage is comprehensive
5. Package.json exports are correctly configured
6. Documentation examples work with the actual API

Produce the final library structure and integration report.`,
  tasks: [
    {
      id: "api-design",
      name: "API Design & Interface Definition",
      description: "Design the public API and type interfaces",
      agent: "claude",
      dependsOn: [],
      allowSubagents: true,
      maxSubagents: 2,
      promptTemplate: `Design the API for TypeScript library:

Project: {{projectName}}
Description: {{description}}

Your task:
1. Design the public API surface (functions, classes, types)
2. Define TypeScript interfaces and type aliases
3. Plan error handling patterns
4. Design for tree-shakability
5. Consider backward compatibility strategy
6. Plan plugin/extension points if applicable

Use subagents to explore different API design patterns.

Respond with complete API design including type definitions.`,
      outputFiles: ["src/types.ts", "API.md"],
      timeoutMs: 180000
    },
    {
      id: "core-implementation",
      name: "Core Implementation",
      description: "Implement library core functionality",
      agent: "codex",
      dependsOn: ["api-design"],
      allowSubagents: true,
      maxSubagents: 4,
      promptTemplate: `Implement the TypeScript library:

Project: {{projectName}}

API Design:
{{stage.api-design.output}}

Your task:
1. Set up TypeScript project structure
2. Implement all exported functions and classes
3. Add comprehensive JSDoc comments
4. Implement error handling
5. Add runtime type guards where needed
6. Ensure tree-shakable exports

Use subagents to implement different modules in parallel.

Respond with complete source code.`,
      outputFiles: ["src/index.ts", "src/"],
      timeoutMs: 300000
    },
    {
      id: "build-config",
      name: "Build Configuration",
      description: "Configure tsup/rollup for dual CJS/ESM output",
      agent: "gemini",
      dependsOn: ["api-design"],
      allowSubagents: false,
      promptTemplate: `Set up build configuration for TypeScript library:

API Design:
{{stage.api-design.output}}

Create:
1. tsup or rollup config for dual CJS/ESM builds
2. TypeScript compiler configuration
3. Package.json with proper exports map
4. Source map configuration
5. Declaration file generation
6. Build scripts and watch mode

Include all config files with explanations.`,
      outputFiles: ["tsup.config.ts", "tsconfig.json", "package.json"],
      timeoutMs: 120000
    },
    {
      id: "testing",
      name: "Test Suite Implementation",
      description: "Comprehensive test coverage with Vitest/Jest",
      agent: "kimi",
      dependsOn: ["core-implementation"],
      allowSubagents: true,
      maxSubagents: 3,
      promptTemplate: `Create comprehensive tests for the library:

Implementation:
{{stage.core-implementation.output}}

Your task:
1. Set up Vitest or Jest test runner
2. Write unit tests for all public functions
3. Add edge case and error handling tests
4. Create integration tests
5. Add type-level tests (tsd or expect-type)
6. Set up test coverage reporting
7. Add CI test workflow

Use subagents to test different modules in parallel.

Respond with complete test files and configuration.`,
      outputFiles: ["tests/", "vitest.config.ts", ".github/workflows/test.yml"],
      timeoutMs: 240000
    },
    {
      id: "documentation",
      name: "Documentation & Examples",
      description: "README, API docs, and usage examples",
      agent: "claude",
      dependsOn: ["core-implementation", "api-design"],
      allowSubagents: false,
      promptTemplate: `Create comprehensive documentation:

API Design:
{{stage.api-design.output}}

Implementation:
{{stage.core-implementation.output}}

Your task:
1. Write comprehensive README with badges
2. Create usage examples for common scenarios
3. Write API reference documentation
4. Add migration guide if applicable
5. Create CONTRIBUTING.md
6. Add CHANGELOG template
7. Write JSDoc examples that become docs

Respond with all documentation files.`,
      outputFiles: ["README.md", "CONTRIBUTING.md", "CHANGELOG.md", "examples/"],
      timeoutMs: 180000
    },
    {
      id: "ci-cd",
      name: "CI/CD & Publishing",
      description: "GitHub Actions for testing, releasing, and publishing",
      agent: "gemini",
      dependsOn: ["testing", "build-config"],
      allowSubagents: false,
      promptTemplate: `Set up CI/CD and publishing workflows:

Test Setup:
{{stage.testing.output}}

Build Config:
{{stage.build-config.output}}

Create:
1. GitHub Actions workflow for PR validation
2. Release workflow with automated changelog
3. npm publishing configuration
4. Semantic versioning setup
5. Automated dependency updates (Dependabot/Renovate)
6. Code quality checks (linting, formatting)
7. Bundle size monitoring

Respond with all CI/CD configuration files.`,
      outputFiles: [".github/workflows/", ".github/dependabot.yml"],
      timeoutMs: 180000
    },
    {
      id: "dev-experience",
      name: "Developer Experience Setup",
      description: "Linting, formatting, and development tools",
      agent: "kimi",
      dependsOn: ["build-config"],
      allowSubagents: false,
      promptTemplate: `Set up developer experience tooling:

Build Config:
{{stage.build-config.output}}

Create:
1. ESLint configuration with TypeScript rules
2. Prettier configuration
3. Husky pre-commit hooks
4. lint-staged configuration
5. VS Code settings and extensions recommendations
6. EditorConfig
7. Development scripts in package.json

Respond with all configuration files.`,
      outputFiles: ["eslint.config.js", ".prettierrc", ".husky/", ".vscode/"],
      timeoutMs: 120000
    }
  ]
};

export const scaffolds: ScaffoldSpec[] = [
  fullstackAppScaffold,
  microservicesScaffold,
  aiNativeAppScaffold,
  tsLibraryScaffold
];

export function getScaffold(name: string): ScaffoldSpec | undefined {
  return scaffolds.find((s) => s.name === name);
}

export function listScaffolds(): ScaffoldSpec[] {
  return scaffolds;
}
