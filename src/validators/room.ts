import { z } from 'zod'

export const roomCodeParamSchema = z.object({
  roomCode: z.string().min(4).max(12).transform((value) => value.toUpperCase())
})

export const createRoomSchema = z.object({
  name: z.string().min(2).max(64),
  description: z.string().min(1).max(500),
  mode: z.enum(['casual', 'ranked', 'private']),
  capacity: z.number().int().min(2).max(16),
  allowSpectators: z.boolean().default(true),
  isPrivate: z.boolean().default(false),
  maxQuestionsPerRound: z.number().int().min(1).max(50).default(20)
})

export const listRoomsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(['waiting', 'playing', 'revealed', 'finished']).optional(),
  mode: z.enum(['casual', 'ranked', 'private']).optional(),
  keyword: z.string().trim().max(64).optional()
})

export const joinRoomSchema = z.object({
  nickname: z.string().min(2).max(32).optional()
})
