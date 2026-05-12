import { createDb } from '@/db/client'
import type { AppBindings } from '@/env'
import type { GameQuestionRow, GameRoundRow } from '@/types/db'

interface HistoryRoundRow extends GameRoundRow {
  accessible: number
}

export class HistoryRepository {
  static async listUserRounds(
    env: Pick<AppBindings, 'DB'>,
    userId: string,
    query: { page: number; pageSize: number }
  ) {
    const db = createDb(env)
    const offset = (query.page - 1) * query.pageSize
    const accessClause = `
      gr.host_user_id = ?
      OR EXISTS (
        SELECT 1
        FROM game_questions gq
        WHERE gq.round_id = gr.id
          AND gq.asker_user_id = ?
      )
    `
    const totalRow = await db.one<{ total: number }>(
      `
      SELECT COUNT(*) as total
      FROM game_rounds gr
      WHERE ${accessClause}
      `,
      [userId, userId]
    )
    const rows = await db.many<GameRoundRow>(
      `
      SELECT
        gr.id,
        gr.room_id,
        gr.soup_id,
        gr.host_user_id,
        gr.room_code_snapshot,
        gr.room_name_snapshot,
        gr.soup_title_snapshot,
        gr.soup_answer_snapshot,
        gr.round_no,
        gr.state,
        gr.answer_revealed,
        gr.question_count,
        gr.result_summary,
        gr.started_at,
        gr.ended_at
      FROM game_rounds gr
      WHERE ${accessClause}
      ORDER BY gr.started_at DESC
      LIMIT ? OFFSET ?
      `,
      [userId, userId, query.pageSize, offset]
    )

    return {
      rows,
      total: totalRow?.total ?? 0
    }
  }

  static async findUserRoundById(env: Pick<AppBindings, 'DB'>, userId: string, roundId: string) {
    const db = createDb(env)

    return db.one<HistoryRoundRow>(
      `
      SELECT
        gr.id,
        gr.room_id,
        gr.soup_id,
        gr.host_user_id,
        gr.room_code_snapshot,
        gr.room_name_snapshot,
        gr.soup_title_snapshot,
        gr.soup_answer_snapshot,
        gr.round_no,
        gr.state,
        gr.answer_revealed,
        gr.question_count,
        gr.result_summary,
        gr.started_at,
        gr.ended_at,
        CASE
          WHEN gr.host_user_id = ?
            OR EXISTS (
              SELECT 1
              FROM game_questions gq
              WHERE gq.round_id = gr.id
                AND gq.asker_user_id = ?
            )
          THEN 1
          ELSE 0
        END as accessible
      FROM game_rounds gr
      WHERE gr.id = ?
      LIMIT 1
      `,
      [userId, userId, roundId]
    )
  }

  static async listRoundQuestions(env: Pick<AppBindings, 'DB'>, roundId: string) {
    const db = createDb(env)

    return db.many<GameQuestionRow>(
      `
      SELECT
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
      FROM game_questions
      WHERE round_id = ?
      ORDER BY ordinal ASC, asked_at ASC
      `,
      [roundId]
    )
  }
}
