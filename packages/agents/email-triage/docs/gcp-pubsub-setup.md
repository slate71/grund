# GCP Pub/Sub Setup

Gmail notifications via Pub/Sub pull subscription. Configured in project `grund-email-triage-agent`.

## Resources

| Resource | Name | Details |
|----------|------|---------|
| Pub/Sub Topic | `gmail-notifications` | Gmail publishes here via `gmail-api-push@system.gserviceaccount.com` |
| Pub/Sub Subscription | `gmail-notifications-pull` | Pull mode, 30s ack deadline, 1h retention |
| Service Account | `grund-email-triage` | `grund-email-triage@grund-email-triage-agent.iam.gserviceaccount.com` |
| SA Key | `~/.config/grund/pubsub-sa-key.json` | On grund-server, volume-mounted into container at `/config/` |

## IAM Bindings

- `gmail-api-push@system.gserviceaccount.com` → `roles/pubsub.publisher` on topic
- `grund-email-triage@grund-email-triage-agent.iam.gserviceaccount.com` → `roles/pubsub.subscriber` on subscription

## Env Vars (grund-server)

```
GMAIL_NOTIFICATION_MODE=pubsub
GCP_PROJECT_ID=grund-email-triage-agent
PUBSUB_TOPIC=projects/grund-email-triage-agent/topics/gmail-notifications
PUBSUB_SUBSCRIPTION=gmail-notifications-pull
GOOGLE_APPLICATION_CREDENTIALS=/config/pubsub-sa-key.json
```

## How It Works

```
Gmail → Pub/Sub topic → Agent pulls notification → History API → Classify → Execute
```

1. `GmailWatcher` calls `users.watch()` per account, registering the topic
2. `PubSubListener` opens a streaming pull on the subscription
3. Notifications contain `emailAddress` — dispatched to the right account's handler
4. Handler fetches new messages via History API and processes them
5. Watch auto-renews every 24h (expires after 7 days)

## Recreating From Scratch

```bash
gcloud config set project grund-email-triage-agent

gcloud pubsub topics create gmail-notifications
gcloud pubsub subscriptions create gmail-notifications-pull \
  --topic=gmail-notifications \
  --ack-deadline=30 \
  --message-retention-duration=1h

gcloud pubsub topics add-iam-policy-binding gmail-notifications \
  --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" \
  --role="roles/pubsub.publisher"

gcloud iam service-accounts create grund-email-triage
gcloud pubsub subscriptions add-iam-policy-binding gmail-notifications-pull \
  --member="serviceAccount:grund-email-triage@grund-email-triage-agent.iam.gserviceaccount.com" \
  --role="roles/pubsub.subscriber"
gcloud iam service-accounts keys create ~/.config/grund/pubsub-sa-key.json \
  --iam-account=grund-email-triage@grund-email-triage-agent.iam.gserviceaccount.com
```
