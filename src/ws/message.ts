import { z } from 'zod'

import { AppError } from '@/utils/response'
import type { WsEnvelope } from './protocol'

const envelopeSchema = z.object({
  event: z.string().min(1),
  data: z.unknown(),
  ts: z.number().int().nonnegative().optional(),
  reqId: z.string().min(1).max(128).optional()
})

export function parseWsMessage(raw: string): WsEnvelope {
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new AppError(400, 'WS_MESSAGE_INVALID', 'WebSocket message must be valid JSON')
  }

  const result = envelopeSchema.safeParse(parsed)

  if (!result.success) {
    throw new AppError(
      400,
      'WS_MESSAGE_INVALID',
      'Invalid WebSocket message structure',
      result.error.flatten()
    )
  }

  return {
    event: result.data.event,
    data: result.data.data,
    ts: result.data.ts ?? Date.now(),
    reqId: result.data.reqId
  }
}

export function createWsMessage<TData>(event: string, data: TData, reqId?: string): WsEnvelope<string, TData> {
  return {
    event,
    data,
    ts: Date.now(),
    reqId
  }
}

export function stringifyEnvelope<TData>(payload: WsEnvelope<string, TData>) {
  return JSON.stringify(payload)
}

export function stringifyWsMessage<TData>(event: string, data: TData, reqId?: string) {
  return stringifyEnvelope(createWsMessage(event, data, reqId))
}
