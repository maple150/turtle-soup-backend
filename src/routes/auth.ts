import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'

import type { AppEnv } from '@/env'
import { authMiddleware } from '@/middleware/auth'
import { AuthService } from '@/services/auth.service'
import { parseOptionalJsonBody } from '@/utils/request'
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from '@/validators/auth'
import { created, ok } from '@/utils/response'

const authRoutes = new Hono<AppEnv>()

authRoutes.post('/register', zValidator('json', registerSchema), async (c) => {
  const payload = c.req.valid('json')
  const result = await AuthService.register(c.env, payload)
  return created(c, result, 'Registered')
})

authRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  const payload = c.req.valid('json')
  const result = await AuthService.login(c.env, payload)
  return ok(c, result, 'Logged in')
})

authRoutes.post('/refresh', zValidator('json', refreshSchema), async (c) => {
  const payload = c.req.valid('json')
  const result = await AuthService.refresh(c.env, payload.refreshToken)
  return ok(c, result, 'Token refreshed')
})

authRoutes.post('/logout', authMiddleware, async (c) => {
  const payload = await parseOptionalJsonBody(c, logoutSchema, {})
  const authUser = c.get('authUser')
  const result = await AuthService.logout(c.env, {
    refreshToken: payload.refreshToken,
    authUser
  })
  return ok(c, result, 'Logged out')
})

export default authRoutes
