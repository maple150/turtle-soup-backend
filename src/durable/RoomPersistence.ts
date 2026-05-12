import type { DurableObjectStorage } from '@cloudflare/workers-types'

import { RoomRepository } from '@/db/repositories'
import type { AppBindings } from '@/env'
import type { RoomSnapshot } from '@/types/room'
import type { DurableRoomState } from './RoomState'

const ROOM_STATE_KEY = 'room-state'

export async function loadRoomState(storage: DurableObjectStorage): Promise<DurableRoomState | null> {
  return (await storage.get<DurableRoomState>(ROOM_STATE_KEY)) ?? null
}

export async function saveRoomState(storage: DurableObjectStorage, state: DurableRoomState) {
  await storage.put(ROOM_STATE_KEY, state)
}

export async function clearRoomState(storage: DurableObjectStorage) {
  await storage.delete(ROOM_STATE_KEY)
}

export class RoomPersistenceManager {
  constructor(private readonly env: Pick<AppBindings, 'DB'>) {}

  async syncRoomSnapshot(snapshot: RoomSnapshot) {
    await RoomRepository.syncSnapshot(this.env, snapshot)
  }

  async createRoundOnGameStart(snapshot: RoomSnapshot) {
    await RoomRepository.createRoundIfMissing(this.env, snapshot)
  }

  async syncRoundRuntime(snapshot: RoomSnapshot) {
    await RoomRepository.syncRoundState(this.env, snapshot)
  }

  async finalizeRound(snapshot: RoomSnapshot) {
    await RoomRepository.finalizeRound(this.env, snapshot)
  }
}
