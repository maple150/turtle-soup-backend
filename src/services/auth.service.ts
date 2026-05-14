import { createDb } from '@/db/client'
import type { AppBindings, AuthenticatedUser } from '@/env'
import { enqueueAuditLog } from '@/queue/producer'
import { AiService } from '@/services/ai.service'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/utils/jwt'
import { hashPassword, verifyPassword } from '@/utils/password'
import { generateId, sha256Hex } from '@/utils/random'
import { AppError } from '@/utils/response'
import { now } from '@/utils/time'

interface UserRow {
  id: string
  username: string
  nickname: string
  email: string
  password_hash: string
  password_salt: string
  roles: string
}

export class AuthService {
  static async register(env: AppBindings, payload: { username: string; password: string }) {
    const db = createDb(env)
    const existing = await db.one<{ id: string }>(
      'SELECT id FROM users WHERE username = ? LIMIT 1',
      [payload.username]
    )

    if (existing) {
      throw new AppError(409, 'USER_EXISTS', '用户名已存在')
    }

    const timestamp = now()
    const userId = generateId('user')
    const password = await hashPassword(payload.password)
    const roles = JSON.stringify(['player'])
    const nickname = payload.username
    const email = AiService.buildInternalEmail(payload.username)

    await db.run(
      `
      INSERT INTO users (id, username, nickname, email, password_hash, password_salt, bio, roles, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        userId,
        payload.username,
        nickname,
        email,
        password.hash,
        password.salt,
        '',
        roles,
        timestamp,
        timestamp
      ]
    )

    await enqueueAuditLog(env, {
      action: 'auth.register',
      userId,
      username: payload.username
    })

    return {
      userId,
      username: payload.username,
      nickname,
      email: null
    }
  }

  static async login(env: AppBindings, payload: { username: string; password: string }) {
    const db = createDb(env)
    const user = await db.one<UserRow>(
      `
      SELECT id, username, nickname, email, password_hash, password_salt, roles
      FROM users
      WHERE username = ?
      LIMIT 1
      `,
      [payload.username]
    )

    if (!user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials')
    }

    const valid = await verifyPassword(payload.password, user.password_hash, user.password_salt)

    if (!valid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials')
    }

    const roles = JSON.parse(user.roles) as string[]
    const accessToken = await signAccessToken(env, {
      sub: user.id,
      username: user.username,
      nickname: user.nickname,
      roles
    })
    const refresh = await signRefreshToken(env, user.id)
    const refreshTokenHash = await sha256Hex(refresh.token)

    await db.run(
      `
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
      `,
      [refresh.tokenId, user.id, refreshTokenHash, refresh.expiresAt, now()]
    )

    await enqueueAuditLog(env, {
      action: 'auth.login',
      userId: user.id
    })

    await db.run('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?', [
      now(),
      now(),
      user.id
    ])

    return {
      accessToken,
      refreshToken: refresh.token,
      expiresIn: Number(env.ACCESS_TOKEN_TTL_SECONDS || 3600),
      tokenType: 'Bearer' as const,
      userId: user.id
    }
  }

  static async refresh(env: AppBindings, refreshToken: string) {
    const payload = await verifyRefreshToken(env, refreshToken)
    const db = createDb(env)
    const refreshTokenHash = await sha256Hex(refreshToken)
    const record = await db.one<{ user_id: string; expires_at: number; revoked_at: number | null }>(
      `
      SELECT user_id, expires_at, revoked_at
      FROM refresh_tokens
      WHERE id = ? AND token_hash = ?
      LIMIT 1
      `,
      [payload.tokenId, refreshTokenHash]
    )

    if (!record || record.revoked_at || record.expires_at < now()) {
      throw new AppError(401, 'REFRESH_TOKEN_INVALID', 'Refresh token is invalid or expired')
    }

    const user = await db.one<{ id: string; username: string; nickname: string; roles: string }>(
      'SELECT id, username, nickname, roles FROM users WHERE id = ? LIMIT 1',
      [record.user_id]
    )

    if (!user) {
      throw new AppError(401, 'USER_NOT_FOUND', 'User not found')
    }

    const accessToken = await signAccessToken(env, {
      sub: user.id,
      username: user.username,
      nickname: user.nickname,
      roles: JSON.parse(user.roles)
    })
    const nextRefresh = await signRefreshToken(env, user.id)
    const nextHash = await sha256Hex(nextRefresh.token)

    await db.run('UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?', [now(), payload.tokenId])
    await db.run(
      `
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
      `,
      [nextRefresh.tokenId, user.id, nextHash, nextRefresh.expiresAt, now()]
    )
    await db.run('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?', [
      now(),
      now(),
      user.id
    ])

    return {
      accessToken,
      refreshToken: nextRefresh.token,
      expiresIn: Number(env.ACCESS_TOKEN_TTL_SECONDS || 3600),
      tokenType: 'Bearer' as const
    }
  }

  static async logout(env: AppBindings, payload: { refreshToken?: string; authUser?: AuthenticatedUser }) {
    const db = createDb(env)

    if (payload.refreshToken) {
      const hash = await sha256Hex(payload.refreshToken)
      await db.run('UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ?', [now(), hash])
    }

    if (payload.authUser) {
      await enqueueAuditLog(env, {
        action: 'auth.logout',
        userId: payload.authUser.userId
      })
    }

    return {
      ok: true
    }
  }
}
