import type { MiddlewareHandler } from 'hono'

import type { AppEnv } from '@/env'
import { verifyAccessToken } from '@/utils/jwt'
import { AppError } from '@/utils/response'

export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header('Authorization')

  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'Missing bearer token')
  }

  const token = header.slice('Bearer '.length).trim()
  const payload = await verifyAccessToken(c.env, token)

  c.set('authUser', {
    userId: payload.sub,
    username: payload.username,
    nickname: payload.nickname,
    roles: payload.roles
  })

  await next()
}

export function requireAuthUser(c: {
  get: (key: 'authUser') => AppEnv['Variables']['authUser']
}) {
  const authUser = c.get('authUser')

  if (!authUser) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required')
  }

  return authUser
}
