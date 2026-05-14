import type {
  ChatMessage,
  GameAnswerType,
  GameQuestionRecord,
  GameRoundSnapshot,
  RoomSoupSnapshot
} from '@/types/game'
import type {
  RoomMemberRole,
  RoomMemberSnapshot,
  RoomSnapshot,
  RoomStatus
} from '@/types/room'
import { generateId } from '@/utils/random'
import { now } from '@/utils/time'

export interface RoomBootstrap {
  id: string
  roomCode: string
  name: string
  description: string
  status: RoomStatus
  mode: 'casual' | 'ranked' | 'private'
  hostUserId: string
  hostNickname: string
  capacity: number
  settings: {
    allowSpectators: boolean
    isPrivate: boolean
    maxQuestionsPerRound: number
  }
  createdAt: number
  updatedAt: number
}

export interface DurableRoomState {
  roomCode: string
  snapshot: RoomSnapshot
}

export interface RoomSessionIdentity {
  userId: string
  nickname: string
  role: RoomMemberRole
}

export function createEmptyRoomState(roomCode = 'UNKNOWN'): DurableRoomState {
  const timestamp = now()

  return {
    roomCode,
    snapshot: {
      id: '',
      roomCode,
      name: roomCode,
      description: '房间初始化中。',
      mode: 'casual',
      status: 'waiting',
      hostUserId: '',
      hostNickname: '房主',
      capacity: 8,
      createdAt: timestamp,
      updatedAt: timestamp,
      settings: {
        allowSpectators: true,
        isPrivate: false,
        maxQuestionsPerRound: 20
      },
      members: [],
      onlineCount: 0,
      currentSoup: null,
      currentRound: null,
      questions: [],
      chatMessages: [],
      gameState: 'waiting'
    }
  }
}

export function applyRoomBootstrap(current: DurableRoomState, bootstrap: RoomBootstrap): DurableRoomState {
  return {
    roomCode: bootstrap.roomCode,
    snapshot: {
      ...current.snapshot,
      id: bootstrap.id,
      roomCode: bootstrap.roomCode,
      name: bootstrap.name,
      description: bootstrap.description,
      mode: bootstrap.mode,
      status: bootstrap.status,
      hostUserId: bootstrap.hostUserId,
      hostNickname: bootstrap.hostNickname,
      capacity: bootstrap.capacity,
      createdAt: bootstrap.createdAt,
      updatedAt: bootstrap.updatedAt,
      settings: bootstrap.settings,
      gameState: bootstrap.status
    }
  }
}

export function normalizeSessionRole(state: DurableRoomState, identity: RoomSessionIdentity): RoomSessionIdentity {
  if (identity.userId === state.snapshot.hostUserId) {
    return {
      ...identity,
      role: 'host'
    }
  }

  if (!state.snapshot.settings.allowSpectators && identity.role === 'spectator') {
    return {
      ...identity,
      role: 'player'
    }
  }

  return identity
}

export function upsertMember(state: DurableRoomState, identity: RoomSessionIdentity) {
  const timestamp = now()
  const existing = state.snapshot.members.find((member) => member.userId === identity.userId)

  if (existing) {
    existing.nickname = identity.nickname
    existing.role = identity.role
    existing.online = true
    existing.lastSeenAt = timestamp
  } else {
    const member: RoomMemberSnapshot = {
      userId: identity.userId,
      nickname: identity.nickname,
      role: identity.role,
      online: true,
      connectedAt: timestamp,
      lastSeenAt: timestamp
    }
    state.snapshot.members.push(member)
  }

  state.snapshot.onlineCount = state.snapshot.members.filter((member) => member.online).length
  state.snapshot.updatedAt = timestamp
}

export function markMemberOffline(state: DurableRoomState, userId: string) {
  const member = state.snapshot.members.find((item) => item.userId === userId)

  if (member) {
    member.online = false
    member.lastSeenAt = now()
  }

  state.snapshot.onlineCount = state.snapshot.members.filter((item) => item.online).length
  state.snapshot.updatedAt = now()
}

export function ensureCurrentRound(state: DurableRoomState) {
  if (!state.snapshot.currentRound) {
    const round: GameRoundSnapshot = {
      id: generateId('round'),
      roomId: state.snapshot.id,
      soupId: state.snapshot.currentSoup?.id ?? null,
      hostUserId: state.snapshot.hostUserId,
      state: 'playing',
      startedAt: now(),
      endedAt: null,
      answerRevealed: false
    }
    state.snapshot.currentRound = round
  }

  return state.snapshot.currentRound
}

export function startGame(state: DurableRoomState, soup?: RoomSoupSnapshot | null) {
  if (soup) {
    state.snapshot.currentSoup = soup
  }

  if (!state.snapshot.currentSoup) {
    state.snapshot.currentSoup = {
      id: 'unassigned',
      title: '未分配题目',
      subtitle: null,
      description: '当前还没有可用题面，请稍后重新开始。',
      difficulty: 'medium',
      answer: null
    }
  }

  if (state.snapshot.currentRound?.state === 'finished') {
    state.snapshot.currentRound = null
    state.snapshot.questions = []
  }

  const round = ensureCurrentRound(state)
  round.state = 'playing'
  round.answerRevealed = false
  round.endedAt = null
  state.snapshot.status = 'playing'
  state.snapshot.gameState = 'playing'
  state.snapshot.updatedAt = now()
}

export function revealAnswer(state: DurableRoomState) {
  const round = ensureCurrentRound(state)
  round.answerRevealed = true
  round.state = 'revealed'
  state.snapshot.status = 'revealed'
  state.snapshot.gameState = 'revealed'
  state.snapshot.updatedAt = now()
}

export function finishGame(state: DurableRoomState) {
  const round = ensureCurrentRound(state)
  round.state = 'finished'
  round.endedAt = now()
  state.snapshot.status = 'finished'
  state.snapshot.gameState = 'finished'
  state.snapshot.updatedAt = now()
}

export function appendChatMessage(
  state: DurableRoomState,
  payload: Omit<ChatMessage, 'id' | 'createdAt'>
) {
  const message: ChatMessage = {
    id: generateId('chat'),
    createdAt: now(),
    ...payload
  }

  state.snapshot.chatMessages.push(message)
  state.snapshot.chatMessages = state.snapshot.chatMessages.slice(-100)
  state.snapshot.updatedAt = now()

  return message
}

export function appendSystemMessage(state: DurableRoomState, content: string) {
  return appendChatMessage(state, {
    roomId: state.snapshot.id,
    senderUserId: 'system',
    senderNickname: '系统',
    content,
    kind: 'system'
  })
}

export function appendQuestion(
  state: DurableRoomState,
  payload: Pick<GameQuestionRecord, 'askerUserId' | 'askerNickname' | 'questionText'>
) {
  const round = ensureCurrentRound(state)
  const question: GameQuestionRecord = {
    id: generateId('question'),
    roomId: state.snapshot.id,
    roundId: round.id,
    askerUserId: payload.askerUserId,
    askerNickname: payload.askerNickname,
    questionText: payload.questionText,
    answerType: null,
    answerText: null,
    answeredByUserId: null,
    answeredByNickname: null,
    askedAt: now(),
    answeredAt: null,
    ordinal: state.snapshot.questions.length + 1
  }

  state.snapshot.questions.push(question)
  state.snapshot.updatedAt = now()

  return question
}

export function answerQuestion(
  state: DurableRoomState,
  payload: {
    questionId: string
    answeredByUserId: string | null
    answeredByNickname: string
    answerType: GameAnswerType
    answerText: string
  }
) {
  const question = state.snapshot.questions.find((item) => item.id === payload.questionId)

  if (!question) {
    return null
  }

  question.answerType = payload.answerType
  question.answerText = payload.answerText
  question.answeredByUserId = payload.answeredByUserId
  question.answeredByNickname = payload.answeredByNickname
  question.answeredAt = now()
  state.snapshot.updatedAt = now()

  return question
}
