import { createDb } from '@/db/client'
import type { AppBindings } from '@/env'
import type { RoomSnapshot } from '@/types/room'

export interface AiHostConfig {
  enabled: boolean
  provider: string
  baseUrl: string
  apiKey: string
  model: string
  systemPrompt: string
  temperature: number
  maxTokens: number
}

export interface AiConnectionTestResult {
  reachable: boolean
  model: string
  provider: string
  latencyMs: number
  preview: string | null
  statusCode?: number
  errorMessage?: string
}

const AI_CONFIG_KV_KEY = 'settings:ai-host'
const INTERNAL_EMAIL_SUFFIX = '@internal.local'
const AI_CONFIG_CACHE_TTL_MS = 15 * 1000
const AI_REQUEST_TIMEOUT_MS = 3000
const AI_TEST_TIMEOUT_MS = 10000

function defaultPrompt() {
  return [
    '你是一个海龟汤多人房间中的 AI 主持人。',
    '你的任务是根据给定的题面和答案，回答玩家的正式提问。',
    '你只能输出 JSON，格式为 {"answerType":"yes|no|irrelevant","answerText":"中文回答"}。',
    'answerType 只能是 yes、no、irrelevant 之一。',
    'answerText 必须简洁，像真实主持人一样自然，不能直接泄露完整答案，除非玩家要求公布答案。'
  ].join('\n')
}

export class AiService {
  private static cachedConfig: { value: AiHostConfig; expiresAt: number } | null = null

  static async getConfig(env: AppBindings): Promise<AiHostConfig> {
    if (this.cachedConfig && this.cachedConfig.expiresAt > Date.now()) {
      return this.cachedConfig.value
    }

    const fromKv = await env.APP_KV.get(AI_CONFIG_KV_KEY, 'json')
    const config = (fromKv ?? {}) as Partial<AiHostConfig>

    const resolved = {
      enabled: config.enabled ?? true,
      provider: config.provider || 'openai-compatible',
      baseUrl: config.baseUrl || env.AI_API_BASE_URL || 'https://api.openai.com/v1',
      apiKey: config.apiKey || env.AI_API_KEY || '',
      model: config.model || env.AI_MODEL || 'gpt-4o-mini',
      systemPrompt: config.systemPrompt || env.AI_SYSTEM_PROMPT || defaultPrompt(),
      temperature: typeof config.temperature === 'number' ? config.temperature : 0.3,
      maxTokens: typeof config.maxTokens === 'number' ? config.maxTokens : 512
    }

    this.cachedConfig = {
      value: resolved,
      expiresAt: Date.now() + AI_CONFIG_CACHE_TTL_MS
    }

    return resolved
  }

  static async saveConfig(env: AppBindings, payload: AiHostConfig) {
    await env.APP_KV.put(AI_CONFIG_KV_KEY, JSON.stringify(payload))
    this.cachedConfig = {
      value: payload,
      expiresAt: Date.now() + AI_CONFIG_CACHE_TTL_MS
    }
    return payload
  }

  static async testConnection(
    env: AppBindings,
    payload?: Partial<AiHostConfig>
  ): Promise<AiConnectionTestResult> {
    const base = await this.getConfig(env)
    const config: AiHostConfig = {
      ...base,
      ...payload,
      apiKey: payload?.apiKey ?? base.apiKey
    }

    if (!config.baseUrl || !config.apiKey || !config.model) {
      return {
        reachable: false,
        model: config.model || '',
        provider: config.provider,
        latencyMs: 0,
        preview: null,
        errorMessage: '请先填写模型服务地址、访问密钥和模型名称。'
      }
    }

    const startedAt = Date.now()

    try {
      const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        signal: this.createTimeoutSignal(AI_TEST_TIMEOUT_MS),
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          temperature: 0,
          max_tokens: Math.min(config.maxTokens, 24),
          messages: [
            {
              role: 'system',
              content: '你是连通性测试助手，请只回复“连接成功”。'
            },
            {
              role: 'user',
              content: '请返回测试结果。'
            }
          ]
        })
      })

      const latencyMs = Date.now() - startedAt

      if (!response.ok) {
        const errorText = await response.text()

        return {
          reachable: false,
          model: config.model,
          provider: config.provider,
          latencyMs,
          preview: null,
          statusCode: response.status,
          errorMessage: errorText.slice(0, 200) || '模型接口返回了非成功状态码。'
        }
      }

      const data = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string
          }
        }>
      }

      return {
        reachable: true,
        model: config.model,
        provider: config.provider,
        latencyMs,
        preview: data.choices?.[0]?.message?.content?.slice(0, 120) ?? null
      }
    } catch (error) {
      return {
        reachable: false,
        model: config.model,
        provider: config.provider,
        latencyMs: Date.now() - startedAt,
        preview: null,
        errorMessage: error instanceof Error ? error.message : '无法连接到模型服务。'
      }
    }
  }

  static async pickRandomSoup(env: AppBindings) {
    const db = createDb(env)
    const soup = await db.one<{
      id: string
      title: string
      subtitle: string | null
      description: string
      answer: string
      difficulty: 'easy' | 'medium' | 'hard'
    }>(
      `
      SELECT id, title, subtitle, description, answer, difficulty
      FROM soups
      WHERE is_public = 1 AND status = 'published'
      ORDER BY RANDOM()
      LIMIT 1
      `
    )

    return soup
      ? {
          id: soup.id,
          title: soup.title,
          subtitle: soup.subtitle,
          description: soup.description,
          answer: soup.answer,
          difficulty: soup.difficulty
        }
      : null
  }

  static async answerQuestion(
    env: AppBindings,
    snapshot: RoomSnapshot,
    questionText: string
  ): Promise<{ answerType: 'yes' | 'no' | 'irrelevant'; answerText: string }> {
    const config = await this.getConfig(env)

    if (!config.enabled) {
      return {
        answerType: 'irrelevant',
        answerText: 'AI 主持功能当前未启用，请稍后再试。'
      }
    }

    if (!config.apiKey || !config.baseUrl || !config.model || !snapshot.currentSoup?.answer) {
      return this.fallbackAnswer(snapshot, questionText)
    }

    try {
      const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        signal: this.createTimeoutSignal(AI_REQUEST_TIMEOUT_MS),
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          temperature: Math.min(config.temperature, 0.2),
          max_tokens: Math.min(config.maxTokens, 96),
          response_format: {
            type: 'json_object'
          },
          messages: [
            {
              role: 'system',
              content: config.systemPrompt
            },
            {
              role: 'user',
              content: JSON.stringify({
                soupTitle: snapshot.currentSoup.title,
                soupDescription: snapshot.currentSoup.description,
                soupAnswer: snapshot.currentSoup.answer,
                roomStatus: snapshot.status,
                questionText
              })
            }
          ]
        })
      })

      if (!response.ok) {
        return this.fallbackAnswer(snapshot, questionText)
      }

      const data = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string
          }
        }>
      }

      const content = data.choices?.[0]?.message?.content

      if (!content) {
        return this.fallbackAnswer(snapshot, questionText)
      }

      const parsed = JSON.parse(content) as {
        answerType?: string
        answerText?: string
      }

      if (
        (parsed.answerType === 'yes' || parsed.answerType === 'no' || parsed.answerType === 'irrelevant') &&
        parsed.answerText
      ) {
        return {
          answerType: parsed.answerType,
          answerText: parsed.answerText
        }
      }

      return this.fallbackAnswer(snapshot, questionText)
    } catch {
      return this.fallbackAnswer(snapshot, questionText)
    }
  }

  private static fallbackAnswer(snapshot: RoomSnapshot, questionText: string) {
    const answer = snapshot.currentSoup?.answer?.toLowerCase() ?? ''
    const normalizedQuestion = questionText.toLowerCase()

    if (
      answer &&
      normalizedQuestion.length > 0 &&
      normalizedQuestion.split(/\s+/).some((part) => part.length >= 2 && answer.includes(part))
    ) {
      return {
        answerType: 'yes' as const,
        answerText: '是，这个方向和真相有关，可以继续往下追问。'
      }
    }

    if (/(是不是|是否|有没有|能否|会不会)/.test(questionText)) {
      return {
        answerType: 'no' as const,
        answerText: '否，这个假设不是当前谜底的关键。'
      }
    }

    return {
      answerType: 'irrelevant' as const,
      answerText: '无关，这条线索和谜底没有直接关系。'
    }
  }

  static maskInternalEmail(email: string | null) {
    if (!email || email.endsWith(INTERNAL_EMAIL_SUFFIX)) {
      return null
    }

    return email
  }

  static buildInternalEmail(username: string) {
    return `${username}${INTERNAL_EMAIL_SUFFIX}`
  }

  private static createTimeoutSignal(timeoutMs: number) {
    const controller = new AbortController()
    setTimeout(() => controller.abort('timeout'), timeoutMs)
    return controller.signal
  }
}
