import type { Hono } from 'hono'

import type { AppEnv } from '@/env'
import { fail, AppError } from '@/utils/response'

export function registerErrorHandling(app: Hono<AppEnv>) {
  app.onError((error, c) => {
    console.error(error)

    if (error instanceof AppError) {
      return fail(c, error.status, error.code, error.message, error.details)
    }

    return fail(c, 500, 'INTERNAL_ERROR', 'Unexpected server error')
  })

  app.notFound((c) => fail(c, 404, 'NOT_FOUND', 'Route not found'))
}
