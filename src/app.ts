import { Hono } from 'hono'
import { cors } from 'hono/cors'

import type { AppEnv } from '@/env'
import { assertRequiredSecrets } from '@/env'
import { registerErrorHandling } from '@/middleware/error'
import { loggerMiddleware } from '@/middleware/logger'
import { rateLimitMiddleware } from '@/middleware/rateLimit'
import adminRoutes from '@/routes/admin'
import authRoutes from '@/routes/auth'
import historyRoutes from '@/routes/history'
import roomsRoutes from '@/routes/rooms'
import soupsRoutes from '@/routes/soups'
import usersRoutes from '@/routes/users'
import { fail, ok } from '@/utils/response'
import { verifyWsTicket } from '@/utils/jwt'

export function buildApp() {
  const app = new Hono<AppEnv>()

  registerErrorHandling(app)

  app.use('*', loggerMiddleware)
  app.use(
    '/api/*',
    cors({
      origin: (origin, c) => origin || c.env.CORS_ORIGIN,
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']
    })
  )

  app.use('/api/*', async (c, next) => {
    assertRequiredSecrets(c.env)
    await next()
  })

  app.use('/api/*', rateLimitMiddleware('api'))

  app.get('/healthz', (c) =>
    ok(c, {
      status: 'ok',
      service: 'turtle-back'
    })
  )

  app.route('/api/auth', authRoutes)
  app.route('/api', usersRoutes)
  app.route('/api', historyRoutes)
  app.route('/api/soups', soupsRoutes)
  app.route('/api/rooms', roomsRoutes)
  app.route('/api/admin', adminRoutes)

  app.get('/ws/rooms/:roomCode', async (c) => {
    const roomCode = c.req.param('roomCode').toUpperCase()
    const ticket = c.req.query('ticket')

    if (!ticket) {
      return fail(c, 401, 'WS_TICKET_REQUIRED', 'Missing WebSocket ticket')
    }

    const payload = await verifyWsTicket(c.env, ticket)

    if (payload.roomCode !== roomCode) {
      return fail(c, 403, 'WS_TICKET_ROOM_MISMATCH', 'Ticket does not belong to this room')
    }

    const durableId = c.env.ROOM_DO.idFromName(roomCode)
    const stub = c.env.ROOM_DO.get(durableId)
    const headers = new Headers(c.req.raw.headers)

    headers.set('x-room-code', roomCode)
    headers.set('x-ws-user-id', payload.sub)
    headers.set('x-ws-nickname', payload.nickname)
    headers.set('x-ws-role', payload.role)

    const forwarded = new Request(c.req.raw, {
      headers
    })

    return stub.fetch(forwarded)
  })

  return app
}
