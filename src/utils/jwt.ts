import { SignJWT, jwtVerify } from 'jose'

import type { AccessTokenPayload, AppBindings, RefreshTokenPayload, WsTicketPayload } from '@/env'
import { getRuntimeConfig } from '@/env'
import { randomString } from './random'
import { now, toUnixSeconds } from './time'

function secretKey(secret: string) {
  return new TextEncoder().encode(secret)
}

export async function signAccessToken(
  env: AppBindings,
  payload: Pick<AccessTokenPayload, 'sub' | 'username' | 'nickname' | 'roles'>
) {
  const ttl = getRuntimeConfig(env).accessTokenTtlSeconds

  return new SignJWT({
    username: payload.username,
    nickname: payload.nickname,
    roles: payload.roles,
    type: 'access'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(secretKey(env.JWT_ACCESS_SECRET))
}

export async function signRefreshToken(env: AppBindings, userId: string) {
  const ttl = getRuntimeConfig(env).refreshTokenTtlSeconds
  const tokenId = randomString(24)

  const token = await new SignJWT({
    tokenId,
    type: 'refresh'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(secretKey(env.JWT_REFRESH_SECRET))

  return {
    token,
    tokenId,
    expiresAt: now() + ttl * 1000
  }
}

export async function signWsTicket(
  env: AppBindings,
  payload: Pick<WsTicketPayload, 'sub' | 'roomCode' | 'nickname' | 'role'>
) {
  const ttl = getRuntimeConfig(env).wsTicketTtlSeconds

  return new SignJWT({
    roomCode: payload.roomCode,
    nickname: payload.nickname,
    role: payload.role,
    type: 'ws-ticket'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(secretKey(env.JWT_WS_SECRET))
}

export async function verifyAccessToken(env: AppBindings, token: string) {
  const { payload } = await jwtVerify(token, secretKey(env.JWT_ACCESS_SECRET))

  return {
    sub: String(payload.sub),
    username: String(payload.username),
    nickname: String(payload.nickname),
    roles: Array.isArray(payload.roles) ? payload.roles.map(String) : [],
    type: 'access',
    exp: payload.exp
  } satisfies AccessTokenPayload
}

export async function verifyRefreshToken(env: AppBindings, token: string) {
  const { payload } = await jwtVerify(token, secretKey(env.JWT_REFRESH_SECRET))

  return {
    sub: String(payload.sub),
    tokenId: String(payload.tokenId),
    type: 'refresh',
    exp: payload.exp
  } satisfies RefreshTokenPayload
}

export async function verifyWsTicket(env: AppBindings, token: string) {
  const { payload } = await jwtVerify(token, secretKey(env.JWT_WS_SECRET))

  return {
    sub: String(payload.sub),
    roomCode: String(payload.roomCode),
    nickname: String(payload.nickname),
    role: String(payload.role) as WsTicketPayload['role'],
    type: 'ws-ticket',
    exp: payload.exp,
    iat: toUnixSeconds(now())
  } satisfies WsTicketPayload
}
