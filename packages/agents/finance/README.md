# Finance agent

Ingests transactions from a bank aggregator (SimpleFIN), categorizes each one
with Claude, and exposes a read API over the results. Shaped like
`email-triage`: it talks to Claude through the credential-proxy, persists to
Postgres, and publishes events to Redis for the dashboard.

This is the data spine for "interact with AI about my spending." A chat
front-end (Telegram via NanoClaw) is a later milestone that calls this agent's
API — it never touches the aggregator token or the transaction store directly.

## How it works

```
SimpleFIN ──▶ credential-proxy (holds the token) ──▶ finance agent
                                                        │
                                  ┌─────────────────────┼───────────────────┐
                                  ▼                     ▼                    ▼
                            Postgres            Claude (categorize)      Redis events
                       (accounts, txns)         via the proxy            (dashboard)
```

- **Sync** (`simplefin/`): pulls accounts + transactions *through the proxy*, so
  the SimpleFIN token never enters this container. Output is normalized so a
  future swap to Plaid doesn't touch the rest of the agent.
- **Categorize** (`categorize/`): asks Claude to bucket each transaction into a
  flat spending taxonomy via forced tool-use — same pattern as the email-triage
  classifier (category, confidence, reason).
- **API** (`app.ts`): `GET /finance/transactions`, `GET /finance/spending`,
  `GET /health`.

## Build status

- ✅ Schema (`@grund/db` + runtime bootstrap), categorizer, read API, sync
  pipeline, normalization (milestone 1).
- ✅ Credential-proxy `/simplefin` route (milestone 2). Sync pulls real
  transactions once the proxy is configured with a SimpleFIN access URL — run
  `bun run setup-simplefin` in `infra/credential-proxy`. Until then `runSync()`
  logs a warning and no-ops; everything downstream (categorization, API) works
  against whatever transactions are present.

## Environment

| Variable               | Required | Default                  |
| ---------------------- | -------- | ------------------------ |
| `DATABASE_URL`         | yes      | —                        |
| `REDIS_URL`            | yes      | —                        |
| `CREDENTIAL_PROXY_URL` | yes      | —                        |
| `ANTHROPIC_BASE_URL`   | no       | `$CREDENTIAL_PROXY_URL/anthropic` |
| `PORT`                 | no       | `3003`                   |
| `CATEGORIZE_BATCH`     | no       | `25`                     |
