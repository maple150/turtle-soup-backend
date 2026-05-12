import type { Context } from 'hono'

import type { ApiFailure, ApiSuccess } from '@/types/api'

export class AppError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export function ok<T>(c: Context, data: T, message = 'OK', code = 'OK', status = 200) {
  const body: ApiSuccess<T> = {
    success: true,
    code,
    message,
    data,
    ts: Date.now()
  }

  return c.json(body, status as 200)
}

export function created<T>(c: Context, data: T, message = 'Created', code = 'CREATED') {
  return ok(c, data, message, code, 201)
}

export function noContent(c: Context) {
  return c.body(null, 204)
}

export function fail(
  c: Context,
  status: number,
  code: string,
  message: string,
  error?: unknown
) {
  const body: ApiFailure = {
    success: false,
    code,
    message,
    error,
    ts: Date.now()
  }

  return c.json(body, status as 200)
}

export function requireValue<T>(value: T | null | undefined, status: number, code: string, message: string) {
  if (value === null || value === undefined) {
    throw new AppError(status, code, message)
  }

  return value
}
