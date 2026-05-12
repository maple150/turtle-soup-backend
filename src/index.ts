import { buildApp } from './app'
import { RoomDO } from './durable/RoomDO'
import { consumeQueue } from './queue/consumers'

const app = buildApp()

export { RoomDO }

export default {
  fetch: app.fetch,
  queue: consumeQueue
}
