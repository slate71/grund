import type { FastifyInstance } from 'fastify'
import { db, schema } from '../db/client'
import { getParentByPhone } from '../planner/custody'
import { getCurrentPlan, generateAndSendDailyPlan } from '../planner/generate'
import { applyChangesAndReplan, confirmPlan } from '../planner/replan'
import { parseInboundMessage } from '../ai/parse'
import { sendSMS } from '../sms/twilio'
import { todayPT } from '../utils/time'
import type { Parent, DailyPlan } from '../models/types'

interface TwilioInboundBody {
  From: string
  Body: string
  MessageSid: string
}

/**
 * Register the Twilio inbound SMS webhook route.
 */
export function registerWebhook(app: FastifyInstance): void {
  app.post<{ Body: TwilioInboundBody }>('/webhooks/twilio/inbound', async (request, reply) => {
    const { From: from, Body: body, MessageSid: messageSid } = request.body

    console.log(`Inbound SMS from ${from}: "${body}" (${messageSid})`)

    // 1. Identify parent
    const parent = await getParentByPhone(from)
    if (!parent) {
      console.warn(`Unknown phone number: ${from}`)
      // Respond with TwiML empty response
      reply.type('text/xml').send('<Response></Response>')
      return
    }

    // 2. Log the inbound message
    await db.insert(schema.messageLogs).values({
      parentId: parent.id,
      direction: 'inbound',
      body,
    })

    // 3. Get current plan
    const today = todayPT()
    const currentPlan = await getCurrentPlan(today)

    // 4. Parse the message
    const parseResult = await parseInboundMessage(parent, body, currentPlan)

    // Log parsed intent
    await db
      .insert(schema.messageLogs)
      .values({
        parentId: parent.id,
        direction: 'inbound',
        body,
        parsedIntent: parseResult.intent,
        planModifications: parseResult.changes.length > 0 ? { changes: parseResult.changes } : undefined,
      })

    // 5. Handle by intent
    switch (parseResult.intent) {
      case 'CONFIRM': {
        if (currentPlan) {
          const updated = await confirmPlan(currentPlan, parent.id)
          const confirmMsg =
            updated.status === 'confirmed_both'
              ? `✅ Both parents confirmed for ${today}.`
              : `✅ ${parent.name} confirmed. Waiting for other parent.`
          await sendSMS(parent.phone, confirmMsg)
        } else {
          await sendSMS(parent.phone, `No plan for today yet. One will be sent at 7am.`)
        }
        break
      }

      case 'COMMAND': {
        await handleCommand(parseResult.commandType!, parent, currentPlan)
        break
      }

      case 'CHANGE_TRANSPORT':
      case 'VOLUNTEER':
      case 'SCHEDULE_CHANGE':
      case 'RESOLVE_CONFLICT': {
        if (currentPlan) {
          await applyChangesAndReplan(currentPlan, parseResult, parent)
        } else {
          await sendSMS(parent.phone, `No plan for today to update. Text TOMORROW to preview tomorrow's plan.`)
        }
        break
      }

      case 'QUESTION': {
        if (parseResult.clarificationNeeded) {
          await sendSMS(parent.phone, parseResult.clarificationNeeded)
        } else {
          await sendSMS(parent.phone, `Text DETAILS for today's full plan or HELP for commands.`)
        }
        break
      }

      case 'OTHER': {
        const msg =
          parseResult.clarificationNeeded ||
          "I didn't understand that. Text HELP for available commands."
        await sendSMS(parent.phone, msg)
        break
      }
    }

    // Respond to Twilio with empty TwiML (we handle responses via API)
    reply.type('text/xml').send('<Response></Response>')
  })
}

/** Handle text commands (DETAILS, WEEK, TOMORROW, HELP) */
async function handleCommand(
  command: string,
  parent: Parent,
  currentPlan: DailyPlan | null,
): Promise<void> {
  switch (command) {
    case 'DETAILS': {
      if (currentPlan) {
        const details = formatDetailedPlan(currentPlan)
        await sendSMS(parent.phone, details)
      } else {
        await sendSMS(parent.phone, 'No plan for today yet.')
      }
      break
    }

    case 'TOMORROW': {
      const tomorrow = getTomorrow()
      const plan = await getCurrentPlan(tomorrow)
      if (plan) {
        await sendSMS(parent.phone, `Tomorrow's plan is already generated. Sending it now.`)
      } else {
        await sendSMS(parent.phone, `Generating tomorrow's plan...`)
        await generateAndSendDailyPlan(tomorrow)
      }
      break
    }

    case 'WEEK': {
      // Trigger weekly lookahead on demand
      const { generateAndSendWeeklyLookahead } = await import('../planner/generate')
      await generateAndSendWeeklyLookahead()
      break
    }

    case 'HELP': {
      const helpText = [
        'Commands:',
        'OK — Confirm today\'s plan',
        'DETAILS — Full plan breakdown',
        'TOMORROW — Preview tomorrow',
        'WEEK — Weekly lookahead',
        'HELP — This message',
        '',
        'Or text naturally:',
        '"I can do the pickup"',
        '"Practice is cancelled"',
        '"Option 2" (for conflicts)',
      ].join('\n')
      await sendSMS(parent.phone, helpText)
      break
    }
  }
}

function formatDetailedPlan(plan: DailyPlan): string {
  let text = `Full plan for ${plan.date} (v${plan.version}):\n\n`

  for (const event of plan.events) {
    text += `${event.title}\n`
    text += `  Time: ${event.startTime} - ${event.endTime}\n`
    if (event.location) text += `  Location: ${event.location}\n`
    if (event.itemsNeeded.length) text += `  Needs: ${event.itemsNeeded.join(', ')}\n`
    text += `  Transport: ${event.transportParentId || 'unassigned'}\n`
    if (event.notes) text += `  Note: ${event.notes}\n`
    text += '\n'
  }

  if (plan.conflicts.length > 0) {
    text += `${plan.conflicts.length} conflict(s):\n`
    for (const c of plan.conflicts) {
      text += `- ${c.description}\n`
    }
  }

  return text
}

function getTomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}
