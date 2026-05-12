import { randomString } from './random'

export function generateRoomCode(length = 6) {
  return randomString(length)
}
