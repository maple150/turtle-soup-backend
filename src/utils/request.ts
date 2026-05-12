import type { Context } from 'hono'
import type { ZodType } from 'zod'

import { AppError } from './response'

export async function parseOptionalJsonBody<T>(
  c: Context,
  schema: ZodType<T>,
  fallback: unknown
): Promise<T> {
  const raw = await c.req.raw.text()

  if (!raw.trim()) {
    return schema.parse(fallback)
  }

  let json: unknown

  try {
    json = JSON.parse(raw)
  } catch {
    throw new AppError(400, 'INVALID_JSON', 'Request body must be valid JSON')
  }

  return schema.parse(json)
}
