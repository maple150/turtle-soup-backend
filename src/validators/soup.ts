import { z } from 'zod'

export const soupIdParamSchema = z.object({
  id: z.string().min(1)
})

export const listSoupsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  keyword: z.string().trim().max(64).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional()
})

export const createSoupSchema = z.object({
  title: z.string().min(2).max(100),
  subtitle: z.string().max(100).optional(),
  description: z.string().min(1).max(500),
  content: z.string().min(1),
  answer: z.string().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  tags: z.array(z.string().min(1).max(32)).default([])
})
