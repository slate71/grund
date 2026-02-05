# Grund

> Building agentic systems that run business operations end-to-end

A monorepo for developing autonomous agents that handle real-world workflows. Starting with my own operations (career, consulting, finances), expanding to small business back-offices.

## What's Here

### Built and Working
- **Career Ops Agent** - Manages my job search pipeline, network relationships, and daily actions
- **Client Management System** - Template-based workspace for consulting engagements
- **AI Interaction Classifier** - Evaluates conversation outcomes for support automation

### Architecture
- **TypeScript** throughout with strict types
- **Modular API** with Fastify and domain-separated routes
- **PostgreSQL** with Drizzle ORM and schema separation
- **React** dashboard for monitoring agent operations

## Project Structure

```
grund/
├── apps/
│   ├── dashboard/          # Operations monitoring dashboard
│   ├── chat-demo/          # Testing ground for AI interactions
│   └── hooks-demo/         # React hooks demonstration
├── packages/
│   ├── agents/             # Autonomous agent definitions
│   │   └── career-ops/     # Job search automation agent
│   ├── api/                # Backend API with modular routes
│   ├── db/                 # Database schemas and migrations
│   ├── shared/             # Shared types and utilities
│   └── react-hooks/        # Reusable React patterns
└── clients/                # Consulting workspaces (gitignored)
    └── _template/          # Template for new clients
```

## Prerequisites

- Node.js >= 18.0.0
- [Bun](https://bun.sh) >= 1.0.0

## Getting Started

1. **Clone and install:**
   ```bash
   git clone https://github.com/slate71/grund.git
   cd grund
   bun install
   ```

2. **Set up database:**
   ```bash
   cp .env.example .env
   # Add your DATABASE_URL to .env
   bun db:push
   ```

3. **Start development:**
   ```bash
   bun dev
   ```

4. **Explore the Career Ops Agent:**
   ```bash
   cd packages/agents/career-ops
   cat CONTEXT.md  # See agent positioning
   cat data/pipeline.json  # See opportunity tracking
   ```

## Available Scripts

```bash
bun dev              # Start API and dashboard
bun dev:api          # Start API only
bun dev:dashboard    # Start dashboard only
bun test             # Run all tests
bun typecheck        # Type check all packages
bun db:push          # Push database schema changes
bun db:studio        # Open Drizzle Studio for database
```

## Key Features

### Career Ops Agent (`packages/agents/career-ops/`)
- **CONTEXT.md** - Agent's persistent memory and positioning
- **pipeline.json** - Job opportunity tracking with stages
- **network.json** - Contact relationship management
- TypeScript types and helper functions
- 100% test coverage on data operations

### Client Management (`clients/`)
- Private workspaces for consulting engagements
- Template structure for consistent organization
- All client data gitignored for privacy
- See `clients/README.md` for usage

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development workflow and branching strategy.

## License

MIT
