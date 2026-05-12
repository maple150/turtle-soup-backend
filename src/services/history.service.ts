import { HistoryRepository } from '@/db/repositories'
import type { AppBindings } from '@/env'
import type {
  HistoryRoundDetail,
  HistoryRoundListItem,
  HistoryRoundQuestionItem,
  HistoryRoundResultSummary
} from '@/types/history'
import { AppError } from '@/utils/response'

function parseResultSummary(raw: string | null): HistoryRoundResultSummary | null {
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as HistoryRoundResultSummary
  } catch {
    return null
  }
}

function mapRoundListItem(row: {
  id: string
  room_id: string
  room_code_snapshot: string
  room_name_snapshot: string
  soup_id: string | null
  soup_title_snapshot: string | null
  state: 'waiting' | 'playing' | 'revealed' | 'finished'
  answer_revealed: number
  question_count: number
  result_summary: string | null
  started_at: number
  ended_at: number | null
}): HistoryRoundListItem {
  return {
    roundId: row.id,
    roomId: row.room_id,
    roomCode: row.room_code_snapshot,
    roomName: row.room_name_snapshot,
    soupId: row.soup_id,
    soupTitle: row.soup_title_snapshot,
    state: row.state,
    answerRevealed: row.answer_revealed === 1,
    questionCount: row.question_count,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    resultSummary: parseResultSummary(row.result_summary)
  }
}

function mapQuestionItem(row: {
  id: string
  round_id: string
  room_id: string
  ordinal: number
  asker_user_id: string
  asker_nickname_snapshot: string
  question_text: string
  answer_type: 'yes' | 'no' | 'irrelevant' | null
  answer_text: string | null
  answered_by_user_id: string | null
  answered_by_nickname_snapshot: string | null
  asked_at: number
  answered_at: number | null
}): HistoryRoundQuestionItem {
  return {
    id: row.id,
    roundId: row.round_id,
    roomId: row.room_id,
    ordinal: row.ordinal,
    askerUserId: row.asker_user_id,
    askerNickname: row.asker_nickname_snapshot,
    questionText: row.question_text,
    answerType: row.answer_type,
    answerText: row.answer_text,
    answeredByUserId: row.answered_by_user_id,
    answeredByNickname: row.answered_by_nickname_snapshot,
    askedAt: row.asked_at,
    answeredAt: row.answered_at
  }
}

export class HistoryService {
  static async listByUser(
    env: AppBindings,
    userId: string,
    query: { page: number; pageSize: number }
  ) {
    const { rows, total } = await HistoryRepository.listUserRounds(env, userId, query)

    return {
      list: rows.map(mapRoundListItem),
      total,
      page: query.page,
      pageSize: query.pageSize
    }
  }

  static async detailByUser(env: AppBindings, userId: string, roundId: string): Promise<HistoryRoundDetail> {
    const row = await HistoryRepository.findUserRoundById(env, userId, roundId)

    if (!row || row.accessible !== 1) {
      throw new AppError(404, 'HISTORY_ROUND_NOT_FOUND', 'History round not found')
    }

    const questions = await HistoryRepository.listRoundQuestions(env, roundId)
    const summary = mapRoundListItem(row)

    return {
      ...summary,
      hostUserId: row.host_user_id,
      soupAnswer: row.soup_answer_snapshot,
      questions: questions.map(mapQuestionItem)
    }
  }
}
