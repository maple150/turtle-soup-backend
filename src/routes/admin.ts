import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'

import type { AppEnv } from '@/env'
import { authMiddleware, requireAuthUser } from '@/middleware/auth'
import { AiService } from '@/services/ai.service'
import { RoomService } from '@/services/room.service'
import { SoupService } from '@/services/soup.service'
import { UserService } from '@/services/user.service'
import { AppError, ok } from '@/utils/response'
import {
  adminAiConfigSchema,
  adminAiConfigTestSchema,
  adminCreateUserSchema,
  adminImportSoupsSchema,
  adminRoomCodeParamSchema,
  adminRoomsQuerySchema,
  adminSoupIdParamSchema,
  adminSoupsQuerySchema,
  adminUpdateRoomSchema,
  adminUpdateSoupSchema,
  adminUpdateUserSchema,
  adminUserIdParamSchema,
  adminUsersQuerySchema
} from '@/validators/admin'

const adminRoutes = new Hono<AppEnv>()

function requireAdmin(c: Parameters<typeof requireAuthUser>[0]) {
  const authUser = requireAuthUser(c)

  if (!authUser.roles.includes('admin')) {
    throw new AppError(403, 'FORBIDDEN', 'Admin access required')
  }

  return authUser
}

adminRoutes.use('*', authMiddleware)

adminRoutes.get('/overview', async (c) => {
  requireAdmin(c)
  const [users, soups, rooms, aiConfig] = await Promise.all([
    UserService.adminListUsers(c.env, { page: 1, pageSize: 1 }),
    SoupService.adminList(c.env, { page: 1, pageSize: 1 }),
    RoomService.adminList(c.env, { page: 1, pageSize: 1 }),
    AiService.getConfig(c.env)
  ])

  return ok(c, {
    enabled: true,
    totals: {
      users: users.total,
      soups: soups.total,
      rooms: rooms.total
    },
    aiEnabled: aiConfig.enabled,
    aiModel: aiConfig.model
  })
})

adminRoutes.get('/users', zValidator('query', adminUsersQuerySchema), async (c) => {
  requireAdmin(c)
  return ok(c, await UserService.adminListUsers(c.env, c.req.valid('query')))
})

adminRoutes.post('/users', zValidator('json', adminCreateUserSchema), async (c) => {
  requireAdmin(c)
  return ok(c, await UserService.adminCreateUser(c.env, c.req.valid('json')), 'User created')
})

adminRoutes.patch(
  '/users/:userId',
  zValidator('param', adminUserIdParamSchema),
  zValidator('json', adminUpdateUserSchema),
  async (c) => {
    requireAdmin(c)
    const params = c.req.valid('param')
    const payload = c.req.valid('json')
    return ok(c, await UserService.adminUpdateUser(c.env, params.userId, payload), 'User updated')
  }
)

adminRoutes.delete('/users/:userId', zValidator('param', adminUserIdParamSchema), async (c) => {
  requireAdmin(c)
  const params = c.req.valid('param')
  return ok(c, await UserService.adminDeleteUser(c.env, params.userId), 'User deleted')
})

adminRoutes.get('/soups', zValidator('query', adminSoupsQuerySchema), async (c) => {
  requireAdmin(c)
  return ok(c, await SoupService.adminList(c.env, c.req.valid('query')))
})

adminRoutes.patch(
  '/soups/:soupId',
  zValidator('param', adminSoupIdParamSchema),
  zValidator('json', adminUpdateSoupSchema),
  async (c) => {
    requireAdmin(c)
    const params = c.req.valid('param')
    const payload = c.req.valid('json')
    return ok(c, await SoupService.adminUpdate(c.env, params.soupId, payload), 'Soup updated')
  }
)

adminRoutes.delete('/soups/:soupId', zValidator('param', adminSoupIdParamSchema), async (c) => {
  requireAdmin(c)
  const params = c.req.valid('param')
  return ok(c, await SoupService.adminDelete(c.env, params.soupId), 'Soup deleted')
})

adminRoutes.post('/soups/import', zValidator('json', adminImportSoupsSchema), async (c) => {
  const authUser = requireAdmin(c)
  const payload = c.req.valid('json')
  return ok(c, await SoupService.adminImport(c.env, authUser.userId, payload), 'Soups imported')
})

adminRoutes.get('/rooms', zValidator('query', adminRoomsQuerySchema), async (c) => {
  requireAdmin(c)
  return ok(c, await RoomService.adminList(c.env, c.req.valid('query')))
})

adminRoutes.patch(
  '/rooms/:roomCode',
  zValidator('param', adminRoomCodeParamSchema),
  zValidator('json', adminUpdateRoomSchema),
  async (c) => {
    requireAdmin(c)
    const params = c.req.valid('param')
    const payload = c.req.valid('json')
    return ok(c, await RoomService.adminUpdate(c.env, params.roomCode, payload), 'Room updated')
  }
)

adminRoutes.delete(
  '/rooms/:roomCode',
  zValidator('param', adminRoomCodeParamSchema),
  async (c) => {
    requireAdmin(c)
    const params = c.req.valid('param')
    return ok(c, await RoomService.adminDelete(c.env, params.roomCode), 'Room deleted')
  }
)

adminRoutes.get('/ai-config', async (c) => {
  requireAdmin(c)
  return ok(c, await AiService.getConfig(c.env))
})

adminRoutes.put('/ai-config', zValidator('json', adminAiConfigSchema), async (c) => {
  requireAdmin(c)
  const payload = c.req.valid('json')
  return ok(
    c,
    await AiService.saveConfig(c.env, {
      ...payload,
      apiKey: payload.apiKey ?? ''
    }),
    'AI config updated'
  )
})

adminRoutes.post('/ai-config/test', zValidator('json', adminAiConfigTestSchema), async (c) => {
  requireAdmin(c)
  const payload = c.req.valid('json')
  return ok(c, await AiService.testConnection(c.env, payload), 'AI connection checked')
})

export default adminRoutes
