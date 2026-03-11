# Claude Code Prompt: Grund Monorepo

This is the "everything as code" monorepo for a portfolio operator. One repo runs the entire operation — dashboard, agents, career pipeline, marketing, finances. Everything ships with `git push`. AI has full context because it's all here.

**Owner:** Lukas Andersen — Staff Frontend Engineer building toward $10M in assets by age 56.

**Current state:** Scaffolding.

**Planned structure:**

```
grund/
├── apps/dashboard/         # Operations dashboard
├── packages/ops-ui/        # UI components (tool-invocation, agent-status)
├── packages/agents/        # Agent definitions
├── packages/core/          # Shared types, MCP utils
├── marketing/              # Blog, portfolio site
├── docs/                   # Internal docs
└── finances/               # Budgets, Attain integration
```

**Existing work to migrate:**

- @slate71/tool-invocation (npm package)
- @slate71/agent-status (npm package)
