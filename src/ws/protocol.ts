export interface WsEnvelope<TEvent extends string = string, TData = unknown> {
  event: TEvent
  data: TData
  ts: number
  reqId?: string
}

export type WsRoomLifecycleState = 'waiting' | 'playing' | 'revealed' | 'finished'
export type WsRoomMemberRole = 'host' | 'moderator' | 'player' | 'spectator'
export type WsAnswerType = 'yes' | 'no' | 'irrelevant'

export interface WsRoomMember {
  userId: string
  nickname: string
  role: WsRoomMemberRole
  online: boolean
  connectedAt: number
  lastSeenAt: number
}

export interface WsChatMessage {
  id: string
  roomId: string
  senderUserId: string
  senderNickname: string
  content: string
  kind: 'chat' | 'system'
  createdAt: number
}

export interface WsQuestionRecord {
  id: string
  roomId: string
  roundId: string
  askerUserId: string
  askerNickname: string
  questionText: string
  answerType: WsAnswerType | null
  answerText: string | null
  answeredByUserId: string | null
  answeredByNickname: string | null
  askedAt: number
  answeredAt: number | null
  ordinal: number
}

export interface WsSoupSnapshot {
  id: string
  title: string
  subtitle: string | null
  description: string
  difficulty: 'easy' | 'medium' | 'hard'
  answer?: string | null
}

export interface WsRoundSnapshot {
  id: string
  roomId: string
  soupId: string | null
  hostUserId: string
  state: WsRoomLifecycleState
  startedAt: number
  endedAt: number | null
  answerRevealed: boolean
}

export interface WsRoomSnapshot {
  id: string
  roomCode: string
  name: string
  description: string
  mode: 'casual' | 'ranked' | 'private'
  status: WsRoomLifecycleState
  hostUserId: string
  hostNickname: string
  capacity: number
  createdAt: number
  updatedAt: number
  settings: {
    allowSpectators: boolean
    isPrivate: boolean
    maxQuestionsPerRound: number
  }
  members: WsRoomMember[]
  onlineCount: number
  currentSoup: WsSoupSnapshot | null
  currentRound: WsRoundSnapshot | null
  questions: WsQuestionRecord[]
  chatMessages: WsChatMessage[]
  gameState: WsRoomLifecycleState
}

export interface WsHelloPayload {
  roomCode: string
  userId: string
  nickname: string
  role: WsRoomMemberRole
}

export interface WsChatSendPayload {
  content: string
}

export interface WsQuestionSendPayload {
  content: string
}

export interface WsAnswerSendPayload {
  questionId: string
  answerType: WsAnswerType
  answerText: string
}

export interface WsSnapshotGetPayload {
  reason?: 'initial' | 'reconnect' | 'manual'
}

export interface WsAckPayload {
  message: string
}

export interface WsErrorPayload {
  message: string
}
