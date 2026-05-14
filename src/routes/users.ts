import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'

import type { AppEnv } from '@/env'
import { authMiddleware, requireAuthUser } from '@/middleware/auth'
import { UserService } from '@/services/user.service'
import { ok } from '@/utils/response'
import { updateCurrentUserSchema } from '@/validators/user'

const usersRoutes = new Hono<AppEnv>()

usersRoutes.get('/me', authMiddleware, async (c) => {
  const authUser = requireAuthUser(c)
  const result = await UserService.getCurrentUser(c.env, authUser.userId)
  return ok(c, result)
})

usersRoutes.patch('/me', authMiddleware, zValidator('json', updateCurrentUserSchema), async (c) => {
  const authUser = requireAuthUser(c)
  const payload = c.req.valid('json')
  const result = await UserService.updateCurrentUser(c.env, authUser.userId, payload)
  return ok(c, result, 'Profile updated')
})

export default usersRoutes
