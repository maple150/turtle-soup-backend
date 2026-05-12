import { z } from 'zod'

export const wsEnvelopeSchema = z.object({
  event: z.string().min(1),
  data: z.unknown(),
  ts: z.number().int().nonnegative(),
  reqId: z.string().optional()
})

export const sendChatMessageSchema = z.object({
  content: z.string().min(1).max(1000)
})

export const sendQuestionSchema = z.object({
  content: z.string().min(1).max(500)
})

export const answerQuestionSchema = z.object({
  questionId: z.string().min(1),
  answerType: z.enum(['yes', 'no', 'irrelevant']),
  answerText: z.string().min(1).max(500)
})
