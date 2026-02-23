# Agents

Autonomous services that run background operations for the Grund monorepo.

## Heartbeat (`@grund/heartbeat-agent`)

Scheduled health-check service. Runs on Fastify, logs heartbeats to Postgres, publishes to Redis, and streams events to SSE clients.

**What it does:**
- Sends a heartbeat every 5 minutes (status, uptime, memory) stored in `heartbeats` table
- Checks the contact pipeline for overdue follow-ups and pushes them to the `grund:followups:due` Redis queue
- Runs a daily comprehensive contact check at 9 AM
- Cleans up heartbeat records older than 30 days
- Exposes `/health` and `/heartbeat/stream` (SSE) endpoints on port 3001

**Infra:** PostgreSQL, Redis. Deployed via `docker-compose.agents.yml`.

**Run:** `bun --watch packages/agents/heartbeat/src/index.ts`

## Career Ops (`@grund/agents` → `career-ops/`)

Daily briefing generator. Reads local pipeline/network JSON files and CONTEXT.md frontmatter, then calls the Anthropic API to produce a structured morning briefing.

**What it does:**
- Parses `CONTEXT.md` YAML frontmatter (runway, burn, streaks)
- Loads `data/pipeline.json` (job opportunities by stage) and `data/network.json` (contacts by relationship tier)
- Builds a prompt with pipeline snapshot, overdue follow-ups, streak status, and optional Linear/Calendar integrations (stubbed)
- Calls Claude to generate 6 sections: Outreach Target, Commit Target, Pipeline Snapshot, Streak Status, Calendar Context, Weekly Review
- Supports `--demo` flag to preview the prompt without an API call

**Run:** `bun briefing` (from `packages/agents`) or `bun briefing` (from root)

## MCP Contacts (`@grund/mcp-contacts`)

Model Context Protocol server that exposes the contact pipeline to AI agents via stdio transport.

**Tools:**
- `add_contact` — add a contact with name, channel, status, notes
- `update_contact_status` — change status, auto-sets `last_touch_date`, logs event
- `log_contact_event` — log outreach_sent, reply_received, follow_up, or status_change
- `get_due_followups` — contacts in contacted/replied status with no touch in N days (default 3)
- `list_contacts` — list with optional status filter and limit

**Infra:** PostgreSQL (via `@grund/db` Drizzle schema), Redis.

## CLI Contacts (`@grund/cli-contacts`)

Command-line wrapper around the MCP contacts server.

**Commands:** `grund contact add|list|status|log`

## Adding a New Agent

1. Create a directory under `packages/agents/<name>/` or `packages/<name>/`
2. Add it to the Bun workspace in root `package.json`
3. If it needs Docker deployment, add a service to `docker-compose.agents.yml`
4. If it exposes MCP tools, follow the pattern in `mcp-contacts/src/index.ts`
