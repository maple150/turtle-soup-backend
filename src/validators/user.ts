import { z } from 'zod'

export const updateCurrentUserSchema = z.object({
  nickname: z.string().trim().min(2).max(32).optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
  bio: z.string().trim().max(500).optional()
})
