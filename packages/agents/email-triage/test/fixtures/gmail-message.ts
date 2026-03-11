import type { GmailMessage } from '../../src/gmail/types'

function toBase64Url(str: string): string {
  return Buffer.from(str).toString('base64url')
}

export const urgentEmail: GmailMessage = {
  id: 'msg-001',
  threadId: 'thread-001',
  labelIds: ['INBOX', 'UNREAD'],
  internalDate: '1710000000000',
  payload: {
    mimeType: 'text/plain',
    headers: [
      { name: 'From', value: 'boss@company.com' },
      { name: 'To', value: 'me@example.com' },
      { name: 'Subject', value: 'URGENT: Need approval by EOD' },
      { name: 'Date', value: 'Mon, 10 Mar 2025 10:00:00 -0500' },
    ],
    body: { data: toBase64Url('Please review and approve the Q1 budget by end of day today. This is blocking the team.') },
  },
}

export const newsletterEmail: GmailMessage = {
  id: 'msg-002',
  threadId: 'thread-002',
  labelIds: ['INBOX', 'UNREAD'],
  internalDate: '1710000000000',
  payload: {
    mimeType: 'text/plain',
    headers: [
      { name: 'From', value: 'ben@stratechery.com' },
      { name: 'To', value: 'me@example.com' },
      { name: 'Subject', value: 'Stratechery: The Future of AI' },
      { name: 'Date', value: 'Mon, 10 Mar 2025 08:00:00 -0500' },
    ],
    body: { data: toBase64Url('This week we explore how AI is reshaping the tech landscape...') },
  },
}

export const notificationEmail: GmailMessage = {
  id: 'msg-003',
  threadId: 'thread-003',
  labelIds: ['INBOX', 'UNREAD'],
  internalDate: '1710000000000',
  payload: {
    mimeType: 'text/plain',
    headers: [
      { name: 'From', value: 'noreply@github.com' },
      { name: 'To', value: 'me@example.com' },
      { name: 'Subject', value: '[grund/monorepo] PR #42 merged' },
      { name: 'Date', value: 'Mon, 10 Mar 2025 09:30:00 -0500' },
    ],
    body: { data: toBase64Url('Your pull request #42 has been merged into main.') },
  },
}

export const multipartEmail: GmailMessage = {
  id: 'msg-004',
  threadId: 'thread-004',
  labelIds: ['INBOX'],
  internalDate: '1710000000000',
  payload: {
    mimeType: 'multipart/alternative',
    headers: [
      { name: 'From', value: 'colleague@company.com' },
      { name: 'To', value: 'me@example.com' },
      { name: 'Subject', value: 'Meeting notes from today' },
      { name: 'Date', value: 'Mon, 10 Mar 2025 14:00:00 -0500' },
    ],
    parts: [
      {
        mimeType: 'text/plain',
        body: { data: toBase64Url('Here are the meeting notes from today\'s standup.') },
      },
      {
        mimeType: 'text/html',
        body: { data: toBase64Url('<p>Here are the meeting notes from today\'s standup.</p>') },
      },
    ],
  },
}

export const promotionEmail: GmailMessage = {
  id: 'msg-005',
  threadId: 'thread-005',
  labelIds: ['INBOX', 'CATEGORY_PROMOTIONS'],
  internalDate: '1710000000000',
  payload: {
    mimeType: 'text/plain',
    headers: [
      { name: 'From', value: 'deals@store.com' },
      { name: 'To', value: 'me@example.com' },
      { name: 'Subject', value: '50% OFF everything this weekend!' },
      { name: 'Date', value: 'Mon, 10 Mar 2025 07:00:00 -0500' },
    ],
    body: { data: toBase64Url('Shop our biggest sale of the year!') },
  },
}
