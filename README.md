# Grund

> Everything as code monorepo for portfolio operations

A comprehensive monorepo that runs an entire portfolio operation — dashboard, agents, career pipeline, marketing, and finances. Everything ships with `git push`. AI has full context because it's all here.

## Overview

**Current State:** Scaffolding. First feature will be a Daily Operations Brief agent.

## Project Structure

```
grund/
├── apps/
│   └── dashboard/         # Operations dashboard
├── packages/
│   ├── ops-ui/            # UI components (tool-invocation, agent-status)
│   ├── agents/             # Agent definitions
│   └── core/               # Shared types, MCP utils
├── career/                 # Job pipeline, prep, resume
├── marketing/              # Blog, portfolio site
├── docs/                   # Internal docs
└── finances/               # Budgets, Attain integration
```

## Prerequisites

- Node.js >= 18.0.0
- [Bun](https://bun.sh) >= 1.0.0

## Getting Started

1. **Install dependencies:**

   ```bash
   bun install
   ```

2. **Run development server:**

   ```bash
   bun dev
   ```

3. **Build all packages:**
   ```bash
   bun build
   ```

## Available Scripts

- `bun dev` - Start development server
- `bun build` - Build all packages
- `bun test` - Run tests across all packages
- `bun lint` - Lint all packages
- `bun typecheck` - Type check all packages

## Workspace Structure

This monorepo uses [Bun workspaces](https://bun.sh/docs/install/workspaces) to manage multiple packages:

- `apps/*` - Applications
- `packages/*` - Shared packages
- `career/` - Career pipeline tools
- `marketing/` - Marketing assets
- `finances/` - Financial management

## License

MIT
