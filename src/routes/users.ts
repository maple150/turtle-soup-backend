import { Hono } from 'hono'

import type { AppEnv } from '@/env'
import { authMiddleware, requireAuthUser } from '@/middleware/auth'
import { UserService } from '@/services/user.service'
import { ok } from '@/utils/response'

const usersRoutes = new Hono<AppEnv>()

usersRoutes.get('/me', authMiddleware, async (c) => {
  const authUser = requireAuthUser(c)
  const result = await UserService.getCurrentUser(c.env, authUser.userId)
  return ok(c, result)
})

export default usersRoutes
