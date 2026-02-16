import type { EventWithClassification } from '@grund/shared'
import { OutcomeBadge } from './OutcomeBadge'

interface EventListProps {
  events: EventWithClassification[]
  onSelect: (id: string) => void
}

export function EventList({ events, onSelect }: EventListProps) {
  if (events.length === 0) {
    return <p className="py-8 text-center text-gray-500">No events found.</p>
  }

  return (
    <div className="space-y-2">
      {events.map((event) => (
        <button
          key={event.id}
          onClick={() => onSelect(event.id)}
          className="flex w-full items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:bg-gray-50"
        >
          <div className="pt-0.5">
            {event.outcome ? (
              <OutcomeBadge outcome={event.outcome} />
            ) : (
              <span className="inline-block rounded-full bg-gray-50 px-2.5 py-0.5 text-xs text-gray-400">
                pending
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">{event.source}</span>
              <span className="text-xs text-gray-400">{event.conversation_id}</span>
            </div>
            {event.reason && <p className="mt-1 truncate text-sm text-gray-600">{event.reason}</p>}
          </div>
          <time className="shrink-0 text-xs text-gray-400">
            {new Date(event.created_at).toLocaleDateString()}
          </time>
        </button>
      ))}
    </div>
  )
}
