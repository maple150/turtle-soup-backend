import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'

import type { AppEnv } from '@/env'
import { authMiddleware, requireAuthUser } from '@/middleware/auth'
import { SoupService } from '@/services/soup.service'
import { createSoupSchema, listSoupsQuerySchema, soupIdParamSchema } from '@/validators/soup'
import { created, noContent, ok } from '@/utils/response'

const soupsRoutes = new Hono<AppEnv>()

soupsRoutes.get('/', zValidator('query', listSoupsQuerySchema), async (c) => {
  const query = c.req.valid('query')
  const result = await SoupService.list(c.env, query)
  return ok(c, result)
})

soupsRoutes.get('/:id', zValidator('param', soupIdParamSchema), async (c) => {
  const params = c.req.valid('param')
  const result = await SoupService.detail(c.env, params.id)
  return ok(c, result)
})

soupsRoutes.post('/', authMiddleware, zValidator('json', createSoupSchema), async (c) => {
  const authUser = requireAuthUser(c)
  const payload = c.req.valid('json')
  const result = await SoupService.create(c.env, authUser.userId, payload)
  return created(c, result, 'Soup created')
})

soupsRoutes.post('/:id/favorite', authMiddleware, zValidator('param', soupIdParamSchema), async (c) => {
  const authUser = requireAuthUser(c)
  const params = c.req.valid('param')
  const result = await SoupService.favorite(c.env, authUser.userId, params.id)
  return ok(c, result, 'Favorited')
})

soupsRoutes.delete('/:id/favorite', authMiddleware, zValidator('param', soupIdParamSchema), async (c) => {
  const authUser = requireAuthUser(c)
  const params = c.req.valid('param')
  await SoupService.unfavorite(c.env, authUser.userId, params.id)
  return noContent(c)
})

export default soupsRoutes
