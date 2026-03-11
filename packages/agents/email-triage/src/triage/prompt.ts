export const TRIAGE_SYSTEM_PROMPT = `You are an email triage assistant. Classify each email into exactly one category and decide what actions to take.

Categories:
- urgent_action: Time-sensitive, requires immediate response (e.g., security alerts, critical requests from known contacts, deadlines within 24h)
- action_required: Needs a response or action but not time-critical (e.g., meeting requests, questions from colleagues, follow-ups)
- informational: Worth reading but no action needed (e.g., FYI emails, status updates, announcements)
- newsletter_valued: Newsletters or digests the user has opted into and finds valuable
- newsletter_noise: Newsletters, marketing emails, or digests that are low value
- notification: Automated notifications from services (e.g., GitHub, Jira, CI/CD, shipping updates)
- promotion: Marketing, sales, or promotional emails

Rules:
- Emails from real people asking direct questions = action_required or urgent_action
- Automated "noreply" emails = notification unless they require action
- If unsure between two categories, pick the one with higher priority (urgent > action > informational > notification > promotion)
- confidence should be 0.0 to 1.0
- Set shouldDraftReply=true only for urgent_action and action_required
- suggestedLabels should contain label names to apply
- archiveAfter=true means remove from inbox after labeling`

export const TRIAGE_TOOL_DEFINITION = {
  name: 'classify_email',
  description: 'Classify an email and decide on triage actions',
  input_schema: {
    type: 'object' as const,
    properties: {
      category: {
        type: 'string',
        enum: [
          'urgent_action',
          'action_required',
          'informational',
          'newsletter_valued',
          'newsletter_noise',
          'notification',
          'promotion',
        ],
        description: 'The triage category for this email',
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Classification confidence (0.0 to 1.0)',
      },
      reason: {
        type: 'string',
        description: 'Brief explanation for the classification',
      },
      shouldDraftReply: {
        type: 'boolean',
        description: 'Whether a draft reply should be created',
      },
      suggestedLabels: {
        type: 'array',
        items: { type: 'string' },
        description: 'Gmail labels to apply',
      },
      archiveAfter: {
        type: 'boolean',
        description: 'Whether to archive after labeling',
      },
    },
    required: [
      'category',
      'confidence',
      'reason',
      'shouldDraftReply',
      'suggestedLabels',
      'archiveAfter',
    ],
  },
}

export const DRAFT_REPLY_SYSTEM_PROMPT = `You are composing a brief, professional email reply draft. The user will review and edit before sending.

Rules:
- Keep replies concise and direct
- Match the tone of the original email
- If the email is a question, answer it directly or acknowledge and provide a timeline
- If the email is a request, confirm receipt and next steps
- Do not include a signature — the user's email client adds one
- Output only the reply body text, no subject line or headers`
