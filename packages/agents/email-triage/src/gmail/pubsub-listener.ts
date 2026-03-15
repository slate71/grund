import { PubSub, type Subscription, type Message } from '@google-cloud/pubsub'

export class PubSubListener {
  private pubsub: PubSub
  private subscription: Subscription
  private handlers = new Map<string, () => Promise<void>>()

  constructor(projectId: string, subscriptionName: string) {
    this.pubsub = new PubSub({ projectId })
    this.subscription = this.pubsub.subscription(subscriptionName)
  }

  onNotification(emailAddress: string, handler: () => Promise<void>): void {
    this.handlers.set(emailAddress.toLowerCase(), handler)
  }

  async start(): Promise<void> {
    this.subscription.on('message', (message: Message) => {
      this.handleMessage(message)
    })

    this.subscription.on('error', (err: Error) => {
      console.error('Pub/Sub subscription error:', err)
    })

    console.log('Pub/Sub listener started')
  }

  async stop(): Promise<void> {
    this.subscription.removeAllListeners()
    await this.subscription.close()
    console.log('Pub/Sub listener stopped')
  }

  private handleMessage(message: Message): void {
    try {
      const data = JSON.parse(message.data.toString()) as { emailAddress: string }
      const email = data.emailAddress?.toLowerCase()

      if (!email) {
        console.warn('Pub/Sub message missing emailAddress, acking')
        message.ack()
        return
      }

      const handler = this.handlers.get(email)
      if (!handler) {
        console.warn(`No handler for ${email}, acking`)
        message.ack()
        return
      }

      handler()
        .then(() => message.ack())
        .catch((err) => {
          console.error(`Handler error for ${email}:`, err)
          message.nack()
        })
    } catch (err) {
      console.error('Failed to parse Pub/Sub message:', err)
      message.ack()
    }
  }
}
