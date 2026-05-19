import { RoomRepository } from '@/db/repositories'
import { createDb } from '@/db/client'
import type { AppBindings, AuthenticatedUser } from '@/env'
import { AiService } from '@/services/ai.service'
import type { RoomRow, UserRow } from '@/types/db'
import { signWsTicket } from '@/utils/jwt'
import { generateId } from '@/utils/random'
import { AppError } from '@/utils/response'
import { generateRoomCode } from '@/utils/roomCode'
import { now } from '@/utils/time'

async function ensureUniqueRoomCode(env: AppBindings) {
  const db = createDb(env)

  for (let i = 0; i < 8; i += 1) {
    const code = generateRoomCode()
    const existing = await db.one<{ id: string }>('SELECT id FROM rooms WHERE room_code = ? LIMIT 1', [code])

    if (!existing) {
      return code
    }
  }

  throw new AppError(500, 'ROOM_CODE_GENERATION_FAILED', 'Failed to generate room code')
}

async function getUserNickname(env: AppBindings, userId: string) {
  const db = createDb(env)
  const user = await db.one<UserRow>('SELECT id, nickname FROM users WHERE id = ? LIMIT 1', [userId])

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found')
  }

  return user.nickname
}

function resolveRoomRole(room: { hostUserId: string }, authUser: AuthenticatedUser) {
  if (room.hostUserId === authUser.userId) {
    return 'host' as const
  }

  if (authUser.roles.includes('moderator') || authUser.roles.includes('admin')) {
    return 'moderator' as const
  }

  return 'player' as const
}

export async function bootstrapRoomDurableObject(env: AppBindings, roomCode: string) {
  const room = await RoomService.getByCode(env, roomCode)
  const id = env.ROOM_DO.idFromName(room.roomCode)
  const stub = env.ROOM_DO.get(id)

  await stub.fetch('https://room.internal/internal/bootstrap', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(room)
  })
}

export class RoomService {
  static async create(
    env: AppBindings,
    authUser: AuthenticatedUser,
    payload: {
      name: string
      description: string
      mode: 'casual' | 'ranked' | 'private'
      capacity: number
      allowSpectators: boolean
      isPrivate: boolean
      maxQuestionsPerRound: number
    }
  ) {
    const roomCode = await ensureUniqueRoomCode(env)
    const roomId = generateId('room')
    const timestamp = now()

    await RoomRepository.insert(env, {
      id: roomId,
      roomCode,
      name: payload.name,
      description: payload.description,
      status: 'waiting',
      mode: payload.mode,
      hostUserId: authUser.userId,
      capacity: payload.capacity,
      settings: {
        allowSpectators: payload.allowSpectators,
        isPrivate: payload.isPrivate,
        maxQuestionsPerRound: payload.maxQuestionsPerRound
      },
      createdAt: timestamp,
      updatedAt: timestamp
    })

    await env.APP_KV.put(`room:code:${roomCode}`, roomId)
    await bootstrapRoomDurableObject(env, roomCode)

    return this.getByCode(env, roomCode)
  }

  static async list(
    env: AppBindings,
    query: { page: number; pageSize: number; status?: string; mode?: string; keyword?: string }
  ) {
    const { rows, total } = await RoomRepository.list(env, query)

    return {
      list: await Promise.all(rows.map((row) => this.mapRoomRow(env, row))),
      total,
      page: query.page,
      pageSize: query.pageSize
    }
  }

  static async getByCode(env: AppBindings, roomCode: string) {
    const row = await RoomRepository.findByCode(env, roomCode)

    if (!row) {
      throw new AppError(404, 'ROOM_NOT_FOUND', 'Room not found')
    }

    return this.mapRoomRow(env, row)
  }

  static async join(
    env: AppBindings,
    roomCode: string,
    authUser: AuthenticatedUser,
    payload?: { nickname?: string }
  ) {
    const room = await this.getByCode(env, roomCode)
    await bootstrapRoomDurableObject(env, room.roomCode)
    await RoomRepository.touchActivity(env, room.id)

    return {
      room,
      member: {
        userId: authUser.userId,
        nickname: payload?.nickname || authUser.nickname,
        role: resolveRoomRole(room, authUser)
      }
    }
  }

  static async leave(env: AppBindings, roomCode: string, authUser: AuthenticatedUser) {
    const room = await this.getByCode(env, roomCode)
    const id = env.ROOM_DO.idFromName(room.roomCode)
    const stub = env.ROOM_DO.get(id)

    await stub.fetch('https://room.internal/internal/leave', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        roomCode,
        userId: authUser.userId
      })
    })

    await RoomRepository.touchActivity(env, room.id)

    return {
      roomCode,
      left: true
    }
  }

  static async createWsTicket(env: AppBindings, roomCode: string, authUser: AuthenticatedUser) {
    const room = await this.getByCode(env, roomCode)
    const role = resolveRoomRole(room, authUser)
    const ticket = await signWsTicket(env, {
      sub: authUser.userId,
      roomCode,
      nickname: authUser.nickname,
      role
    })

    return {
      ticket,
      roomCode,
      expiresIn: Number(env.WS_TICKET_TTL_SECONDS || 60),
      websocketPath: `/ws/rooms/${roomCode}?ticket=${ticket}`
    }
  }

  static async adminList(env: AppBindings, query: { page: number; pageSize: number; keyword?: string }) {
    return this.list(env, query)
  }

  static async adminUpdate(
    env: AppBindings,
    roomCode: string,
    payload: {
      name?: string
      description?: string
      status?: 'waiting' | 'playing' | 'revealed' | 'finished'
      capacity?: number
    }
  ) {
    const room = await this.getByCode(env, roomCode)
    const db = createDb(env)
    const nextUpdatedAt = now()

    await db.run(
      `
      UPDATE rooms
      SET
        name = ?,
        description = ?,
        status = ?,
        capacity = ?,
        updated_at = ?,
        last_activity_at = ?
      WHERE id = ?
      `,
      [
        payload.name?.trim() || room.name,
        payload.description?.trim() || room.description,
        payload.status || room.status,
        payload.capacity ?? room.capacity,
        nextUpdatedAt,
        nextUpdatedAt,
        room.id
      ]
    )

    return this.getByCode(env, roomCode)
  }

  static async adminDelete(env: AppBindings, roomCode: string) {
    const room = await this.getByCode(env, roomCode)
    const db = createDb(env)
    const id = env.ROOM_DO.idFromName(room.roomCode)
    const stub = env.ROOM_DO.get(id)

    await stub.fetch('https://room.internal/internal/delete', {
      method: 'POST'
    })

    await db.batch([
      {
        sql: 'DELETE FROM game_questions WHERE room_id = ?',
        params: [room.id]
      },
      {
        sql: 'DELETE FROM game_rounds WHERE room_id = ?',
        params: [room.id]
      },
      {
        sql: 'DELETE FROM rooms WHERE id = ?',
        params: [room.id]
      }
    ])

    await env.APP_KV.delete(`room:code:${room.roomCode}`)

    return {
      roomCode: room.roomCode,
      deleted: true
    }
  }

  static async attachRandomSoup(env: AppBindings, roomCode: string) {
    const room = await this.getByCode(env, roomCode)
    const soup = await AiService.pickRandomSoup(env)

    if (!soup) {
      return null
    }

    const db = createDb(env)
    await db.run('UPDATE rooms SET current_soup_id = ?, updated_at = ? WHERE id = ?', [
      soup.id,
      now(),
      room.id
    ])

    return soup
  }

  private static async mapRoomRow(env: AppBindings, row: RoomRow) {
    const hostNickname = await getUserNickname(env, row.host_user_id)

    return {
      id: row.id,
      roomCode: row.room_code,
      name: row.name,
      description: row.description,
      status: row.status as 'waiting' | 'playing' | 'revealed' | 'finished',
      mode: row.mode as 'casual' | 'ranked' | 'private',
      hostUserId: row.host_user_id,
      hostNickname,
      currentRoundId: row.current_round_id,
      currentSoupId: row.current_soup_id,
      capacity: row.capacity,
      settings: JSON.parse(row.settings) as {
        allowSpectators: boolean
        isPrivate: boolean
        maxQuestionsPerRound: number
      },
      lastActivityAt: row.last_activity_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      startedAt: row.started_at,
      endedAt: row.ended_at
    }
  }
}
