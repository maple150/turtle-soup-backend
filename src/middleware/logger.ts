import type { MiddlewareHandler } from 'hono'

import type { AppEnv } from '@/env'

export const loggerMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const startedAt = Date.now()
  const requestId = crypto.randomUUID()

  c.set('requestId', requestId)

  await next()

  const durationMs = Date.now() - startedAt

  console.log(
    JSON.stringify({
      requestId,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs
    })
  )
}
