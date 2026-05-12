import { Hono } from 'hono'

import type { AppEnv } from '@/env'
import { authMiddleware, requireAuthUser } from '@/middleware/auth'
import { AppError, ok } from '@/utils/response'

const adminRoutes = new Hono<AppEnv>()

adminRoutes.get('/overview', authMiddleware, async (c) => {
  const authUser = requireAuthUser(c)

  if (!authUser.roles.includes('admin')) {
    throw new AppError(403, 'FORBIDDEN', 'Admin access required')
  }

  return ok(c, {
    enabled: false,
    todo: 'Wire moderation dashboards, audit analytics, and background ops later.'
  })
})

export default adminRoutes
