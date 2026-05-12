import type { MiddlewareHandler } from 'hono'

import type { AppEnv } from '@/env'
import { getRuntimeConfig } from '@/env'
import { AppError } from '@/utils/response'

export function rateLimitMiddleware(scope = 'global'): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const config = getRuntimeConfig(c.env)
    const ip = c.req.header('CF-Connecting-IP') || 'anonymous'
    const windowKey = Math.floor(Date.now() / 1000 / config.rateLimitWindowSeconds)
    const key = `ratelimit:${scope}:${ip}:${windowKey}`
    const current = Number((await c.env.APP_KV.get(key)) || 0)

    if (current >= config.rateLimitMaxRequests) {
      throw new AppError(429, 'RATE_LIMITED', 'Too many requests')
    }

    await c.env.APP_KV.put(key, String(current + 1), {
      expirationTtl: config.rateLimitWindowSeconds + 5
    })

    await next()
  }
}
