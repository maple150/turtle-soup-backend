import { createDb } from '@/db/client'
import type { AppBindings } from '@/env'
import { AppError } from '@/utils/response'

interface UserProfileRow {
  id: string
  username: string
  nickname: string
  email: string
  avatar_url: string | null
  bio: string
  roles: string
  created_at: number
  updated_at: number
}

export class UserService {
  static async getCurrentUser(env: AppBindings, userId: string) {
    const db = createDb(env)
    const user = await db.one<UserProfileRow>(
      `
      SELECT id, username, nickname, email, avatar_url, bio, roles, created_at, updated_at
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [userId]
    )

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found')
    }

    return {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      email: user.email,
      avatarUrl: user.avatar_url,
      bio: user.bio,
      roles: JSON.parse(user.roles) as string[],
      createdAt: user.created_at,
      updatedAt: user.updated_at
    }
  }
}
