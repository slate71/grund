import { describe, it, expect, beforeEach } from 'vitest'
import { PartAccumulator } from './partAccumulator'

describe('PartAccumulator', () => {
  let accumulator: PartAccumulator

  beforeEach(() => {
    accumulator = new PartAccumulator()
  })

  it('should accumulate text deltas', () => {
    accumulator.processEvent({ type: 'text-start', id: 'part-1' })
    accumulator.processEvent({ type: 'text-delta', id: 'part-1', delta: 'Hello' })
    accumulator.processEvent({ type: 'text-delta', id: 'part-1', delta: ' world' })

    expect(accumulator.getCombinedText()).toBe('Hello world')
  })

  it('should track streaming state', () => {
    accumulator.processEvent({ type: 'text-start', id: 'part-1' })
    expect(accumulator.isStreaming()).toBe(true)

    accumulator.processEvent({ type: 'text-end', id: 'part-1' })
    expect(accumulator.isStreaming()).toBe(false)
  })

  it('should handle multiple parts', () => {
    accumulator.processEvent({ type: 'text-start', id: 'part-1' })
    accumulator.processEvent({ type: 'text-delta', id: 'part-1', delta: 'First' })
    accumulator.processEvent({ type: 'text-start', id: 'part-2' })
    accumulator.processEvent({ type: 'text-delta', id: 'part-2', delta: 'Second' })

    expect(accumulator.getCombinedText()).toBe('FirstSecond')
    expect(accumulator.getParts()).toHaveLength(2)
  })

  it('should clear all state', () => {
    accumulator.processEvent({ type: 'text-start', id: 'part-1' })
    accumulator.processEvent({ type: 'text-delta', id: 'part-1', delta: 'Hello' })
    accumulator.clear()

    expect(accumulator.getCombinedText()).toBe('')
    expect(accumulator.getParts()).toHaveLength(0)
  })
})
