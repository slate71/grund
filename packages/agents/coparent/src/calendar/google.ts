import { google, type calendar_v3 } from 'googleapis'
import { config } from '../config'
import type { CalendarEvent } from '../models/types'

let calendarClient: calendar_v3.Calendar | null = null

function getCalendarClient(): calendar_v3.Calendar {
  if (calendarClient) return calendarClient

  // Parse credentials — supports both inline JSON and file path
  let credentials: Record<string, string>
  try {
    credentials = JSON.parse(config.google.credentials)
  } catch {
    // If not JSON, treat as file path (for GOOGLE_APPLICATION_CREDENTIALS pattern)
    const auth = new google.auth.GoogleAuth({
      keyFile: config.google.credentials,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    })
    calendarClient = google.calendar({ version: 'v3', auth })
    return calendarClient
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  })

  calendarClient = google.calendar({ version: 'v3', auth })
  return calendarClient
}

/** Fetch events from a Google Calendar for a date range */
export async function fetchCalendarEvents(
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[]> {
  const client = getCalendarClient()

  const response = await client.events.list({
    calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
  })

  const items = response.data.items || []

  return items
    .filter((item) => item.start?.dateTime && item.end?.dateTime)
    .map((item) => ({
      id: item.id || '',
      calendarId,
      title: item.summary || 'Untitled',
      startTime: item.start!.dateTime!,
      endTime: item.end!.dateTime!,
      location: item.location || '',
      description: item.description || '',
    }))
}

/** Fetch events for both parents' calendars for a given date */
export async function fetchAllEventsForDate(date: string): Promise<{
  parent1Events: CalendarEvent[]
  parent2Events: CalendarEvent[]
}> {
  // Build time range for the full day in PT (conservative UTC bounds)
  const timeMin = `${date}T00:00:00-08:00`
  const timeMax = `${date}T23:59:59-08:00`

  const [parent1Events, parent2Events] = await Promise.all([
    fetchCalendarEvents(config.google.parent1CalendarId, timeMin, timeMax),
    fetchCalendarEvents(config.google.parent2CalendarId, timeMin, timeMax),
  ])

  return { parent1Events, parent2Events }
}

/** Fetch events for a date range (used for weekly lookahead) */
export async function fetchEventsForRange(
  startDate: string,
  endDate: string,
): Promise<{
  parent1Events: CalendarEvent[]
  parent2Events: CalendarEvent[]
}> {
  const timeMin = `${startDate}T00:00:00-08:00`
  const timeMax = `${endDate}T23:59:59-08:00`

  const [parent1Events, parent2Events] = await Promise.all([
    fetchCalendarEvents(config.google.parent1CalendarId, timeMin, timeMax),
    fetchCalendarEvents(config.google.parent2CalendarId, timeMin, timeMax),
  ])

  return { parent1Events, parent2Events }
}
