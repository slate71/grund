# Grund Monorepo

This is the "everything as code" monorepo for running my own operations. One repo
runs the whole personal operation — agents, the dashboard that watches them, and the
infrastructure that keeps them safe. Everything ships with `git push`. AI has full
context because it's all here.

**Owner:** Lukas Andersen — Staff Frontend Engineer building toward $10M in assets by age 56.

This is a personal platform, not a product. Everything here serves my own operations.
There are no clients, no tenants, no customers — just me, my agents, and the harness
around them.

**Current state:** One working agent (email triage), with a credential-proxy and
dashboard around it. Adding agents one at a time, each shaped like the first.

## Structure

```
grund/
├── apps/
│   └── dashboard/              # React dashboard for monitoring agent activity
├── packages/
│   ├── agents/
│   │   ├── email-triage/       # Gmail triage: classify, draft, archive, daily brief
│   │   └── heartbeat/          # Liveness / health agent
│   ├── api/                    # Fastify API, domain-separated routes
│   ├── db/                     # Drizzle schema + migrations (Postgres)
│   ├── shared/                 # Shared types
│   └── logger/                 # Structured (pino) logger
├── infra/
│   └── credential-proxy/       # Brokers OAuth + Anthropic credentials for agents
├── styles/                     # Shared Tailwind base styles
└── scripts/                    # Docker management helpers
```

## How it fits together

Agents run as containers, classify and act with Claude (calling through the
credential-proxy so they never hold secrets directly), record results to Postgres,
and publish events to Redis. The API and dashboard read that history so I can see
what the agents did.

The shape of `email-triage` is the template: each new agent gets its own package
under `packages/agents/`, talks to Claude through the proxy, persists to Postgres,
and emits events the dashboard can show.
