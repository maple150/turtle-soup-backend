import type { AppBindings } from '@/env'
import type { QueueEnvelope } from '@/env'

export async function enqueueEvent<T>(env: AppBindings, type: string, payload: T) {
  const message: QueueEnvelope<T> = {
    type,
    payload,
    ts: Date.now()
  }

  await env.APP_QUEUE.send(message)
}

export function enqueueGameArchive(env: AppBindings, payload: { roomId: string; roundId: string }) {
  return enqueueEvent(env, 'game.archive', payload)
}

export function enqueueAuditLog(env: AppBindings, payload: Record<string, unknown>) {
  return enqueueEvent(env, 'audit.log', payload)
}
