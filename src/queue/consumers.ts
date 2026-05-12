import type { MessageBatch } from '@cloudflare/workers-types'

import type { QueueEnvelope } from '@/env'

export async function consumeQueue(batch: MessageBatch<QueueEnvelope>) {
  for (const message of batch.messages) {
    // TODO: Route archive, analytics, moderation, and audit events to downstream workers or storage.
    console.log('queue.consume', message.body.type, message.body.payload)
    message.ack()
  }
}
