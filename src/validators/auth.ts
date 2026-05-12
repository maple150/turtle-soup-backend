import { z } from 'zod'

export const registerSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  nickname: z.string().min(2).max(32),
  email: z.string().email(),
  password: z.string().min(8).max(64)
})

export const loginSchema = z.object({
  account: z.string().min(3).max(128),
  password: z.string().min(8).max(64)
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(16)
})

export const logoutSchema = z.object({
  refreshToken: z.string().min(16).optional()
})
