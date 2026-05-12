import type { AppBindings } from '@/env'

export interface DatabaseClient {
  one<T>(sql: string, params?: unknown[]): Promise<T | null>
  many<T>(sql: string, params?: unknown[]): Promise<T[]>
  run(sql: string, params?: unknown[]): Promise<D1Result>
  exec(sql: string): Promise<D1ExecResult>
  batch<T = unknown>(statements: Array<{ sql: string; params?: unknown[] }>): Promise<D1Result<T>[]>
}

export function createDb(env: Pick<AppBindings, 'DB'>): DatabaseClient {
  return {
    async one<T>(sql: string, params: unknown[] = []) {
      return env.DB.prepare(sql).bind(...params).first<T>()
    },
    async many<T>(sql: string, params: unknown[] = []) {
      const result = await env.DB.prepare(sql).bind(...params).all<T>()
      return result.results ?? []
    },
    async run(sql: string, params: unknown[] = []) {
      return env.DB.prepare(sql).bind(...params).run()
    },
    async exec(sql: string) {
      return env.DB.exec(sql)
    },
    async batch<T = unknown>(statements: Array<{ sql: string; params?: unknown[] }>) {
      return env.DB.batch(
        statements.map((item) => env.DB.prepare(item.sql).bind(...(item.params ?? [])))
      ) as Promise<D1Result<T>[]>
    }
  }
}
