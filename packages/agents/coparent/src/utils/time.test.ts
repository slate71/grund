import { describe, it, expect } from 'vitest'
import { formatTimeRange, formatDateShort, minutesBetween, dateRange } from './time'

describe('formatTimeRange', () => {
  it('formats same-period time range (both PM)', () => {
    const result = formatTimeRange(
      '2026-02-24T16:15:00-08:00',
      '2026-02-24T17:30:00-08:00',
    )
    // Both are PM, so start should omit period
    expect(result).toContain('4:15')
    expect(result).toContain('5:30')
    expect(result).toContain('pm')
  })

  it('formats cross-period time range (AM to PM)', () => {
    const result = formatTimeRange(
      '2026-02-24T11:00:00-08:00',
      '2026-02-24T13:00:00-08:00',
    )
    expect(result).toContain('am')
    expect(result).toContain('pm')
  })
})

describe('formatDateShort', () => {
  it('formats a Monday correctly', () => {
    const result = formatDateShort('2026-02-23')
    expect(result).toBe('Mon 2/23')
  })

  it('formats a Saturday correctly', () => {
    const result = formatDateShort('2026-02-28')
    expect(result).toBe('Sat 2/28')
  })
})

describe('minutesBetween', () => {
  it('calculates minutes between two times', () => {
    const result = minutesBetween(
      '2026-02-24T16:00:00-08:00',
      '2026-02-24T16:30:00-08:00',
    )
    expect(result).toBe(30)
  })

  it('returns 0 for same time', () => {
    const result = minutesBetween(
      '2026-02-24T16:00:00-08:00',
      '2026-02-24T16:00:00-08:00',
    )
    expect(result).toBe(0)
  })

  it('returns negative for reversed times', () => {
    const result = minutesBetween(
      '2026-02-24T17:00:00-08:00',
      '2026-02-24T16:00:00-08:00',
    )
    expect(result).toBe(-60)
  })
})

describe('dateRange', () => {
  it('generates correct number of dates', () => {
    const dates = dateRange('2026-02-23', 7)
    expect(dates).toHaveLength(7)
    expect(dates[0]).toBe('2026-02-23')
    expect(dates[6]).toBe('2026-03-01')
  })

  it('generates a single date', () => {
    const dates = dateRange('2026-02-23', 1)
    expect(dates).toHaveLength(1)
    expect(dates[0]).toBe('2026-02-23')
  })
})
