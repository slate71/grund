// SSE event types from Vercel AI SDK protocol
export interface TextStartEvent {
  type: 'text-start'
  id: string // Part ID for accumulation
}

export interface TextDeltaEvent {
  type: 'text-delta'
  id: string // Part ID to append to
  delta: string // Text chunk to append
}

export interface TextEndEvent {
  type: 'text-end'
  id: string // Part ID that completed
}

export type StreamEvent = TextStartEvent | TextDeltaEvent | TextEndEvent

// Accumulated message state
export interface MessagePart {
  id: string
  content: string
  isComplete: boolean
}

// Chat message for rendering
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}
