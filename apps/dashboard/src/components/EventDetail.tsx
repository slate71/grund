import { useEffect, useState } from 'react'
import type { EventWithClassification } from '@grund/shared'
import { fetchEvent } from '../api'
import { OutcomeBadge } from './OutcomeBadge'

interface EventDetailProps {
  eventId: string
  onBack: () => void
}

export function EventDetail({ eventId, onBack }: EventDetailProps) {
  const [event, setEvent] = useState<EventWithClassification | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchEvent(eventId)
      .then(setEvent)
      .catch((err) => setError(err.message))
  }, [eventId])

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        Error: {error}
      </div>
    )
  }

  if (!event) {
    return <p className="py-8 text-center text-gray-500">Loading...</p>
  }

  const hasClassification = event.outcome !== null && event.outcome !== undefined

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700">
        &larr; Back to feed
      </button>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{event.source}</h2>
            <p className="text-sm text-gray-500">{event.conversation_id}</p>
          </div>
          {event.outcome && <OutcomeBadge outcome={event.outcome} />}
        </div>

        {hasClassification && (
          <div className="mb-6 space-y-3 rounded-md bg-gray-50 p-4">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-xs font-medium uppercase text-gray-500">Confidence</span>
                <p className="text-sm text-gray-900">
                  {event.confidence ? (event.confidence * 100).toFixed(0) : 0}%
                </p>
              </div>
            </div>
            <div>
              <span className="text-xs font-medium uppercase text-gray-500">Reason</span>
              <p className="text-sm text-gray-900">{event.reason}</p>
            </div>
            <div>
              <span className="text-xs font-medium uppercase text-gray-500">Signals</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {event.signals?.map((s: any) => (
                  <span key={s} className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <div>
          <h3 className="mb-3 text-sm font-medium uppercase text-gray-500">Conversation</h3>
          <div className="space-y-3">
            {event.messages.map((msg, i) => (
              <div
                key={i}
                className={`rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'ml-8 bg-blue-50 text-blue-900'
                    : msg.role === 'assistant'
                      ? 'mr-8 bg-gray-100 text-gray-900'
                      : 'bg-yellow-50 text-yellow-900 text-xs'
                }`}
              >
                <span className="mb-1 block text-xs font-medium uppercase opacity-60">
                  {msg.role}
                </span>
                {msg.content}
              </div>
            ))}
          </div>
        </div>

        {event.metadata && Object.keys(event.metadata).length > 0 && (
          <div className="mt-6 border-t pt-4">
            <h3 className="mb-2 text-sm font-medium uppercase text-gray-500">Metadata</h3>
            <pre className="overflow-auto rounded bg-gray-50 p-3 text-xs text-gray-700">
              {JSON.stringify(event.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
