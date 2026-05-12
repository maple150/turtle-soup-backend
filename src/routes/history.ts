import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'

import type { AppEnv } from '@/env'
import { authMiddleware, requireAuthUser } from '@/middleware/auth'
import { HistoryService } from '@/services/history.service'
import { ok } from '@/utils/response'

const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20)
})

const roundIdParamSchema = z.object({
  roundId: z.string().min(1)
})

const historyRoutes = new Hono<AppEnv>()

historyRoutes.get('/me/history', authMiddleware, zValidator('query', historyQuerySchema), async (c) => {
  const authUser = requireAuthUser(c)
  const query = c.req.valid('query')
  const result = await HistoryService.listByUser(c.env, authUser.userId, query)
  return ok(c, result)
})

historyRoutes.get('/me/history/:roundId', authMiddleware, zValidator('param', roundIdParamSchema), async (c) => {
  const authUser = requireAuthUser(c)
  const params = c.req.valid('param')
  const result = await HistoryService.detailByUser(c.env, authUser.userId, params.roundId)
  return ok(c, result)
})

export default historyRoutes
