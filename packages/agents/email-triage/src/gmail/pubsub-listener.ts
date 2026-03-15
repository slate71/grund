import { PubSub, type Subscription, type Message } from '@google-cloud/pubsub'
import type { Logger } from '@grund/logger'

export class PubSubListener {
  private pubsub: PubSub
  private subscription: Subscription
  private handlers = new Map<string, () => Promise<void>>()
  private log: Logger

  constructor(projectId: string, subscriptionName: string, log: Logger) {
    this.pubsub = new PubSub({ projectId })
    this.subscription = this.pubsub.subscription(subscriptionName)
    this.log = log
  }

  onNotification(emailAddress: string, handler: () => Promise<void>): void {
    this.handlers.set(emailAddress.toLowerCase(), handler)
  }

  async start(): Promise<void> {
    this.subscription.on('message', (message: Message) => {
      this.handleMessage(message)
    })

    this.subscription.on('error', (err: Error) => {
      this.log.error({ err }, 'Pub/Sub subscription error')
    })

    this.log.info('Pub/Sub listener started')
  }

  async stop(): Promise<void> {
    this.subscription.removeAllListeners()
    await this.subscription.close()
    this.log.info('Pub/Sub listener stopped')
  }

  private handleMessage(message: Message): void {
    try {
      const data = JSON.parse(message.data.toString()) as { emailAddress: string }
      const email = data.emailAddress?.toLowerCase()

      if (!email) {
        this.log.warn('Pub/Sub message missing emailAddress, acking')
        message.ack()
        return
      }

      const handler = this.handlers.get(email)
      if (!handler) {
        this.log.warn({ email }, 'No handler for email, acking')
        message.ack()
        return
      }

      handler()
        .then(() => message.ack())
        .catch((err) => {
          this.log.error({ err, email }, 'Handler error')
          message.nack()
        })
    } catch (err) {
      this.log.error({ err }, 'Failed to parse Pub/Sub message')
      message.ack()
    }
  }
}
