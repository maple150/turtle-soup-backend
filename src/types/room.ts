import type { ChatMessage, GameLifecycleState, GameQuestionRecord, GameRoundSnapshot, RoomSoupSnapshot } from './game'

export type RoomStatus = 'waiting' | 'playing' | 'revealed' | 'finished'
export type RoomMode = 'casual' | 'ranked' | 'private'
export type RoomMemberRole = 'host' | 'player' | 'spectator'

export interface RoomSettings {
  allowSpectators: boolean
  isPrivate: boolean
  maxQuestionsPerRound: number
}

export interface RoomMemberSnapshot {
  userId: string
  nickname: string
  role: RoomMemberRole
  online: boolean
  connectedAt: number
  lastSeenAt: number
}

export interface RoomSummary {
  id: string
  roomCode: string
  name: string
  description: string
  mode: RoomMode
  status: RoomStatus
  hostUserId: string
  hostNickname: string
  capacity: number
  createdAt: number
  updatedAt: number
}

export interface RoomSnapshot extends RoomSummary {
  members: RoomMemberSnapshot[]
  onlineCount: number
  settings: RoomSettings
  currentSoup: RoomSoupSnapshot | null
  currentRound: GameRoundSnapshot | null
  questions: GameQuestionRecord[]
  chatMessages: ChatMessage[]
  gameState: GameLifecycleState
}
