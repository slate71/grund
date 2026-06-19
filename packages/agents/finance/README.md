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

## Build status (milestone 1)

- ✅ Schema (`@grund/db` + runtime bootstrap), categorizer, read API, sync
  pipeline, normalization.
- ⛔ **Not yet wired:** the credential-proxy `/simplefin` route (milestone 2).
  Until it exists, `runSync()` logs a warning and no-ops; everything downstream
  (categorization, API) works against whatever transactions are present.

Once milestone 2 lands the proxy route, the agent ingests real transactions on
its 30-minute cron with no further changes here.

## Environment

| Variable               | Required | Default                  |
| ---------------------- | -------- | ------------------------ |
| `DATABASE_URL`         | yes      | —                        |
| `REDIS_URL`            | yes      | —                        |
| `CREDENTIAL_PROXY_URL` | yes      | —                        |
| `ANTHROPIC_BASE_URL`   | no       | `$CREDENTIAL_PROXY_URL/anthropic` |
| `PORT`                 | no       | `3003`                   |
| `CATEGORIZE_BATCH`     | no       | `25`                     |
