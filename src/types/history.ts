import type { GameAnswerType, RoomStatus } from './db'

export interface HistoryRoundListItem {
  roundId: string
  roomId: string
  roomCode: string
  roomName: string
  soupId: string | null
  soupTitle: string | null
  state: RoomStatus
  answerRevealed: boolean
  questionCount: number
  startedAt: number
  endedAt: number | null
  resultSummary: HistoryRoundResultSummary | null
}

export interface HistoryRoundQuestionItem {
  id: string
  roundId: string
  roomId: string
  ordinal: number
  askerUserId: string
  askerNickname: string
  questionText: string
  answerType: GameAnswerType | null
  answerText: string | null
  answeredByUserId: string | null
  answeredByNickname: string | null
  askedAt: number
  answeredAt: number | null
}

export interface HistoryRoundResultSummary {
  roomStatus: RoomStatus
  answerRevealed: boolean
  questionCount: number
  onlineCountAtFinish: number
  finishedAt: number | null
  soupTitle: string | null
}

export interface HistoryRoundDetail extends HistoryRoundListItem {
  hostUserId: string
  soupAnswer: string | null
  questions: HistoryRoundQuestionItem[]
}
