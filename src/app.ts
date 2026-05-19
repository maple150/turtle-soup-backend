import { Hono } from 'hono'
import { cors } from 'hono/cors'

import type { AppEnv } from '@/env'
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

const DEFAULT_CORS_ORIGINS = [
  'https://turtle-soup-frontend.pages.dev',
  'https://turtle-soup-frontend-puce.vercel.app'
]

function resolveCorsOrigin(origin: string, configuredOrigin: string) {
  const configured = configuredOrigin
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const allowedOrigins = new Set([...DEFAULT_CORS_ORIGINS, ...configured])

  if (!origin) {
    return configured[0] || DEFAULT_CORS_ORIGINS[0]
  }

  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return origin
  }

  return allowedOrigins.has(origin) ? origin : undefined
}

export function buildApp() {
  const app = new Hono<AppEnv>()

  registerErrorHandling(app)

  app.use('*', loggerMiddleware)
  app.use(
    '*',
    cors({
      origin: (origin, c) => resolveCorsOrigin(origin, c.env.CORS_ORIGIN),
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
    })
  )

  app.use('/auth/*', rateLimitMiddleware('auth'))
  app.use('/rooms/*', rateLimitMiddleware('rooms'))
  app.use('/soups/*', rateLimitMiddleware('soups'))
  app.use('/admin/*', rateLimitMiddleware('admin'))

  app.get('/', (c) => ok(c, null, 'turtle-soup-backend is running'))
  app.get('/health', (c) => ok(c, null, 'healthy'))
  app.get('/healthz', (c) =>
    ok(c, {
      status: 'ok',
      service: 'turtle-back'
    })
  )

  app.route('/auth', authRoutes)
  app.route('/', usersRoutes)
  app.route('/', historyRoutes)
  app.route('/soups', soupsRoutes)
  app.route('/rooms', roomsRoutes)
  app.route('/admin', adminRoutes)

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
