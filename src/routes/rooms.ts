import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'

import type { AppEnv } from '@/env'
import { authMiddleware, requireAuthUser } from '@/middleware/auth'
import { RoomService } from '@/services/room.service'
import { parseOptionalJsonBody } from '@/utils/request'
import {
  createRoomSchema,
  joinRoomSchema,
  listRoomsQuerySchema,
  roomCodeParamSchema
} from '@/validators/room'
import { created, ok } from '@/utils/response'

const roomsRoutes = new Hono<AppEnv>()

roomsRoutes.post('/', authMiddleware, zValidator('json', createRoomSchema), async (c) => {
  const authUser = requireAuthUser(c)
  const payload = c.req.valid('json')
  const result = await RoomService.create(c.env, authUser, payload)
  return created(c, result, 'Room created')
})

roomsRoutes.get('/', zValidator('query', listRoomsQuerySchema), async (c) => {
  const query = c.req.valid('query')
  const result = await RoomService.list(c.env, query)
  return ok(c, result)
})

roomsRoutes.get('/:roomCode', zValidator('param', roomCodeParamSchema), async (c) => {
  const params = c.req.valid('param')
  const result = await RoomService.getByCode(c.env, params.roomCode)
  return ok(c, result)
})

roomsRoutes.post(
  '/:roomCode/join',
  authMiddleware,
  zValidator('param', roomCodeParamSchema),
  async (c) => {
    const authUser = requireAuthUser(c)
    const params = c.req.valid('param')
    const payload = await parseOptionalJsonBody(c, joinRoomSchema, {})
    const result = await RoomService.join(c.env, params.roomCode, authUser, payload)
    return ok(c, result, 'Joined room')
  }
)

roomsRoutes.post('/:roomCode/leave', authMiddleware, zValidator('param', roomCodeParamSchema), async (c) => {
  const authUser = requireAuthUser(c)
  const params = c.req.valid('param')
  const result = await RoomService.leave(c.env, params.roomCode, authUser)
  return ok(c, result, 'Left room')
})

roomsRoutes.post(
  '/:roomCode/ws-ticket',
  authMiddleware,
  zValidator('param', roomCodeParamSchema),
  async (c) => {
    const authUser = requireAuthUser(c)
    const params = c.req.valid('param')
    const result = await RoomService.createWsTicket(c.env, params.roomCode, authUser)
    return ok(c, result)
  }
)

export default roomsRoutes
