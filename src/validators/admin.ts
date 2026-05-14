import { z } from 'zod'

export const adminUserIdParamSchema = z.object({
  userId: z.string().min(1)
})

export const adminSoupIdParamSchema = z.object({
  soupId: z.string().min(1)
})

export const adminRoomCodeParamSchema = z.object({
  roomCode: z.string().min(4).max(12).transform((value) => value.toUpperCase())
})

export const adminUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().trim().max(64).optional()
})

export const adminSoupsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().trim().max(64).optional()
})

export const adminRoomsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().trim().max(64).optional()
})

export const adminUpdateUserSchema = z.object({
  nickname: z.string().trim().min(2).max(32).optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
  bio: z.string().trim().max(500).optional(),
  roles: z.array(z.string().min(1).max(32)).max(10).optional(),
  status: z.enum(['active', 'blocked', 'deleted']).optional()
})

export const adminUpdateSoupSchema = z.object({
  title: z.string().trim().min(2).max(100).optional(),
  subtitle: z.string().trim().max(100).optional().or(z.literal('')),
  description: z.string().trim().min(1).max(500).optional(),
  content: z.string().trim().min(1).optional(),
  answer: z.string().trim().min(1).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(20).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  isPublic: z.boolean().optional()
})

export const adminImportSoupItemSchema = z.object({
  title: z.string().trim().min(2).max(100),
  subtitle: z.string().trim().max(100).optional().or(z.literal('')),
  description: z.string().trim().min(1).max(500),
  content: z.string().trim().min(1),
  answer: z.string().trim().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  tags: z.array(z.string().trim().min(1).max(32)).max(20).optional().default([]),
  status: z.enum(['draft', 'published', 'archived']).optional().default('published'),
  isPublic: z.boolean().optional().default(true)
})

export const adminImportSoupsSchema = z.object({
  items: z.array(adminImportSoupItemSchema).min(1).max(200)
})

export const adminUpdateRoomSchema = z.object({
  name: z.string().trim().min(2).max(64).optional(),
  description: z.string().trim().min(1).max(500).optional(),
  status: z.enum(['waiting', 'playing', 'revealed', 'finished']).optional(),
  capacity: z.number().int().min(2).max(16).optional()
})

export const adminAiConfigSchema = z.object({
  enabled: z.boolean(),
  provider: z.string().trim().max(32).default('openai-compatible'),
  baseUrl: z.string().trim().url().or(z.literal('')),
  apiKey: z.string().trim().max(500).optional().or(z.literal('')),
  model: z.string().trim().max(128),
  systemPrompt: z.string().trim().min(1).max(4000),
  temperature: z.number().min(0).max(2).default(0.3),
  maxTokens: z.number().int().min(64).max(4096).default(512)
})

export const adminAiConfigTestSchema = adminAiConfigSchema
