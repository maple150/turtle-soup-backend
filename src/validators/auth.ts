import { z } from 'zod'

export const registerSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(64)
})

export const loginSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(8).max(64)
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(16)
})

export const logoutSchema = z.object({
  refreshToken: z.string().min(16).optional()
})
