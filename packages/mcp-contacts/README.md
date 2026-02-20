# Grund Contact Pipeline

MCP server for managing contact outreach pipeline.

## Setup

1. Ensure PostgreSQL and Redis are running
2. Set environment variables:
   - `DATABASE_URL` - PostgreSQL connection string
   - `REDIS_URL` - Redis connection URL

3. Run migrations:
```bash
bun run db:migrate
```

## MCP Tools

- `add_contact` - Add new contact
- `update_contact_status` - Update status and last touch date
- `log_contact_event` - Log contact events
- `get_due_followups` - Get contacts needing follow-up
- `list_contacts` - List contacts with filters

## CLI Usage

```bash
# Add contact
grund contact add -n "John Doe" -c "Acme Corp" --channel linkedin

# List due contacts
grund contact list --due

# Update status
grund contact status <id> replied

# Log event
grund contact log <id> outreach_sent -n "Sent connection request"
```

## Heartbeat Integration

The heartbeat agent automatically:
- Checks for due follow-ups every 5 minutes
- Runs a comprehensive check daily at 9 AM
- Pushes due contacts to Redis queue: `grund:followups:due`