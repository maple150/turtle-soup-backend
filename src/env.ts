import type { JWTPayload } from 'jose'

export interface QueueEnvelope<T = unknown> {
  type: string
  payload: T
  ts: number
}

export interface AuthenticatedUser {
  userId: string
  username: string
  nickname: string
  roles: string[]
}

export interface AccessTokenPayload extends JWTPayload {
  sub: string
  username: string
  nickname: string
  roles: string[]
  type: 'access'
}

export interface RefreshTokenPayload extends JWTPayload {
  sub: string
  tokenId: string
  type: 'refresh'
}

export interface WsTicketPayload extends JWTPayload {
  sub: string
  roomCode: string
  nickname: string
  role: 'host' | 'player' | 'spectator'
  type: 'ws-ticket'
}

export interface AppBindings {
  DB: D1Database
  APP_KV: KVNamespace
  APP_QUEUE: Queue<QueueEnvelope>
  ROOM_DO: DurableObjectNamespace
  APP_ENV: string
  CORS_ORIGIN: string
  ACCESS_TOKEN_TTL_SECONDS: string
  REFRESH_TOKEN_TTL_SECONDS: string
  WS_TICKET_TTL_SECONDS: string
  RATE_LIMIT_WINDOW_SECONDS: string
  RATE_LIMIT_MAX_REQUESTS: string
  JWT_ACCESS_SECRET: string
  JWT_REFRESH_SECRET: string
  JWT_WS_SECRET: string
  AI_API_BASE_URL?: string
  AI_API_KEY?: string
  AI_MODEL?: string
  AI_SYSTEM_PROMPT?: string
}

export interface AppVariables {
  authUser?: AuthenticatedUser
  requestId: string
}

export type AppEnv = {
  Bindings: AppBindings
  Variables: AppVariables
}

export interface RuntimeConfig {
  accessTokenTtlSeconds: number
  refreshTokenTtlSeconds: number
  wsTicketTtlSeconds: number
  rateLimitWindowSeconds: number
  rateLimitMaxRequests: number
}

export function getRuntimeConfig(env: AppBindings): RuntimeConfig {
  return {
    accessTokenTtlSeconds: Number(env.ACCESS_TOKEN_TTL_SECONDS || 3600),
    refreshTokenTtlSeconds: Number(env.REFRESH_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 30),
    wsTicketTtlSeconds: Number(env.WS_TICKET_TTL_SECONDS || 60),
    rateLimitWindowSeconds: Number(env.RATE_LIMIT_WINDOW_SECONDS || 60),
    rateLimitMaxRequests: Number(env.RATE_LIMIT_MAX_REQUESTS || 120)
  }
}

export function assertRequiredSecrets(env: AppBindings) {
  const required = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'JWT_WS_SECRET'] as const

  for (const key of required) {
    if (!env[key]) {
      throw new Error(`Missing required secret: ${key}`)
    }
  }
}
