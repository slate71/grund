export type TriageCategory =
  | 'urgent_action'
  | 'action_required'
  | 'informational'
  | 'newsletter_valued'
  | 'newsletter_noise'
  | 'notification'
  | 'promotion'

export interface TriageDecision {
  category: TriageCategory
  confidence: number
  reason: string
  shouldDraftReply: boolean
  suggestedLabels: string[]
  archiveAfter: boolean
}

export const CATEGORY_ACTIONS: Record<
  TriageCategory,
  { archive: boolean; labels: string[]; draft: boolean }
> = {
  urgent_action: { archive: false, labels: ['Urgent'], draft: true },
  action_required: { archive: false, labels: ['Action'], draft: true },
  informational: { archive: false, labels: [], draft: false },
  newsletter_valued: { archive: true, labels: ['Reading List'], draft: false },
  newsletter_noise: { archive: true, labels: [], draft: false },
  notification: { archive: true, labels: [], draft: false },
  promotion: { archive: true, labels: [], draft: false },
}
