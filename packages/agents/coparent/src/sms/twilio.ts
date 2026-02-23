import twilio from 'twilio'
import { config } from '../config'

let twilioClient: twilio.Twilio | null = null

function getClient(): twilio.Twilio {
  if (!twilioClient) {
    twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken)
  }
  return twilioClient
}

/**
 * Send an SMS message via Twilio.
 */
export async function sendSMS(to: string, body: string): Promise<string> {
  const client = getClient()

  const message = await client.messages.create({
    body,
    from: config.twilio.phoneNumber,
    to,
  })

  console.log(`SMS sent to ${to}: ${message.sid}`)
  return message.sid
}

/**
 * Send SMS to both parents.
 */
export async function broadcastSMS(phones: string[], body: string): Promise<void> {
  await Promise.all(phones.map((phone) => sendSMS(phone, body)))
}
