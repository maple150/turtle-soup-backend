import { createDb } from '@/db/client'
import type { AppBindings } from '@/env'
import { AiService } from '@/services/ai.service'
import { hashPassword } from '@/utils/password'
import { generateId } from '@/utils/random'
import { AppError } from '@/utils/response'
import { now } from '@/utils/time'

interface UserProfileRow {
  id: string
  username: string
  nickname: string
  email: string
  avatar_url: string | null
  bio: string
  roles: string
  status: string
  created_at: number
  updated_at: number
}

function mapUser(row: UserProfileRow) {
  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    email: AiService.maskInternalEmail(row.email),
    avatarUrl: row.avatar_url,
    bio: row.bio,
    roles: JSON.parse(row.roles) as string[],
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class UserService {
  static async getCurrentUser(env: AppBindings, userId: string) {
    const db = createDb(env)
    const user = await db.one<UserProfileRow>(
      `
      SELECT id, username, nickname, email, avatar_url, bio, roles, status, created_at, updated_at
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [userId]
    )

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found')
    }

    return mapUser(user)
  }

  static async updateCurrentUser(
    env: AppBindings,
    userId: string,
    payload: { nickname?: string; email?: string; bio?: string }
  ) {
    const db = createDb(env)
    const current = await db.one<UserProfileRow>(
      `
      SELECT id, username, nickname, email, avatar_url, bio, roles, status, created_at, updated_at
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [userId]
    )

    if (!current) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found')
    }

    const nextEmail =
      payload.email === undefined
        ? current.email
        : payload.email.trim() === ''
          ? AiService.buildInternalEmail(current.username)
          : payload.email.trim()

    if (nextEmail !== current.email) {
      const existing = await db.one<{ id: string }>('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1', [
        nextEmail,
        userId
      ])

      if (existing) {
        throw new AppError(409, 'EMAIL_EXISTS', 'Email already exists')
      }
    }

    await db.run(
      `
      UPDATE users
      SET nickname = ?, email = ?, bio = ?, updated_at = ?
      WHERE id = ?
      `,
      [
        payload.nickname?.trim() || current.nickname,
        nextEmail,
        payload.bio === undefined ? current.bio : payload.bio.trim(),
        now(),
        userId
      ]
    )

    return this.getCurrentUser(env, userId)
  }

  static async adminListUsers(
    env: AppBindings,
    query: { page: number; pageSize: number; keyword?: string }
  ) {
    const db = createDb(env)
    const offset = (query.page - 1) * query.pageSize
    const where: string[] = []
    const params: unknown[] = []

    if (query.keyword) {
      where.push('(username LIKE ? OR nickname LIKE ? OR email LIKE ?)')
      params.push(`%${query.keyword}%`, `%${query.keyword}%`, `%${query.keyword}%`)
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const totalRow = await db.one<{ total: number }>(`SELECT COUNT(*) as total FROM users ${whereClause}`, params)
    const rows = await db.many<UserProfileRow>(
      `
      SELECT id, username, nickname, email, avatar_url, bio, roles, status, created_at, updated_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, query.pageSize, offset]
    )

    return {
      list: rows.map(mapUser),
      total: totalRow?.total ?? 0,
      page: query.page,
      pageSize: query.pageSize
    }
  }

  static async adminUpdateUser(
    env: AppBindings,
    userId: string,
    payload: {
      nickname?: string
      email?: string
      bio?: string
      roles?: string[]
      status?: 'active' | 'blocked' | 'deleted'
    }
  ) {
    const db = createDb(env)
    const current = await db.one<UserProfileRow>(
      `
      SELECT id, username, nickname, email, avatar_url, bio, roles, status, created_at, updated_at
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [userId]
    )

    if (!current) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found')
    }

    const nextEmail =
      payload.email === undefined
        ? current.email
        : payload.email.trim() === ''
          ? AiService.buildInternalEmail(current.username)
          : payload.email.trim()

    if (nextEmail !== current.email) {
      const existing = await db.one<{ id: string }>('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1', [
        nextEmail,
        userId
      ])

      if (existing) {
        throw new AppError(409, 'EMAIL_EXISTS', 'Email already exists')
      }
    }

    await db.run(
      `
      UPDATE users
      SET nickname = ?, email = ?, bio = ?, roles = ?, status = ?, updated_at = ?
      WHERE id = ?
      `,
      [
        payload.nickname?.trim() || current.nickname,
        nextEmail,
        payload.bio === undefined ? current.bio : payload.bio.trim(),
        JSON.stringify(payload.roles ?? (JSON.parse(current.roles) as string[])),
        payload.status ?? current.status,
        now(),
        userId
      ]
    )

    return this.getCurrentUser(env, userId)
  }

  static async adminCreateUser(
    env: AppBindings,
    payload: {
      username: string
      password: string
      nickname?: string
      email?: string
      bio?: string
      roles?: string[]
      status?: 'active' | 'blocked' | 'deleted'
    }
  ) {
    const db = createDb(env)
    const username = payload.username.trim()
    const existingUser = await db.one<{ id: string }>('SELECT id FROM users WHERE username = ? LIMIT 1', [username])

    if (existingUser) {
      throw new AppError(409, 'USER_EXISTS', '用户名已存在')
    }

    const email = payload.email?.trim() || AiService.buildInternalEmail(username)
    const existingEmail = await db.one<{ id: string }>('SELECT id FROM users WHERE email = ? LIMIT 1', [email])

    if (existingEmail) {
      throw new AppError(409, 'EMAIL_EXISTS', '邮箱已存在')
    }

    const password = await hashPassword(payload.password)
    const timestamp = now()
    const userId = generateId('user')

    await db.run(
      `
      INSERT INTO users (id, username, nickname, email, password_hash, password_salt, bio, roles, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        userId,
        username,
        payload.nickname?.trim() || username,
        email,
        password.hash,
        password.salt,
        payload.bio?.trim() || '',
        JSON.stringify(payload.roles?.length ? payload.roles : ['player']),
        payload.status ?? 'active',
        timestamp,
        timestamp
      ]
    )

    return this.getCurrentUser(env, userId)
  }

  static async adminDeleteUser(env: AppBindings, userId: string) {
    const db = createDb(env)
    const current = await db.one<{ id: string }>('SELECT id FROM users WHERE id = ? LIMIT 1', [userId])

    if (!current) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found')
    }

    await db.run(
      `
      UPDATE users
      SET status = 'deleted', updated_at = ?
      WHERE id = ?
      `,
      [now(), userId]
    )
    await db.run('UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', [now(), userId])

    return {
      userId,
      deleted: true
    }
  }
}
