# Grund

> Building agentic systems that run business operations end-to-end

A monorepo for developing autonomous agents that handle real-world workflows. Starting with my own operations (career, consulting, finances), expanding to small business back-offices.

## What's Here

### Built and Working
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
│   ├── api/                # Backend API with modular routes
│   ├── db/                 # Database schemas and migrations
│   ├── shared/             # Shared types and utilities
│   └── react-hooks/        # Reusable React patterns
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

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development workflow and branching strategy.

## License

MIT
