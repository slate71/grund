import type { Outcome } from '@grund/shared'

const styles: Record<Outcome, string> = {
  success: 'bg-green-100 text-green-800',
  failure: 'bg-red-100 text-red-800',
  escalation: 'bg-yellow-100 text-yellow-800',
  unclear: 'bg-gray-100 text-gray-600',
}

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[outcome]}`}
    >
      {outcome}
    </span>
  )
}
