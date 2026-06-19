# Grund

> A personal operating system, run as code

A monorepo of autonomous agents that handle my own day-to-day operations, the
dashboard that watches them, and the infrastructure that keeps them safe. Everything
ships with `git push`.

This is a personal platform — not a product. It exists to run my operations, and it
grows one agent at a time.

## What's Here

### Built and Working
- **Email triage agent** — watches Gmail, classifies incoming mail with Claude,
  drafts replies, archives newsletters, and sends a scannable brief twice a day
- **Credential proxy** — brokers OAuth and Anthropic credentials so agents never
  hold secrets directly
- **Heartbeat agent** — liveness and health checks
- **Dashboard + API** — monitor agent activity and review classified outcomes

### Architecture
- **TypeScript** throughout with strict types
- **Modular API** with Fastify and domain-separated routes
- **PostgreSQL** with Drizzle ORM and schema separation
- **Redis** for events and processing locks
- **React** dashboard for monitoring agent operations

## Project Structure

```
grund/
├── apps/
│   └── dashboard/          # Agent monitoring dashboard
├── packages/
│   ├── agents/
│   │   ├── email-triage/   # Gmail triage + daily brief
│   │   └── heartbeat/      # Liveness / health agent
│   ├── api/                # Backend API with modular routes
│   ├── db/                 # Database schemas and migrations
│   ├── shared/             # Shared types
│   └── logger/             # Structured logger
└── infra/
    └── credential-proxy/   # OAuth + Anthropic credential broker
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
