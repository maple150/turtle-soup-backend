export type GameLifecycleState = 'waiting' | 'playing' | 'revealed' | 'finished'
export type GameAnswerType = 'yes' | 'no' | 'irrelevant'
export type SoupDifficulty = 'easy' | 'medium' | 'hard'

export interface RoomSoupSnapshot {
  id: string
  title: string
  subtitle: string | null
  description: string
  difficulty: SoupDifficulty
  answer?: string | null
}

export interface GameQuestionRecord {
  id: string
  roomId: string
  roundId: string
  askerUserId: string
  askerNickname: string
  questionText: string
  answerType: GameAnswerType | null
  answerText: string | null
  answeredByUserId: string | null
  answeredByNickname: string | null
  askedAt: number
  answeredAt: number | null
  ordinal: number
}

export interface GameRoundSnapshot {
  id: string
  roomId: string
  soupId: string | null
  hostUserId: string
  state: GameLifecycleState
  startedAt: number
  endedAt: number | null
  answerRevealed: boolean
}

export interface ChatMessage {
  id: string
  roomId: string
  senderUserId: string
  senderNickname: string
  content: string
  kind: 'chat' | 'system'
  createdAt: number
}
