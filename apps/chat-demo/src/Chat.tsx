import { useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { parseStream } from './streamParser'
import { PartAccumulator } from './partAccumulator'
import type { ChatMessage } from './types'

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentStreamText, setCurrentStreamText] = useState('')

  const sendMessage = async (text: string) => {
    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    }
    setMessages((prev: ChatMessage[]) => [...prev, userMsg])

    // Initialize accumulator for this response
    const accumulator = new PartAccumulator()
    setIsStreaming(true)
    setCurrentStreamText('')

    try {
      // POST to mock endpoint
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })

      if (!response.ok || !response.body) {
        throw new Error('Failed to get stream')
      }

      // Process stream events
      for await (const event of parseStream(response.body)) {
        accumulator.processEvent(event)
        const combined = accumulator.getCombinedText()
        setCurrentStreamText(combined)
      }

      // Stream complete - add final message
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: accumulator.getCombinedText(),
        isStreaming: false,
      }
      setMessages((prev: ChatMessage[]) => [...prev, assistantMsg])
    } catch (error) {
      console.error('Stream error:', error)
      // Add error message
      setMessages((prev: ChatMessage[]) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'Error: Failed to get response',
        },
      ])
    } finally {
      setIsStreaming(false)
      setCurrentStreamText('')
    }
  }

  return (
    <div className="chat">
      <div className="messages">
        {messages.map((msg: ChatMessage) => (
          <div key={msg.id} className={`message ${msg.role}`} role={msg.role}>
            <span className="message-content">{msg.content}</span>
          </div>
        ))}
        {isStreaming && (
          <div className="message assistant streaming" key={`streaming-${Date.now()}`}>
            {currentStreamText || '...'}
            <span className="streaming-cursor">|</span>
          </div>
        )}
      </div>
      <div className="input-area">
        <input
          value={input}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) =>
            e.key === 'Enter' && !e.shiftKey && sendMessage(input)
          }
          disabled={isStreaming}
          placeholder="Type your message..."
        />
        <button onClick={() => sendMessage(input)} disabled={isStreaming || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  )
}
