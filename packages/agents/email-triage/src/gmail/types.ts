export interface ParsedEmail {
  messageId: string
  threadId: string
  from: string
  to: string
  subject: string
  body: string
  labels: string[]
  date: string
}

export interface GmailHistoryResponse {
  history?: GmailHistoryEntry[]
  historyId: string
  nextPageToken?: string
}

export interface GmailHistoryEntry {
  id: string
  messagesAdded?: { message: GmailMessageRef }[]
}

export interface GmailMessageRef {
  id: string
  threadId: string
  labelIds?: string[]
}

export interface GmailMessage {
  id: string
  threadId: string
  labelIds: string[]
  payload: GmailPayload
  internalDate: string
}

export interface GmailPayload {
  headers: GmailHeader[]
  body?: { data?: string }
  parts?: GmailPart[]
  mimeType: string
}

export interface GmailHeader {
  name: string
  value: string
}

export interface GmailPart {
  mimeType: string
  body?: { data?: string }
  parts?: GmailPart[]
}

export interface GmailProfile {
  emailAddress: string
  historyId: string
}

export interface WatchResponse {
  historyId: string
  expiration: string
}
