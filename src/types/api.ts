export interface ApiSuccess<T> {
  success: true
  code: string
  message: string
  data: T
  ts: number
}

export interface ApiFailure {
  success: false
  code: string
  message: string
  error?: unknown
  ts: number
}

export interface PaginationInput {
  page: number
  pageSize: number
}

export interface PaginatedResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}
