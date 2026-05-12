import { createDb } from '@/db/client'
import type { AppBindings } from '@/env'
import type { GameQuestionRecord } from '@/types/game'
import type { RoomRow } from '@/types/db'
import type { RoomSnapshot } from '@/types/room'
import { now } from '@/utils/time'

export interface RoomListQuery {
  page: number
  pageSize: number
  status?: string
  mode?: string
  keyword?: string
}

export interface CreateRoomRecord {
  id: string
  roomCode: string
  name: string
  description: string
  status: 'waiting' | 'playing' | 'revealed' | 'finished'
  mode: 'casual' | 'ranked' | 'private'
  hostUserId: string
  capacity: number
  settings: {
    allowSpectators: boolean
    isPrivate: boolean
    maxQuestionsPerRound: number
  }
  createdAt: number
  updatedAt: number
}

function buildResultSummary(snapshot: RoomSnapshot) {
  return JSON.stringify({
    roomStatus: snapshot.status,
    answerRevealed: snapshot.currentRound?.answerRevealed ?? false,
    questionCount: snapshot.questions.length,
    onlineCountAtFinish: snapshot.onlineCount,
    finishedAt: snapshot.currentRound?.endedAt ?? null,
    soupTitle: snapshot.currentSoup?.title ?? null
  })
}

function questionStatements(snapshot: RoomSnapshot, questions: GameQuestionRecord[]) {
  return questions.map((question) => ({
    sql: `
      INSERT INTO game_questions (
        id,
        round_id,
        room_id,
        asker_user_id,
        asker_nickname_snapshot,
        question_text,
        answer_type,
        answer_text,
        answered_by_user_id,
        answered_by_nickname_snapshot,
        asked_at,
        answered_at,
        ordinal
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    params: [
      question.id,
      question.roundId,
      snapshot.id,
      question.askerUserId,
      question.askerNickname,
      question.questionText,
      question.answerType,
      question.answerText,
      question.answeredByUserId,
      question.answeredByNickname,
      question.askedAt,
      question.answeredAt,
      question.ordinal
    ]
  }))
}

export class RoomRepository {
  static async findByCode(env: Pick<AppBindings, 'DB'>, roomCode: string) {
    const db = createDb(env)

    return db.one<RoomRow>(
      `
      SELECT
        id,
        room_code,
        name,
        description,
        status,
        mode,
        host_user_id,
        current_round_id,
        current_soup_id,
        capacity,
        settings,
        last_activity_at,
        created_at,
        updated_at,
        started_at,
        ended_at
      FROM rooms
      WHERE room_code = ?
      LIMIT 1
      `,
      [roomCode]
    )
  }

  static async list(env: Pick<AppBindings, 'DB'>, query: RoomListQuery) {
    const db = createDb(env)
    const offset = (query.page - 1) * query.pageSize
    const where: string[] = []
    const params: unknown[] = []

    if (query.status) {
      where.push('status = ?')
      params.push(query.status)
    }

    if (query.mode) {
      where.push('mode = ?')
      params.push(query.mode)
    }

    if (query.keyword) {
      where.push('(name LIKE ? OR description LIKE ?)')
      params.push(`%${query.keyword}%`, `%${query.keyword}%`)
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const totalRow = await db.one<{ total: number }>(
      `SELECT COUNT(*) as total FROM rooms ${whereClause}`,
      params
    )
    const rows = await db.many<RoomRow>(
      `
      SELECT
        id,
        room_code,
        name,
        description,
        status,
        mode,
        host_user_id,
        current_round_id,
        current_soup_id,
        capacity,
        settings,
        last_activity_at,
        created_at,
        updated_at,
        started_at,
        ended_at
      FROM rooms
      ${whereClause}
      ORDER BY last_activity_at DESC, created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, query.pageSize, offset]
    )

    return {
      rows,
      total: totalRow?.total ?? 0
    }
  }

  static async insert(env: Pick<AppBindings, 'DB'>, payload: CreateRoomRecord) {
    const db = createDb(env)

    await db.run(
      `
      INSERT INTO rooms (
        id,
        room_code,
        name,
        description,
        status,
        mode,
        host_user_id,
        current_round_id,
        current_soup_id,
        capacity,
        settings,
        last_activity_at,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payload.id,
        payload.roomCode,
        payload.name,
        payload.description,
        payload.status,
        payload.mode,
        payload.hostUserId,
        null,
        null,
        payload.capacity,
        JSON.stringify(payload.settings),
        payload.updatedAt,
        payload.createdAt,
        payload.updatedAt
      ]
    )
  }

  static async touchActivity(env: Pick<AppBindings, 'DB'>, roomId: string, timestamp = now()) {
    const db = createDb(env)

    await db.run('UPDATE rooms SET last_activity_at = ?, updated_at = ? WHERE id = ?', [
      timestamp,
      timestamp,
      roomId
    ])
  }

  static async syncSnapshot(env: Pick<AppBindings, 'DB'>, snapshot: RoomSnapshot) {
    const db = createDb(env)
    const timestamp = snapshot.updatedAt || now()
    const startedAt = snapshot.currentRound?.startedAt ?? null
    const endedAt = snapshot.currentRound?.endedAt ?? null

    await db.run(
      `
      UPDATE rooms
      SET
        status = ?,
        current_round_id = ?,
        current_soup_id = ?,
        last_activity_at = ?,
        updated_at = ?,
        started_at = ?,
        ended_at = ?
      WHERE id = ?
      `,
      [
        snapshot.status,
        snapshot.currentRound?.id ?? null,
        snapshot.currentSoup?.id ?? null,
        timestamp,
        timestamp,
        startedAt,
        endedAt,
        snapshot.id
      ]
    )
  }

  static async createRoundIfMissing(env: Pick<AppBindings, 'DB'>, snapshot: RoomSnapshot) {
    const round = snapshot.currentRound

    if (!round) {
      return null
    }

    const db = createDb(env)
    const existing = await db.one<{ id: string }>(
      'SELECT id FROM game_rounds WHERE id = ? LIMIT 1',
      [round.id]
    )

    if (existing) {
      await this.syncSnapshot(env, snapshot)
      return null
    }

    const nextRound = await db.one<{ next_round_no: number }>(
      'SELECT COALESCE(MAX(round_no), 0) + 1 as next_round_no FROM game_rounds WHERE room_id = ?',
      [snapshot.id]
    )

    await db.run(
      `
      INSERT INTO game_rounds (
        id,
        room_id,
        soup_id,
        host_user_id,
        room_code_snapshot,
        room_name_snapshot,
        soup_title_snapshot,
        soup_answer_snapshot,
        round_no,
        state,
        answer_revealed,
        question_count,
        result_summary,
        started_at,
        ended_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        round.id,
        snapshot.id,
        snapshot.currentSoup?.id ?? null,
        snapshot.hostUserId,
        snapshot.roomCode,
        snapshot.name,
        snapshot.currentSoup?.title ?? null,
        snapshot.currentSoup?.answer ?? null,
        nextRound?.next_round_no ?? 1,
        round.state,
        round.answerRevealed ? 1 : 0,
        snapshot.questions.length,
        null,
        round.startedAt,
        round.endedAt
      ]
    )

    await this.syncSnapshot(env, snapshot)

    return {
      roundId: round.id,
      roundNo: nextRound?.next_round_no ?? 1
    }
  }

  static async syncRoundState(env: Pick<AppBindings, 'DB'>, snapshot: RoomSnapshot) {
    const round = snapshot.currentRound

    await this.syncSnapshot(env, snapshot)

    if (!round) {
      return
    }

    await this.createRoundIfMissing(env, snapshot)

    const db = createDb(env)

    await db.run(
      `
      UPDATE game_rounds
      SET
        soup_id = ?,
        soup_title_snapshot = ?,
        soup_answer_snapshot = ?,
        state = ?,
        answer_revealed = ?,
        question_count = ?,
        ended_at = ?
      WHERE id = ?
      `,
      [
        snapshot.currentSoup?.id ?? null,
        snapshot.currentSoup?.title ?? null,
        snapshot.currentSoup?.answer ?? null,
        round.state,
        round.answerRevealed ? 1 : 0,
        snapshot.questions.length,
        round.endedAt,
        round.id
      ]
    )
  }

  static async finalizeRound(env: Pick<AppBindings, 'DB'>, snapshot: RoomSnapshot) {
    const round = snapshot.currentRound

    if (!round) {
      return
    }

    await this.createRoundIfMissing(env, snapshot)

    const db = createDb(env)
    const questions = snapshot.questions.filter((question) => question.roundId === round.id)
    const statements = [
      {
        sql: 'DELETE FROM game_questions WHERE round_id = ?',
        params: [round.id]
      },
      ...questionStatements(snapshot, questions)
    ]

    await db.batch(statements)

    await db.run(
      `
      UPDATE game_rounds
      SET
        soup_id = ?,
        soup_title_snapshot = ?,
        soup_answer_snapshot = ?,
        state = ?,
        answer_revealed = ?,
        question_count = ?,
        result_summary = ?,
        ended_at = ?
      WHERE id = ?
      `,
      [
        snapshot.currentSoup?.id ?? null,
        snapshot.currentSoup?.title ?? null,
        snapshot.currentSoup?.answer ?? null,
        round.state,
        round.answerRevealed ? 1 : 0,
        questions.length,
        buildResultSummary(snapshot),
        round.endedAt,
        round.id
      ]
    )

    await this.syncSnapshot(env, snapshot)
  }
}
