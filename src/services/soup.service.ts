import { createDb } from '@/db/client'
import type { AppBindings } from '@/env'
import { generateId } from '@/utils/random'
import { AppError } from '@/utils/response'
import { now } from '@/utils/time'

interface SoupRow {
  id: string
  title: string
  subtitle: string | null
  description: string
  content: string
  answer: string
  difficulty: string
  tags: string
  created_by: string
  is_public: number
  status: string
  favorite_count: number
  created_at: number
  updated_at: number
}

function mapSoupSummary(row: SoupRow) {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    difficulty: row.difficulty,
    tags: JSON.parse(row.tags) as string[],
    favoriteCount: row.favorite_count,
    createdBy: row.created_by,
    status: row.status,
    isPublic: row.is_public === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapSoupDetail(row: SoupRow) {
  return {
    ...mapSoupSummary(row),
    content: row.content,
    answer: row.answer
  }
}

export class SoupService {
  static async list(
    env: AppBindings,
    query: { page: number; pageSize: number; keyword?: string; difficulty?: string }
  ) {
    const db = createDb(env)
    const offset = (query.page - 1) * query.pageSize
    const where: string[] = ["is_public = 1", "status = 'published'"]
    const params: unknown[] = []

    if (query.keyword) {
      where.push('(title LIKE ? OR description LIKE ?)')
      params.push(`%${query.keyword}%`, `%${query.keyword}%`)
    }

    if (query.difficulty) {
      where.push('difficulty = ?')
      params.push(query.difficulty)
    }

    const whereClause = `WHERE ${where.join(' AND ')}`
    const totalRow = await db.one<{ total: number }>(
      `SELECT COUNT(*) as total FROM soups ${whereClause}`,
      params
    )
    const rows = await db.many<SoupRow>(
      `
      SELECT id, title, subtitle, description, content, answer, difficulty, tags, created_by, is_public, status, favorite_count, created_at, updated_at
      FROM soups
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, query.pageSize, offset]
    )

    return {
      list: rows.map(mapSoupSummary),
      total: totalRow?.total ?? 0,
      page: query.page,
      pageSize: query.pageSize
    }
  }

  static async detail(env: AppBindings, soupId: string) {
    const db = createDb(env)
    const row = await db.one<SoupRow>(
      `
      SELECT id, title, subtitle, description, content, answer, difficulty, tags, created_by, is_public, status, favorite_count, created_at, updated_at
      FROM soups
      WHERE id = ? AND is_public = 1 AND status = 'published'
      LIMIT 1
      `,
      [soupId]
    )

    if (!row) {
      throw new AppError(404, 'SOUP_NOT_FOUND', 'Soup not found')
    }

    return mapSoupDetail(row)
  }

  static async create(
    env: AppBindings,
    userId: string,
    payload: {
      title: string
      subtitle?: string
      description: string
      content: string
      answer: string
      difficulty: string
      tags: string[]
    }
  ) {
    const db = createDb(env)
    const id = generateId('soup')
    const timestamp = now()

    await db.run(
      `
      INSERT INTO soups (id, title, subtitle, description, content, answer, difficulty, tags, created_by, is_public, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        payload.title,
        payload.subtitle ?? null,
        payload.description,
        payload.content,
        payload.answer,
        payload.difficulty,
        JSON.stringify(payload.tags),
        userId,
        1,
        'published',
        timestamp,
        timestamp
      ]
    )

    return this.adminGetById(env, id)
  }

  static async favorite(env: AppBindings, userId: string, soupId: string) {
    const db = createDb(env)
    await this.detail(env, soupId)

    await db.run(
      `
      INSERT OR IGNORE INTO favorites (id, user_id, soup_id, created_at)
      VALUES (?, ?, ?, ?)
      `,
      [generateId('fav'), userId, soupId, now()]
    )
    await db.run('UPDATE soups SET favorite_count = favorite_count + 1 WHERE id = ?', [soupId])

    return {
      soupId,
      favorited: true
    }
  }

  static async unfavorite(env: AppBindings, userId: string, soupId: string) {
    const db = createDb(env)
    await db.run('DELETE FROM favorites WHERE user_id = ? AND soup_id = ?', [userId, soupId])
    await db.run(
      'UPDATE soups SET favorite_count = CASE WHEN favorite_count > 0 THEN favorite_count - 1 ELSE 0 END WHERE id = ?',
      [soupId]
    )

    return {
      soupId,
      favorited: false
    }
  }

  static async adminList(
    env: AppBindings,
    query: { page: number; pageSize: number; keyword?: string }
  ) {
    const db = createDb(env)
    const offset = (query.page - 1) * query.pageSize
    const where: string[] = []
    const params: unknown[] = []

    if (query.keyword) {
      where.push('(title LIKE ? OR description LIKE ?)')
      params.push(`%${query.keyword}%`, `%${query.keyword}%`)
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const totalRow = await db.one<{ total: number }>(`SELECT COUNT(*) as total FROM soups ${whereClause}`, params)
    const rows = await db.many<SoupRow>(
      `
      SELECT id, title, subtitle, description, content, answer, difficulty, tags, created_by, is_public, status, favorite_count, created_at, updated_at
      FROM soups
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, query.pageSize, offset]
    )

    return {
      list: rows.map(mapSoupDetail),
      total: totalRow?.total ?? 0,
      page: query.page,
      pageSize: query.pageSize
    }
  }

  static async adminGetById(env: AppBindings, soupId: string) {
    const db = createDb(env)
    const row = await db.one<SoupRow>(
      `
      SELECT id, title, subtitle, description, content, answer, difficulty, tags, created_by, is_public, status, favorite_count, created_at, updated_at
      FROM soups
      WHERE id = ?
      LIMIT 1
      `,
      [soupId]
    )

    if (!row) {
      throw new AppError(404, 'SOUP_NOT_FOUND', 'Soup not found')
    }

    return mapSoupDetail(row)
  }

  static async adminUpdate(
    env: AppBindings,
    soupId: string,
    payload: {
      title?: string
      subtitle?: string
      description?: string
      content?: string
      answer?: string
      difficulty?: string
      tags?: string[]
      status?: string
      isPublic?: boolean
    }
  ) {
    const current = await this.adminGetById(env, soupId)
    const db = createDb(env)

    await db.run(
      `
      UPDATE soups
      SET
        title = ?,
        subtitle = ?,
        description = ?,
        content = ?,
        answer = ?,
        difficulty = ?,
        tags = ?,
        status = ?,
        is_public = ?,
        updated_at = ?
      WHERE id = ?
      `,
      [
        payload.title?.trim() || current.title,
        payload.subtitle === undefined ? current.subtitle : payload.subtitle.trim() || null,
        payload.description?.trim() || current.description,
        payload.content?.trim() || current.content,
        payload.answer?.trim() || current.answer,
        payload.difficulty || current.difficulty,
        JSON.stringify(payload.tags ?? current.tags),
        payload.status || current.status,
        payload.isPublic === undefined ? (current.isPublic ? 1 : 0) : payload.isPublic ? 1 : 0,
        now(),
        soupId
      ]
    )

    return this.adminGetById(env, soupId)
  }

  static async adminImport(
    env: AppBindings,
    userId: string,
    payload: {
      items: Array<{
        title: string
        subtitle?: string
        description: string
        content: string
        answer: string
        difficulty: 'easy' | 'medium' | 'hard'
        tags: string[]
        status: 'draft' | 'published' | 'archived'
        isPublic: boolean
      }>
    }
  ) {
    const db = createDb(env)
    const timestamp = now()
    const createdItems = payload.items.map((item) => ({
      id: generateId('soup'),
      title: item.title.trim()
    }))

    await db.batch(
      payload.items.map((item, index) => ({
        sql: `
          INSERT INTO soups (
            id,
            title,
            subtitle,
            description,
            content,
            answer,
            difficulty,
            tags,
            created_by,
            is_public,
            status,
            favorite_count,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        params: [
          createdItems[index].id,
          item.title.trim(),
          item.subtitle?.trim() || null,
          item.description.trim(),
          item.content.trim(),
          item.answer.trim(),
          item.difficulty,
          JSON.stringify(item.tags),
          userId,
          item.isPublic ? 1 : 0,
          item.status,
          0,
          timestamp,
          timestamp
        ]
      }))
    )

    return {
      importedCount: payload.items.length,
      items: createdItems
    }
  }
}
