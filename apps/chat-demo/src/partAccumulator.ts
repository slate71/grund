import type { StreamEvent } from './types'

export class PartAccumulator {
  private parts: Map<string, string> = new Map()
  private completedIds: Set<string> = new Set()

  // Process a stream event, updating the Map
  processEvent(event: StreamEvent): void {
    switch (event.type) {
      case 'text-start':
        this.parts.set(event.id, '')
        this.completedIds.delete(event.id)
        break

      case 'text-delta': {
        const existing = this.parts.get(event.id) || ''
        this.parts.set(event.id, existing + event.delta)
        break
      }

      case 'text-end':
        this.completedIds.add(event.id)
        break
    }
  }

  // Get all parts as array, with completion status
  getParts(): Array<{ id: string; content: string; isComplete: boolean }> {
    return Array.from(this.parts.entries()).map(([id, content]) => ({
      id,
      content,
      isComplete: this.completedIds.has(id),
    }))
  }

  // Get combined text from all parts
  getCombinedText(): string {
    return Array.from(this.parts.values()).join('')
  }

  // Check if any part is still streaming
  isStreaming(): boolean {
    return (
      this.parts.size > 0 && Array.from(this.parts.keys()).some((id) => !this.completedIds.has(id))
    )
  }

  // Clear all accumulated parts
  clear(): void {
    this.parts.clear()
    this.completedIds.clear()
  }
}
