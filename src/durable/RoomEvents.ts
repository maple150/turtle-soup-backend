import { WsServerEvent } from '@/ws/events'
import { createWsMessage } from '@/ws/message'

import type { ChatMessage, GameQuestionRecord } from '@/types/game'
import type { RoomSnapshot } from '@/types/room'
import type {
  WsAckPayload,
  WsErrorPayload,
  WsHelloPayload,
  WsRoomSnapshot
} from '@/ws/protocol'

export function connectedEvent(payload: WsHelloPayload) {
  return createWsMessage(WsServerEvent.CONNECTED, payload)
}

export function snapshotEvent(snapshot: RoomSnapshot) {
  return createWsMessage(WsServerEvent.ROOM_SNAPSHOT, snapshot as WsRoomSnapshot)
}

export function roomStateEvent(snapshot: RoomSnapshot) {
  return createWsMessage(WsServerEvent.ROOM_STATE_UPDATED, {
    roomCode: snapshot.roomCode,
    status: snapshot.status,
    gameState: snapshot.gameState,
    onlineCount: snapshot.onlineCount,
    updatedAt: snapshot.updatedAt
  })
}

export function memberJoinedEvent(snapshot: RoomSnapshot, userId: string) {
  const member = snapshot.members.find((item) => item.userId === userId)

  return createWsMessage(WsServerEvent.ROOM_MEMBER_JOINED, {
    roomCode: snapshot.roomCode,
    member
  })
}

export function memberLeftEvent(snapshot: RoomSnapshot, userId: string) {
  return createWsMessage(WsServerEvent.ROOM_MEMBER_LEFT, {
    roomCode: snapshot.roomCode,
    userId
  })
}

export function chatMessageEvent(message: ChatMessage) {
  return createWsMessage(WsServerEvent.CHAT_MESSAGE, message)
}

export function questionCreatedEvent(question: GameQuestionRecord) {
  return createWsMessage(WsServerEvent.GAME_QUESTION_CREATED, question)
}

export function answerCreatedEvent(question: GameQuestionRecord) {
  return createWsMessage(WsServerEvent.GAME_ANSWER_CREATED, question)
}

export function gameStateUpdatedEvent(snapshot: RoomSnapshot) {
  return createWsMessage(WsServerEvent.GAME_STATE_UPDATED, {
    gameState: snapshot.gameState,
    currentRound: snapshot.currentRound,
    currentSoup: snapshot.currentSoup
  })
}

export function gameRevealedEvent(snapshot: RoomSnapshot) {
  return createWsMessage(WsServerEvent.GAME_REVEALED, {
    currentSoup: snapshot.currentSoup,
    currentRound: snapshot.currentRound
  })
}

export function gameFinishedEvent(snapshot: RoomSnapshot) {
  return createWsMessage(WsServerEvent.GAME_FINISHED, {
    currentRound: snapshot.currentRound,
    roomCode: snapshot.roomCode
  })
}

export function ackEvent(message: string, reqId?: string) {
  const payload: WsAckPayload = { message }
  return createWsMessage(WsServerEvent.ACK, payload, reqId)
}

export function errorEvent(message: string, reqId?: string) {
  const payload: WsErrorPayload = { message }
  return createWsMessage(WsServerEvent.ERROR, payload, reqId)
}
