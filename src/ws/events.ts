export const WsClientEvent = {
  HELLO: 'system.hello',
  PING: 'system.ping',
  ROOM_SNAPSHOT_GET: 'room.snapshot.get',
  CHAT_SEND: 'chat.send',
  GAME_START: 'game.start',
  GAME_QUESTION_SEND: 'game.question.send',
  GAME_ANSWER_SEND: 'game.answer.send',
  GAME_REVEAL: 'game.reveal',
  GAME_FINISH: 'game.finish'
} as const

export const WsServerEvent = {
  CONNECTED: 'system.connected',
  PONG: 'system.pong',
  ACK: 'system.ack',
  ERROR: 'system.error',
  ROOM_SNAPSHOT: 'room.snapshot',
  ROOM_MEMBER_JOINED: 'room.member.joined',
  ROOM_MEMBER_LEFT: 'room.member.left',
  ROOM_STATE_UPDATED: 'room.state.updated',
  CHAT_MESSAGE: 'chat.message',
  GAME_STATE_UPDATED: 'game.state.updated',
  GAME_QUESTION_CREATED: 'game.question.created',
  GAME_ANSWER_CREATED: 'game.answer.created',
  GAME_REVEALED: 'game.revealed',
  GAME_FINISHED: 'game.finished'
} as const

export type WsClientEventName = (typeof WsClientEvent)[keyof typeof WsClientEvent]
export type WsServerEventName = (typeof WsServerEvent)[keyof typeof WsServerEvent]
