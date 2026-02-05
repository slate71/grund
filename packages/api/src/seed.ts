import { createDb, events, classifications } from '@grund/db'
import type { Message, Outcome } from '@grund/shared'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const db = createDb(databaseUrl)

interface SeedConversation {
  source: string
  conversation_id: string
  messages: Message[]
  metadata: Record<string, unknown>
  classification: {
    outcome: Outcome
    confidence: number
    reason: string
    signals: string[]
  }
}

const conversations: SeedConversation[] = [
  // SUCCESS cases (8)
  {
    source: 'pest-intake-agent',
    conversation_id: 'conv-001',
    messages: [
      {
        role: 'assistant',
        content: 'Welcome to GreenShield Pest Control! How can I help you today?',
      },
      { role: 'user', content: 'Hi, I have ants in my kitchen and need someone to come out.' },
      {
        role: 'assistant',
        content:
          'I can help with that! Ant infestations are very common. Can I get your address and a preferred day for service?',
      },
      { role: 'user', content: '1234 Oak Lane, Tuesday works best for me.' },
      {
        role: 'assistant',
        content:
          'Great, I have you booked for Tuesday between 9am-12pm at 1234 Oak Lane. A technician will call 30 minutes before arrival. Is there anything else?',
      },
      { role: 'user', content: "Nope, that's perfect. Thanks!" },
    ],
    metadata: { customer_id: 'cust-101', timestamp: '2025-01-15T10:30:00Z' },
    classification: {
      outcome: 'success',
      confidence: 0.95,
      reason: 'Customer successfully booked an ant treatment appointment.',
      signals: ['appointment_booked', 'customer_satisfied', 'clear_resolution'],
    },
  },
  {
    source: 'pest-intake-agent',
    conversation_id: 'conv-002',
    messages: [
      {
        role: 'assistant',
        content: 'Welcome to GreenShield Pest Control! How can I help you today?',
      },
      { role: 'user', content: 'How much does a termite inspection cost?' },
      {
        role: 'assistant',
        content:
          "Our termite inspection is $99 for a standard home, and it's free if you sign up for our annual protection plan at $299/year. Would you like to schedule one?",
      },
      { role: 'user', content: 'The annual plan sounds good actually. Can I sign up?' },
      {
        role: 'assistant',
        content:
          "Absolutely! I'll need your name, address, and we can schedule your first inspection. What works for you?",
      },
      { role: 'user', content: 'Sarah Miller, 567 Pine Street. Next Friday is ideal.' },
      {
        role: 'assistant',
        content:
          "You're all set, Sarah! Termite inspection scheduled for Friday at 567 Pine Street. You'll receive a confirmation email shortly.",
      },
    ],
    metadata: { customer_id: 'cust-102', timestamp: '2025-01-15T11:00:00Z' },
    classification: {
      outcome: 'success',
      confidence: 0.97,
      reason: 'Customer signed up for annual plan and booked a termite inspection.',
      signals: ['plan_signup', 'appointment_booked', 'pricing_provided', 'customer_satisfied'],
    },
  },
  {
    source: 'pest-intake-agent',
    conversation_id: 'conv-003',
    messages: [
      {
        role: 'assistant',
        content: 'Welcome to GreenShield Pest Control! How can I help you today?',
      },
      { role: 'user', content: "Do you handle wasp nests? There's one under my porch." },
      {
        role: 'assistant',
        content:
          "Yes, we do! Wasp nest removal is one of our most requested services. It's $150 for a standard removal. Would you like to schedule a visit?",
      },
      { role: 'user', content: 'Yes please, as soon as possible.' },
      {
        role: 'assistant',
        content: 'I have an opening tomorrow morning at 8am. Can I get your address?',
      },
      { role: 'user', content: '890 Elm Drive. Tomorrow at 8 is great.' },
      {
        role: 'assistant',
        content:
          'Done! Technician will be at 890 Elm Drive at 8am tomorrow. Please keep pets and children away from the nest area.',
      },
      { role: 'user', content: 'Will do, thank you so much!' },
    ],
    metadata: { customer_id: 'cust-103', timestamp: '2025-01-15T13:15:00Z' },
    classification: {
      outcome: 'success',
      confidence: 0.96,
      reason: 'Wasp nest removal appointment booked with urgent scheduling.',
      signals: [
        'appointment_booked',
        'urgent_scheduling',
        'pricing_provided',
        'safety_instructions',
      ],
    },
  },
  {
    source: 'pest-intake-agent',
    conversation_id: 'conv-004',
    messages: [
      {
        role: 'assistant',
        content: 'Welcome to GreenShield Pest Control! How can I help you today?',
      },
      {
        role: 'user',
        content: 'I just moved into a new house and want preventive pest treatment.',
      },
      {
        role: 'assistant',
        content:
          'Smart thinking! Our new homeowner package includes a full inspection and preventive treatment for $249. It covers ants, roaches, spiders, and rodents. Interested?',
      },
      { role: 'user', content: "That sounds reasonable. Let's do it." },
      {
        role: 'assistant',
        content: "Wonderful! What's the address and when would you like us to come?",
      },
      { role: 'user', content: '2200 Maple Court. Anytime next week.' },
      {
        role: 'assistant',
        content:
          'Booked for Wednesday next week at 2200 Maple Court, 10am-1pm window. Welcome to the neighborhood!',
      },
    ],
    metadata: { customer_id: 'cust-104', timestamp: '2025-01-15T14:20:00Z' },
    classification: {
      outcome: 'success',
      confidence: 0.94,
      reason: 'New homeowner booked preventive pest treatment package.',
      signals: ['appointment_booked', 'package_sold', 'pricing_provided'],
    },
  },
  {
    source: 'pest-intake-agent',
    conversation_id: 'conv-005',
    messages: [
      {
        role: 'assistant',
        content: 'Welcome to GreenShield Pest Control! How can I help you today?',
      },
      {
        role: 'user',
        content:
          'I called last week about mice. The technician came and I wanted to confirm the follow-up appointment.',
      },
      {
        role: 'assistant',
        content: 'Let me check your account. Can I get your name or customer ID?',
      },
      { role: 'user', content: 'Tom Bradley, customer ID cust-105.' },
      {
        role: 'assistant',
        content:
          'Hi Tom! I see your follow-up is scheduled for January 22nd at 2pm. The technician will check the bait stations and seal any new entry points.',
      },
      { role: 'user', content: "Perfect, that's what I thought. Thanks!" },
    ],
    metadata: { customer_id: 'cust-105', timestamp: '2025-01-16T09:00:00Z' },
    classification: {
      outcome: 'success',
      confidence: 0.92,
      reason: 'Customer confirmed existing follow-up appointment details.',
      signals: ['appointment_confirmed', 'account_lookup', 'customer_satisfied'],
    },
  },
  {
    source: 'pest-intake-agent',
    conversation_id: 'conv-006',
    messages: [
      {
        role: 'assistant',
        content: 'Welcome to GreenShield Pest Control! How can I help you today?',
      },
      { role: 'user', content: 'What areas do you serve?' },
      {
        role: 'assistant',
        content:
          "We serve the entire metro area including downtown, suburbs up to 30 miles out, and the following counties: Jefferson, Hamilton, and Clark. What's your location?",
      },
      { role: 'user', content: "I'm in Hamilton county, great. Do you do bed bug treatments?" },
      {
        role: 'assistant',
        content:
          "Yes! We offer heat treatment for bed bugs starting at $499 per room. It's the most effective method. Would you like to schedule an inspection first? It's free.",
      },
      { role: 'user', content: "Yes, let's do the free inspection first." },
      { role: 'assistant', content: 'Scheduled! Can I get your address and preferred time?' },
      { role: 'user', content: '4500 River Road, Saturday morning if possible.' },
      {
        role: 'assistant',
        content:
          "You're set for Saturday at 9am at 4500 River Road. Our inspector will assess the situation and provide a detailed treatment plan.",
      },
    ],
    metadata: { customer_id: 'cust-106', timestamp: '2025-01-16T10:45:00Z' },
    classification: {
      outcome: 'success',
      confidence: 0.93,
      reason:
        'Customer booked free bed bug inspection after getting service area and pricing info.',
      signals: [
        'service_area_confirmed',
        'inspection_booked',
        'pricing_provided',
        'customer_engaged',
      ],
    },
  },
  {
    source: 'pest-intake-agent',
    conversation_id: 'conv-007',
    messages: [
      {
        role: 'assistant',
        content: 'Welcome to GreenShield Pest Control! How can I help you today?',
      },
      { role: 'user', content: 'I need to reschedule my appointment from Thursday to Monday.' },
      {
        role: 'assistant',
        content: 'Of course! Can I get your name or customer ID to pull up the appointment?',
      },
      { role: 'user', content: 'Lisa Chen, cust-107.' },
      {
        role: 'assistant',
        content:
          "Found it, Lisa. Your roach treatment was set for Thursday at 11am. I've moved it to Monday at 11am. Same time work for you?",
      },
      { role: 'user', content: 'Monday at 11 is perfect. Thanks for making that easy!' },
    ],
    metadata: { customer_id: 'cust-107', timestamp: '2025-01-16T12:30:00Z' },
    classification: {
      outcome: 'success',
      confidence: 0.96,
      reason: 'Customer successfully rescheduled their pest treatment appointment.',
      signals: ['appointment_rescheduled', 'account_lookup', 'customer_satisfied'],
    },
  },
  {
    source: 'pest-intake-agent',
    conversation_id: 'conv-008',
    messages: [
      {
        role: 'assistant',
        content: 'Welcome to GreenShield Pest Control! How can I help you today?',
      },
      {
        role: 'user',
        content: "I'm a landlord with 3 rental units. Do you offer commercial rates?",
      },
      {
        role: 'assistant',
        content:
          'Yes! For multi-unit properties, we offer a bulk service discount. Three units would be $175/unit instead of our standard $249. That includes quarterly treatments.',
      },
      { role: 'user', content: 'That works. Can we start next month with all three units?' },
      {
        role: 'assistant',
        content:
          "Absolutely! I'll set up a commercial account. Can I get the property addresses and your contact info?",
      },
      {
        role: 'user',
        content:
          'Units are at 100, 102, and 104 West Main St. My name is Robert James, email robert@jamesproperties.com.',
      },
      {
        role: 'assistant',
        content:
          "Commercial account created. I'll have our business team send you the service agreement by email. First visit scheduled for February 3rd.",
      },
    ],
    metadata: { customer_id: 'cust-108', timestamp: '2025-01-16T14:00:00Z' },
    classification: {
      outcome: 'success',
      confidence: 0.91,
      reason: 'Landlord signed up for commercial multi-unit pest service plan.',
      signals: ['commercial_account', 'multi_unit_booking', 'bulk_pricing', 'agreement_initiated'],
    },
  },

  // FAILURE cases (5)
  {
    source: 'pest-intake-agent',
    conversation_id: 'conv-009',
    messages: [
      {
        role: 'assistant',
        content: 'Welcome to GreenShield Pest Control! How can I help you today?',
      },
      {
        role: 'user',
        content:
          'Your technician came yesterday and the roaches are STILL everywhere. This is ridiculous.',
      },
      {
        role: 'assistant',
        content:
          "I'm sorry to hear that. Sometimes treatments take 2-3 days to fully work as the product spreads through the colony.",
      },
      {
        role: 'user',
        content:
          "That's what they said last time too! I've paid $400 and nothing has changed. I want a refund.",
      },
      {
        role: 'assistant',
        content:
          'I understand your frustration. Our satisfaction guarantee covers re-treatments at no cost. Would you like me to schedule one?',
      },
      {
        role: 'user',
        content:
          "No, I don't want another treatment that doesn't work. I want my money back. This is the worst service I've ever had.",
      },
      {
        role: 'assistant',
        content:
          "I'm sorry you feel that way. I can process your request but refunds need to be handled by our billing department. Can I have them call you?",
      },
      {
        role: 'user',
        content:
          "Fine, but if I don't hear back by tomorrow I'm disputing the charge with my credit card company.",
      },
    ],
    metadata: { customer_id: 'cust-109', timestamp: '2025-01-17T08:30:00Z' },
    classification: {
      outcome: 'failure',
      confidence: 0.93,
      reason: 'Customer demanded a refund due to ineffective treatment, threatening a chargeback.',
      signals: [
        'refund_request',
        'repeat_complaint',
        'customer_frustration',
        'chargeback_threat',
        'service_ineffective',
      ],
    },
  },
  {
    source: 'pest-intake-agent',
    conversation_id: 'conv-010',
    messages: [
      {
        role: 'assistant',
        content: 'Welcome to GreenShield Pest Control! How can I help you today?',
      },
      {
        role: 'user',
        content:
          "I scheduled an appointment for today between 1-4pm and nobody showed up. It's 5pm now.",
      },
      {
        role: 'assistant',
        content:
          'I sincerely apologize for the no-show. Let me look into this right away. Can I get your name?',
      },
      { role: 'user', content: 'David Park. I took the afternoon off work for this.' },
      {
        role: 'assistant',
        content:
          "I see your appointment, David. It looks like there was a scheduling error. I'm very sorry about that. Can I reschedule you for tomorrow?",
      },
      {
        role: 'user',
        content:
          "I can't just take another day off. This is unacceptable. I'll find another company.",
      },
    ],
    metadata: { customer_id: 'cust-110', timestamp: '2025-01-17T17:05:00Z' },
    classification: {
      outcome: 'failure',
      confidence: 0.96,
      reason: 'Technician no-show caused customer to leave for a competitor.',
      signals: ['missed_appointment', 'customer_lost', 'scheduling_error', 'customer_frustration'],
    },
  },
  {
    source: 'pest-intake-agent',
    conversation_id: 'conv-011',
    messages: [
      {
        role: 'assistant',
        content: 'Welcome to GreenShield Pest Control! How can I help you today?',
      },
      {
        role: 'user',
        content:
          "Your website says you do wildlife removal but when the tech came he said you don't handle raccoons.",
      },
      {
        role: 'assistant',
        content:
          "I apologize for the confusion. We do handle some wildlife but raccoons require a specialized wildlife license that we're still obtaining.",
      },
      {
        role: 'user',
        content:
          'So your website is misleading? I already paid a $50 service call fee for nothing.',
      },
      {
        role: 'assistant',
        content:
          "You're right, and I apologize. I can recommend a licensed wildlife removal company in the area.",
      },
      {
        role: 'user',
        content: "I don't want a recommendation, I want my $50 back. Your ad was false.",
      },
      {
        role: 'assistant',
        content:
          'Let me submit a refund request for the service call fee. You should see it back within 5-7 business days.',
      },
      { role: 'user', content: 'Fine. You should fix your website.' },
    ],
    metadata: { customer_id: 'cust-111', timestamp: '2025-01-17T11:20:00Z' },
    classification: {
      outcome: 'failure',
      confidence: 0.88,
      reason: 'Misleading website led to a wasted service call and refund request.',
      signals: ['misleading_info', 'refund_issued', 'service_mismatch', 'customer_frustration'],
    },
  },
  {
    source: 'pest-intake-agent',
    conversation_id: 'conv-012',
    messages: [
      {
        role: 'assistant',
        content: 'Welcome to GreenShield Pest Control! How can I help you today?',
      },
      { role: 'user', content: "I'm seeing a lot of spiders in my basement. What do you charge?" },
      { role: 'assistant', content: 'Our spider treatment starts at $199 for interior treatment.' },
      { role: 'user', content: 'That seems high. The company down the road charges $99.' },
      {
        role: 'assistant',
        content:
          "Our treatments include a 60-day guarantee and eco-friendly products. We believe it's great value.",
      },
      {
        role: 'user',
        content:
          "I'll pass. $99 with a guarantee from the other place is a better deal. Thanks anyway.",
      },
    ],
    metadata: { customer_id: 'cust-112', timestamp: '2025-01-17T15:45:00Z' },
    classification: {
      outcome: 'failure',
      confidence: 0.85,
      reason: 'Customer chose a cheaper competitor due to pricing.',
      signals: ['price_objection', 'competitor_mention', 'customer_lost', 'no_conversion'],
    },
  },
  {
    source: 'pest-intake-agent',
    conversation_id: 'conv-013',
    messages: [
      {
        role: 'assistant',
        content: 'Welcome to GreenShield Pest Control! How can I help you today?',
      },
      {
        role: 'user',
        content: 'The technician who came to my house was rude and tracked mud everywhere.',
      },
      {
        role: 'assistant',
        content:
          "I'm very sorry to hear about that experience. Can you tell me more about what happened?",
      },
      {
        role: 'user',
        content:
          "He didn't wear shoe covers, barely explained what he was doing, and left without telling me anything about follow-up.",
      },
      {
        role: 'assistant',
        content:
          "That is not the standard we hold our technicians to. I'll report this to our service manager. Can I get the technician's name or the date of service?",
      },
      {
        role: 'user',
        content:
          "January 15th. I don't remember his name. I just want to make sure it doesn't happen again when I have the follow-up.",
      },
      {
        role: 'assistant',
        content:
          "Absolutely. I've flagged the January 15th visit for review. For your follow-up, I'll request a senior technician. I apologize again for the poor experience.",
      },
    ],
    metadata: { customer_id: 'cust-113', timestamp: '2025-01-18T09:10:00Z' },
    classification: {
      outcome: 'failure',
      confidence: 0.82,
      reason: 'Customer complained about unprofessional technician behavior.',
      signals: [
        'service_complaint',
        'technician_conduct',
        'customer_dissatisfied',
        'escalation_to_manager',
      ],
    },
  },

  // ESCALATION cases (4)
  {
    source: 'pest-intake-agent',
    conversation_id: 'conv-014',
    messages: [
      {
        role: 'assistant',
        content: 'Welcome to GreenShield Pest Control! How can I help you today?',
      },
      {
        role: 'user',
        content:
          "I have a serious termite problem and my home inspector says there's structural damage. I need to talk to someone NOW about emergency service.",
      },
      {
        role: 'assistant',
        content:
          "I understand this is urgent. For structural termite damage, I'd like to connect you with our senior termite specialist who can assess the situation and discuss emergency treatment options.",
      },
      { role: 'user', content: 'Yes, please. This is for a home sale that closes in 2 weeks.' },
      {
        role: 'assistant',
        content:
          "I'm transferring you to Mike Reynolds, our termite division lead. He handles all emergency and real estate-related cases. Please hold for just a moment.",
      },
    ],
    metadata: { customer_id: 'cust-114', timestamp: '2025-01-18T10:00:00Z' },
    classification: {
      outcome: 'escalation',
      confidence: 0.97,
      reason:
        'Emergency structural termite issue escalated to senior specialist for real estate deadline.',
      signals: [
        'human_handoff',
        'emergency_request',
        'structural_damage',
        'time_sensitive',
        'specialist_needed',
      ],
    },
  },
  {
    source: 'pest-intake-agent',
    conversation_id: 'conv-015',
    messages: [
      {
        role: 'assistant',
        content: 'Welcome to GreenShield Pest Control! How can I help you today?',
      },
      {
        role: 'user',
        content:
          'I want to cancel my annual plan and get a prorated refund for the remaining months.',
      },
      { role: 'assistant', content: "I'm sorry to hear you want to cancel. May I ask why?" },
      { role: 'user', content: "We're moving out of state next month." },
      {
        role: 'assistant',
        content:
          "I understand. For plan cancellations and prorated refunds, I'll need to transfer you to our billing department who can process that for you.",
      },
      { role: 'user', content: 'Okay, please do.' },
      {
        role: 'assistant',
        content:
          "Connecting you to billing now. They'll be able to calculate your prorated refund and process the cancellation. One moment please.",
      },
    ],
    metadata: { customer_id: 'cust-115', timestamp: '2025-01-18T11:30:00Z' },
    classification: {
      outcome: 'escalation',
      confidence: 0.94,
      reason: 'Plan cancellation and refund request transferred to billing department.',
      signals: ['human_handoff', 'cancellation_request', 'refund_request', 'billing_transfer'],
    },
  },
  {
    source: 'pest-intake-agent',
    conversation_id: 'conv-016',
    messages: [
      {
        role: 'assistant',
        content: 'Welcome to GreenShield Pest Control! How can I help you today?',
      },
      {
        role: 'user',
        content:
          'My child had an allergic reaction after your treatment yesterday. I need to speak with a manager immediately.',
      },
      {
        role: 'assistant',
        content:
          "I'm very sorry to hear about your child. Their safety is our top priority. I'm immediately connecting you with our service manager and our safety compliance team.",
      },
      {
        role: 'user',
        content: 'Thank you. I also need the MSDS sheets for whatever chemicals were used.',
      },
      {
        role: 'assistant',
        content:
          "Absolutely. I'm flagging this as urgent and our manager, Jennifer Torres, will be with you shortly. She'll provide all safety documentation. I hope your child feels better soon.",
      },
    ],
    metadata: { customer_id: 'cust-116', timestamp: '2025-01-18T14:00:00Z' },
    classification: {
      outcome: 'escalation',
      confidence: 0.99,
      reason: 'Health/safety incident involving a child escalated to manager and compliance team.',
      signals: [
        'human_handoff',
        'health_safety_concern',
        'urgent_escalation',
        'manager_requested',
        'documentation_requested',
      ],
    },
  },
  {
    source: 'pest-intake-agent',
    conversation_id: 'conv-017',
    messages: [
      {
        role: 'assistant',
        content: 'Welcome to GreenShield Pest Control! How can I help you today?',
      },
      {
        role: 'user',
        content:
          "I run a restaurant and the health department found rodent droppings during our inspection. We need immediate commercial service or we'll be shut down.",
      },
      {
        role: 'assistant',
        content:
          'This is a critical situation. Commercial food service pest control requires our licensed commercial team. Let me get our commercial division manager on the line immediately.',
      },
      { role: 'user', content: 'Please hurry, we have 48 hours to show remediation efforts.' },
      {
        role: 'assistant',
        content:
          "I'm connecting you with Carlos Mendez, our commercial services director. He specializes in health department compliance cases. He'll be with you in under a minute.",
      },
    ],
    metadata: { customer_id: 'cust-117', timestamp: '2025-01-19T08:00:00Z' },
    classification: {
      outcome: 'escalation',
      confidence: 0.98,
      reason: 'Restaurant facing health department closure escalated to commercial pest division.',
      signals: [
        'human_handoff',
        'commercial_emergency',
        'regulatory_compliance',
        'time_critical',
        'specialist_needed',
      ],
    },
  },

  // UNCLEAR cases (3)
  {
    source: 'pest-intake-agent',
    conversation_id: 'conv-018',
    messages: [
      {
        role: 'assistant',
        content: 'Welcome to GreenShield Pest Control! How can I help you today?',
      },
      { role: 'user', content: 'Hi, just checking if you guys are open on weekends.' },
      {
        role: 'assistant',
        content:
          "Yes! We're open Monday through Saturday, 7am to 6pm. Sunday we're closed but you can leave a message and we'll call back Monday morning.",
      },
      { role: 'user', content: 'Ok thanks.' },
    ],
    metadata: { customer_id: 'cust-118', timestamp: '2025-01-19T09:30:00Z' },
    classification: {
      outcome: 'unclear',
      confidence: 0.78,
      reason:
        'Customer asked about business hours but did not indicate intent to schedule service.',
      signals: ['general_inquiry', 'no_commitment', 'brief_interaction'],
    },
  },
  {
    source: 'pest-intake-agent',
    conversation_id: 'conv-019',
    messages: [
      {
        role: 'assistant',
        content: 'Welcome to GreenShield Pest Control! How can I help you today?',
      },
      {
        role: 'user',
        content:
          "I think I might have termites but I'm not sure. I found some wood dust near the windowsill.",
      },
      {
        role: 'assistant',
        content:
          'Wood dust near a windowsill could be termites (frass) or it could be carpenter ants or even just deteriorating wood. A free inspection would give you a definitive answer. Want to schedule one?',
      },
      { role: 'user', content: "Let me think about it. I'll call back if I decide to." },
      {
        role: 'assistant',
        content:
          "No problem! We're here when you're ready. In the meantime, you can send a photo to support@greenshield.com and we can give you a preliminary assessment.",
      },
      { role: 'user', content: 'Good idea, I might do that.' },
    ],
    metadata: { customer_id: 'cust-119', timestamp: '2025-01-19T11:00:00Z' },
    classification: {
      outcome: 'unclear',
      confidence: 0.72,
      reason: 'Customer was interested but deferred action; no appointment or commitment made.',
      signals: ['no_commitment', 'information_seeking', 'potential_lead', 'deferred_decision'],
    },
  },
  {
    source: 'pest-intake-agent',
    conversation_id: 'conv-020',
    messages: [
      {
        role: 'assistant',
        content: 'Welcome to GreenShield Pest Control! How can I help you today?',
      },
      { role: 'user', content: 'hey' },
      {
        role: 'assistant',
        content: 'Hello! How can I assist you today? Are you looking for pest control services?',
      },
      { role: 'user', content: 'maybe, not sure yet. what do you do for mosquitoes?' },
      {
        role: 'assistant',
        content:
          'We offer mosquito yard treatments starting at $89 that protect your yard for up to 3 weeks. We also have seasonal packages. Would you like details?',
      },
      { role: 'user', content: 'ill think about it' },
    ],
    metadata: { customer_id: 'cust-120', timestamp: '2025-01-19T16:00:00Z' },
    classification: {
      outcome: 'unclear',
      confidence: 0.68,
      reason: 'Customer browsed mosquito services but showed no intent to purchase.',
      signals: ['no_commitment', 'casual_inquiry', 'low_engagement', 'deferred_decision'],
    },
  },
]

async function seed() {
  console.log('Seeding database with 20 sample conversations...')

  for (const conv of conversations) {
    const [event] = await db
      .insert(events)
      .values({
        source: conv.source,
        conversation_id: conv.conversation_id,
        messages: conv.messages,
        metadata: conv.metadata,
      })
      .returning()

    await db.insert(classifications).values({
      event_id: event.id,
      outcome: conv.classification.outcome,
      confidence: conv.classification.confidence,
      reason: conv.classification.reason,
      signals: conv.classification.signals,
    })

    console.log(`  ✓ ${conv.conversation_id} (${conv.classification.outcome})`)
  }

  console.log('\nDone! Seeded 20 events with classifications.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
