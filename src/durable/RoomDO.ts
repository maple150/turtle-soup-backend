import type { DurableObjectState } from '@cloudflare/workers-types'

import type { AppBindings } from '@/env'
import { enqueueGameArchive } from '@/queue/producer'
import { AiService } from '@/services/ai.service'
import { answerQuestionSchema, sendChatMessageSchema, sendQuestionSchema } from '@/validators/game'
import { WsClientEvent } from '@/ws/events'
import { parseWsMessage, stringifyEnvelope } from '@/ws/message'
import type {
  WsEnvelope,
  WsHelloPayload,
  WsQuestionSendPayload,
  WsSnapshotGetPayload
} from '@/ws/protocol'
import {
  ackEvent,
  answerCreatedEvent,
  chatMessageEvent,
  connectedEvent,
  errorEvent,
  gameFinishedEvent,
  gameRevealedEvent,
  gameStateUpdatedEvent,
  memberJoinedEvent,
  memberLeftEvent,
  questionCreatedEvent,
  roomStateEvent,
  snapshotEvent
} from './RoomEvents'
import { clearRoomState, loadRoomState, RoomPersistenceManager, saveRoomState } from './RoomPersistence'
import {
  answerQuestion,
  appendChatMessage,
  appendQuestion,
  appendSystemMessage,
  applyRoomBootstrap,
  createEmptyRoomState,
  finishGame,
  markMemberOffline,
  normalizeSessionRole,
  revealAnswer,
  startGame,
  upsertMember,
  type DurableRoomState,
  type RoomBootstrap,
  type RoomSessionIdentity
} from './RoomState'

interface RoomSession {
  sessionId: string
  userId: string
  nickname: string
  role: 'host' | 'player' | 'spectator'
  socket: WebSocket
}

export class RoomDO {
  private storage: DurableObjectStorage
  private persistenceManager: RoomPersistenceManager
  private roomState: DurableRoomState | null = null
  private sessions = new Map<string, RoomSession>()
  private loaded = false

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: AppBindings
  ) {
    this.storage = state.storage
    this.persistenceManager = new RoomPersistenceManager(env)
  }

  async fetch(request: Request): Promise<Response> {
    await this.ensureLoaded()

    const url = new URL(request.url)
    const upgrade = request.headers.get('Upgrade')

    if (upgrade?.toLowerCase() === 'websocket') {
      return this.handleWebSocketUpgrade(request)
    }

    if (url.pathname === '/internal/bootstrap' && request.method === 'POST') {
      return this.handleBootstrap(request)
    }

    if (url.pathname === '/internal/snapshot' && request.method === 'GET') {
      return this.handleSnapshotRequest()
    }

    if (url.pathname === '/internal/leave' && request.method === 'POST') {
      return this.handleForcedLeave(request)
    }

    if (url.pathname === '/internal/delete' && request.method === 'POST') {
      return this.handleDelete()
    }

    return new Response('Not found', { status: 404 })
  }

  private async ensureLoaded() {
    if (this.loaded) {
      return
    }

    this.roomState = (await loadRoomState(this.storage)) ?? createEmptyRoomState()
    this.loaded = true
  }

  private async persist() {
    if (this.roomState) {
      await saveRoomState(this.storage, this.roomState)
    }
  }

  private async handleBootstrap(request: Request) {
    const payload = (await request.json()) as RoomBootstrap
    this.roomState = applyRoomBootstrap(this.roomState ?? createEmptyRoomState(payload.roomCode), payload)
    await this.persist()

    return Response.json({
      ok: true,
      roomCode: payload.roomCode
    })
  }

  private handleSnapshotRequest() {
    return Response.json(this.roomState?.snapshot ?? null)
  }

  private async handleForcedLeave(request: Request) {
    const payload = (await request.json()) as { userId: string }
    await this.disconnectUser(payload.userId, 'Removed from room')

    return Response.json({
      ok: true
    })
  }

  private async handleDelete() {
    for (const session of this.sessions.values()) {
      try {
        session.socket.close(1001, 'Room deleted by admin')
      } catch {
        // Ignore close errors.
      }
    }

    this.sessions.clear()
    this.roomState = null
    await clearRoomState(this.storage)

    return Response.json({
      ok: true
    })
  }

  private handleWebSocketUpgrade(request: Request): Response {
    const identity = this.getRequestIdentity(request)

    if (!identity || !this.roomState) {
      return new Response('Invalid websocket context', { status: 400 })
    }

    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]
    const sessionId = crypto.randomUUID()

    server.accept()

    const normalized = normalizeSessionRole(this.roomState, identity)
    const session: RoomSession = {
      sessionId,
      userId: normalized.userId,
      nickname: normalized.nickname,
      role: normalized.role as RoomSession['role'],
      socket: server
    }

    void this.connectSession(session)

    server.addEventListener('message', (event) => {
      const text = typeof event.data === 'string' ? event.data : ''
      void this.handleSocketMessage(session.sessionId, text)
    })
    server.addEventListener('close', () => {
      void this.handleSocketClose(session.sessionId)
    })
    server.addEventListener('error', () => {
      void this.handleSocketClose(session.sessionId)
    })

    return new Response(null, {
      status: 101,
      webSocket: client
    } as ResponseInit)
  }

  private getRequestIdentity(request: Request): RoomSessionIdentity | null {
    const userId = request.headers.get('x-ws-user-id')
    const nickname = request.headers.get('x-ws-nickname')
    const role = request.headers.get('x-ws-role') as RoomSession['role'] | null

    if (!userId || !nickname || !role) {
      return null
    }

    return {
      userId,
      nickname,
      role
    }
  }

  private async connectSession(session: RoomSession) {
    if (!this.roomState) {
      return
    }

    await this.disconnectUser(session.userId, 'Reconnected from another session')
    this.sessions.set(session.sessionId, session)
    this.applyMemberConnectedState(session)

    this.sendToSession(
      session.sessionId,
      connectedEvent({
        roomCode: this.roomState.snapshot.roomCode,
        userId: session.userId,
        nickname: session.nickname,
        role: session.role
      } satisfies WsHelloPayload)
    )
    this.sendSnapshot(session.sessionId, {
      reason: 'reconnect'
    })
    this.sendToSession(session.sessionId, ackEvent('connected'))
    this.broadcast(memberJoinedEvent(this.roomState.snapshot, session.userId), session.sessionId)
    this.broadcast(roomStateEvent(this.roomState.snapshot))
    await this.persist()
  }

  private applyMemberConnectedState(session: RoomSession) {
    if (!this.roomState) {
      return
    }

    const identity: RoomSessionIdentity = {
      userId: session.userId,
      nickname: session.nickname,
      role: session.role
    }

    upsertMember(this.roomState, identity)
    appendSystemMessage(this.roomState, `${session.nickname} 加入了房间。`)
  }

  private async handleSocketClose(sessionId: string) {
    const session = this.sessions.get(sessionId)

    if (!session || !this.roomState) {
      return
    }

    this.sessions.delete(sessionId)

    const stillConnected = Array.from(this.sessions.values()).some((item) => item.userId === session.userId)

    if (stillConnected) {
      return
    }

    markMemberOffline(this.roomState, session.userId)
    appendSystemMessage(this.roomState, `${session.nickname} 离开了房间。`)
    this.broadcast(memberLeftEvent(this.roomState.snapshot, session.userId))
    this.broadcast(roomStateEvent(this.roomState.snapshot))
    await this.persist()
  }

  private async handleSocketMessage(sessionId: string, raw: string) {
    const session = this.sessions.get(sessionId)

    if (!session || !this.roomState) {
      return
    }

    try {
      const envelope = parseWsMessage(raw)
      await this.dispatchClientEvent(session, envelope)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown WebSocket error'
      this.sendToSession(sessionId, errorEvent(message))
    }
  }

  private async dispatchClientEvent(session: RoomSession, envelope: WsEnvelope) {
    switch (envelope.event) {
      case WsClientEvent.HELLO:
        this.handleHello(session, envelope)
        return
      case WsClientEvent.PING:
        this.handlePing(session, envelope)
        return
      case WsClientEvent.ROOM_SNAPSHOT_GET:
        this.handleSnapshotGet(session, envelope)
        return
      case WsClientEvent.CHAT_SEND:
        await this.handleChatSend(session, envelope)
        return
      case WsClientEvent.GAME_START:
        await this.handleGameStart(session, envelope)
        return
      case WsClientEvent.GAME_QUESTION_SEND:
        await this.handleQuestionSend(session, envelope)
        return
      case WsClientEvent.GAME_ANSWER_SEND:
        await this.handleAnswerSend(session, envelope)
        return
      case WsClientEvent.GAME_REVEAL:
        await this.handleGameReveal(session, envelope)
        return
      case WsClientEvent.GAME_FINISH:
        await this.handleGameFinish(session, envelope)
        return
      default:
        this.sendToSession(session.sessionId, errorEvent(`Unknown event: ${envelope.event}`, envelope.reqId))
    }
  }

  private handleHello(session: RoomSession, envelope: WsEnvelope) {
    this.sendToSession(
      session.sessionId,
      connectedEvent({
        roomCode: this.roomState?.snapshot.roomCode ?? '',
        userId: session.userId,
        nickname: session.nickname,
        role: session.role
      })
    )
    this.sendSnapshot(session.sessionId, {
      reason: 'manual'
    }, envelope.reqId)
  }

  private handlePing(session: RoomSession, envelope: WsEnvelope) {
    this.sendToSession(session.sessionId, {
      event: 'system.pong',
      data: { ok: true },
      ts: Date.now(),
      reqId: envelope.reqId
    })
  }

  private handleSnapshotGet(session: RoomSession, envelope: WsEnvelope) {
    this.sendSnapshot(session.sessionId, envelope.data as WsSnapshotGetPayload, envelope.reqId)
  }

  private async handleChatSend(session: RoomSession, envelope: WsEnvelope) {
    if (!this.roomState) {
      return
    }

    const payload = sendChatMessageSchema.parse(envelope.data)
    const message = appendChatMessage(this.roomState, {
      roomId: this.roomState.snapshot.id,
      senderUserId: session.userId,
      senderNickname: session.nickname,
      content: payload.content,
      kind: 'chat'
    })

    this.broadcast(chatMessageEvent(message))
    this.broadcast(roomStateEvent(this.roomState.snapshot))
    await this.persist()
  }

  private async handleGameStart(session: RoomSession, envelope: WsEnvelope) {
    if (!this.roomState) {
      return
    }

    this.assertHost(session)
    this.assertStateIn(['waiting', 'finished'])
    const nextSoup = this.roomState.snapshot.currentSoup ?? (await AiService.pickRandomSoup(this.env))
    startGame(this.roomState, nextSoup)
    appendSystemMessage(this.roomState, `${session.nickname} 开始了游戏，AI 主持人已就位。`)
    await this.persistenceManager.createRoundOnGameStart(this.roomState.snapshot)
    await this.persist()
    this.broadcast(gameStateUpdatedEvent(this.roomState.snapshot))
    this.broadcast(roomStateEvent(this.roomState.snapshot))
    this.sendToSession(session.sessionId, ackEvent('game.started', envelope.reqId))
  }

  private async handleQuestionSend(session: RoomSession, envelope: WsEnvelope) {
    if (!this.roomState) {
      return
    }

    this.assertStateIn(['playing'])
    const payload = sendQuestionSchema.parse(envelope.data) as WsQuestionSendPayload
    const question = appendQuestion(this.roomState, {
      askerUserId: session.userId,
      askerNickname: session.nickname,
      questionText: payload.content
    })

    this.broadcast(questionCreatedEvent(question))
    this.broadcast(gameStateUpdatedEvent(this.roomState.snapshot))
    this.sendToSession(session.sessionId, ackEvent('question.created', envelope.reqId))
    void this.resolveQuestionWithAi(question.id, question.roundId, payload.content)
    await this.persist()
  }

  private async handleAnswerSend(session: RoomSession, envelope: WsEnvelope) {
    if (!this.roomState) {
      return
    }

    this.assertHost(session)
    this.assertStateIn(['playing'])
    const payload = answerQuestionSchema.parse(envelope.data)
    const question = answerQuestion(this.roomState, {
      questionId: payload.questionId,
      answeredByUserId: session.userId,
      answeredByNickname: session.nickname,
      answerType: payload.answerType,
      answerText: payload.answerText
    })

    if (!question) {
      this.sendToSession(session.sessionId, errorEvent('Question not found', envelope.reqId))
      return
    }

    appendSystemMessage(
      this.roomState,
      `${session.nickname} 回答了问题 #${question.ordinal}。`
    )
    this.broadcast(answerCreatedEvent(question))
    this.broadcast(gameStateUpdatedEvent(this.roomState.snapshot))
    this.sendToSession(session.sessionId, ackEvent('question.answered', envelope.reqId))
    await this.persist()
  }

  private async handleGameReveal(session: RoomSession, envelope: WsEnvelope) {
    if (!this.roomState) {
      return
    }

    this.assertHost(session)
    this.assertStateIn(['playing'])
    revealAnswer(this.roomState)
    appendSystemMessage(this.roomState, `${session.nickname} 公布了答案。`)
    await this.persistenceManager.syncRoundRuntime(this.roomState.snapshot)
    await this.persist()
    this.broadcast(gameRevealedEvent(this.roomState.snapshot))
    this.broadcast(roomStateEvent(this.roomState.snapshot))
    this.sendToSession(session.sessionId, ackEvent('game.revealed', envelope.reqId))
  }

  private async handleGameFinish(session: RoomSession, envelope: WsEnvelope) {
    if (!this.roomState) {
      return
    }

    this.assertHost(session)
    this.assertStateIn(['playing', 'revealed'])
    finishGame(this.roomState)
    appendSystemMessage(this.roomState, `${session.nickname} 结束了本局游戏。`)
    await this.persistenceManager.finalizeRound(this.roomState.snapshot)
    await this.persist()
    this.broadcast(gameFinishedEvent(this.roomState.snapshot))
    this.broadcast(roomStateEvent(this.roomState.snapshot))
    this.sendToSession(session.sessionId, ackEvent('game.finished', envelope.reqId))
    await enqueueGameArchive(this.env, {
      roomId: this.roomState.snapshot.id,
      roundId: this.roomState.snapshot.currentRound?.id ?? ''
    })
  }

  private sendSnapshot(sessionId: string, _payload?: WsSnapshotGetPayload, reqId?: string) {
    if (!this.roomState) {
      return
    }

    const event = snapshotEvent(this.roomState.snapshot)
    this.sendToSession(sessionId, reqId ? { ...event, reqId } : event)
  }

  private assertHost(session: RoomSession) {
    if (!this.roomState) {
      return
    }

    if (session.userId !== this.roomState.snapshot.hostUserId) {
      throw new Error('Only the host can perform this action')
    }
  }

  private assertStateIn(states: Array<'waiting' | 'playing' | 'revealed' | 'finished'>) {
    if (!this.roomState) {
      return
    }

    if (!states.includes(this.roomState.snapshot.status)) {
      throw new Error(`Current room state does not allow this action: ${this.roomState.snapshot.status}`)
    }
  }

  private sendToSession(sessionId: string, payload: WsEnvelope) {
    const session = this.sessions.get(sessionId)

    if (!session) {
      return
    }

    try {
      session.socket.send(stringifyEnvelope(payload))
    } catch {
      this.sessions.delete(sessionId)
    }
  }

  private broadcast(payload: WsEnvelope, excludeSessionId?: string) {
    const raw = stringifyEnvelope(payload)

    for (const [sessionId, session] of this.sessions.entries()) {
      if (excludeSessionId && sessionId === excludeSessionId) {
        continue
      }

      try {
        session.socket.send(raw)
      } catch {
        this.sessions.delete(sessionId)
      }
    }
  }

  private async disconnectUser(userId: string, reason: string) {
    const matches = Array.from(this.sessions.values()).filter((session) => session.userId === userId)

    for (const session of matches) {
      try {
        session.socket.close(1000, reason)
      } catch {
        // Ignore close errors.
      }

      this.sessions.delete(session.sessionId)
    }

    if (this.roomState && matches.length > 0) {
      markMemberOffline(this.roomState, userId)
      this.broadcast(memberLeftEvent(this.roomState.snapshot, userId))
      this.broadcast(roomStateEvent(this.roomState.snapshot))
      await this.persist()
    }
  }

  private async resolveQuestionWithAi(questionId: string, roundId: string, questionText: string) {
    try {
      if (!this.roomState) {
        return
      }

      const initialRound = this.roomState.snapshot.currentRound
      const initialQuestion = this.roomState.snapshot.questions.find((item) => item.id === questionId)

      if (!initialRound || initialRound.id !== roundId || !initialQuestion || initialQuestion.roundId !== roundId) {
        return
      }

      const aiAnswer = await AiService.answerQuestion(this.env, this.roomState.snapshot, questionText)

      if (!this.roomState) {
        return
      }

      const currentRound = this.roomState.snapshot.currentRound
      const currentQuestion = this.roomState.snapshot.questions.find((item) => item.id === questionId)

      if (!currentRound || currentRound.id !== roundId || !currentQuestion || currentQuestion.roundId !== roundId) {
        return
      }

      const answeredQuestion = answerQuestion(this.roomState, {
        questionId,
        answeredByUserId: null,
        answeredByNickname: 'AI 主持人',
        answerType: aiAnswer.answerType,
        answerText: aiAnswer.answerText
      })

      if (!answeredQuestion) {
        return
      }

      appendSystemMessage(this.roomState, `AI 主持人已回答问题 #${answeredQuestion.ordinal}。`)
      this.broadcast(answerCreatedEvent(answeredQuestion))
      this.broadcast(gameStateUpdatedEvent(this.roomState.snapshot))
      await this.persist()
    } catch (error) {
      console.error('Failed to resolve question with AI', error)

      if (!this.roomState) {
        return
      }

      const currentRound = this.roomState.snapshot.currentRound
      const currentQuestion = this.roomState.snapshot.questions.find((item) => item.id === questionId)

      if (!currentRound || currentRound.id !== roundId || !currentQuestion || currentQuestion.roundId !== roundId || currentQuestion.answerType) {
        return
      }

      appendSystemMessage(this.roomState, 'AI 主持人暂时无法回答这道问题，请稍后再试。')
      this.broadcast(gameStateUpdatedEvent(this.roomState.snapshot))

      try {
        await this.persist()
      } catch (persistError) {
        console.error('Failed to persist room state after AI error', persistError)
      }
    }
  }
}
