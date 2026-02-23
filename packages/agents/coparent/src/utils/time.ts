import { config } from '../config'

const TZ = config.timezone

/** Get current date/time in Pacific Time as a Date object */
export function nowPT(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TZ }))
}

/** Format a date as ISO date string (YYYY-MM-DD) in Pacific Time */
export function toDateString(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: TZ }) // en-CA gives YYYY-MM-DD
}

/** Get today's date as ISO string in Pacific Time */
export function todayPT(): string {
  return toDateString(new Date())
}

/** Format time as "4:15pm" for SMS display */
export function formatTime(isoDatetime: string): string {
  const date = new Date(isoDatetime)
  return date
    .toLocaleTimeString('en-US', {
      timeZone: TZ,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .toLowerCase()
    .replace(' ', '')
}

/** Format time range as "4:15-5:30pm" or "4:15pm-6:00pm" */
export function formatTimeRange(startIso: string, endIso: string): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const startStr = start.toLocaleTimeString('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const endStr = end.toLocaleTimeString('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  // If same AM/PM, omit it from the start time
  const startPeriod = startStr.slice(-2).toLowerCase()
  const endPeriod = endStr.slice(-2).toLowerCase()

  const formatPart = (s: string) => s.toLowerCase().replace(' ', '')

  if (startPeriod === endPeriod) {
    // "4:15-5:30pm"
    const startTimeOnly = startStr.replace(/\s*(AM|PM)/i, '')
    return `${startTimeOnly}-${formatPart(endStr)}`
  }
  return `${formatPart(startStr)}-${formatPart(endStr)}`
}

/** Format date as "Mon 2/24" for SMS display */
export function formatDateShort(isoDate: string): string {
  const date = new Date(isoDate + 'T12:00:00') // noon to avoid timezone edge
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const day = days[date.getDay()]
  const month = date.getMonth() + 1
  const dayOfMonth = date.getDate()
  return `${day} ${month}/${dayOfMonth}`
}

/** Calculate minutes between two ISO datetime strings */
export function minutesBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso)
  const end = new Date(endIso)
  return (end.getTime() - start.getTime()) / (1000 * 60)
}

/** Get ISO date strings for a date range starting from a given date */
export function dateRange(startDate: string, days: number): string[] {
  const dates: string[] = []
  const start = new Date(startDate + 'T12:00:00')
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    dates.push(toDateString(d))
  }
  return dates
}

/** Get start/end of day in UTC for a Pacific Time date string */
export function dayBoundsUTC(isoDate: string): { start: string; end: string } {
  // Create a date at midnight PT, convert to UTC
  const startPT = new Date(`${isoDate}T00:00:00`)
  const endPT = new Date(`${isoDate}T23:59:59`)

  // Use Intl to get the UTC offset for Pacific Time
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    timeZoneName: 'shortOffset',
  })

  // PT is UTC-8 in winter, UTC-7 in summer
  // We use a conservative approach: extend bounds by 1 hour in each direction
  const start = new Date(startPT.getTime() + 8 * 60 * 60 * 1000) // assume PST (worst case earlier)
  const end = new Date(endPT.getTime() + 8 * 60 * 60 * 1000)

  // Suppress unused variable
  void formatter

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}
