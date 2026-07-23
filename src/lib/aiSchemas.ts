import { z } from 'zod'
import { AIError } from './aiErrors'

const nonEmptyString = z.string().trim().min(1)

export interface GeneratedTechnique {
  title: string
  content: string
  category?: string
  tags: string[]
}

export const aiConfigSchema = z.object({
  apiUrl: nonEmptyString,
  apiKey: z.string(),
  model: nonEmptyString,
  format: z.enum(['anthropic', 'openai']),
})

export const polishResultSchema = z.object({
  content: nonEmptyString,
  reflection: z.string().default(''),
})

const generatedTechniqueSchema = z.object({
  title: nonEmptyString,
  content: nonEmptyString,
  category: z.string().trim().min(1).optional(),
  tags: z.array(z.string()).default([]),
})

export const generatedTechniquesSchema = z.array(generatedTechniqueSchema).min(1).max(10)

export const generatedTechniqueCacheSchema = z.object({
  sportId: nonEmptyString,
  items: z.array(generatedTechniqueSchema).max(10),
  generatedAt: z.string().refine(value => !Number.isNaN(Date.parse(value))),
})

export const sportCategoriesSchema = z.array(nonEmptyString.max(12)).min(1).max(12)

export const categorizedTechniquesSchema = z.array(z.object({
  id: nonEmptyString,
  category: nonEmptyString,
})).max(200)

const anthropicResponseSchema = z.object({
  content: z.union([
    z.string(),
    z.array(z.object({
      type: z.string().optional(),
      text: z.string().optional(),
    }).passthrough()),
  ]).optional(),
}).passthrough()

const openAIResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({
      content: z.string().nullable().optional(),
    }).passthrough(),
  }).passthrough()).optional(),
  output: z.string().optional(),
}).passthrough()

const errorResponseSchema = z.object({
  error: z.union([
    z.string(),
    z.object({ message: z.string().optional() }).passthrough(),
  ]).optional(),
  message: z.string().optional(),
}).passthrough()

const anthropicStreamSchema = z.object({
  type: z.string().optional(),
  delta: z.object({
    type: z.string().optional(),
    text: z.string().optional(),
  }).passthrough().optional(),
  error: z.object({
    message: z.string().optional(),
  }).passthrough().optional(),
}).passthrough()

const openAIStreamSchema = z.object({
  choices: z.array(z.object({
    delta: z.object({
      content: z.string().nullable().optional(),
    }).passthrough(),
  }).passthrough()).optional(),
  error: z.object({
    message: z.string().optional(),
  }).passthrough().optional(),
}).passthrough()

export function stripJsonCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

export function parseAIJson<T>(text: string, schema: z.ZodType<T>, label: string): T {
  try {
    const json: unknown = JSON.parse(stripJsonCodeFence(text))
    return schema.parse(json)
  } catch (error) {
    const detail = error instanceof z.ZodError
      ? error.issues[0]?.path.join('.') || '根节点'
      : 'JSON'
    throw new AIError('response_format', `${label}格式异常（${detail}），请重试`, { cause: error })
  }
}

export function extractProviderText(raw: unknown): string {
  const anthropic = anthropicResponseSchema.safeParse(raw)
  if (anthropic.success) {
    if (typeof anthropic.data.content === 'string' && anthropic.data.content.trim()) {
      return anthropic.data.content
    }
    if (Array.isArray(anthropic.data.content)) {
      const text = anthropic.data.content.find(block => typeof block.text === 'string' && block.text.trim())?.text
      if (text) return text
    }
  }

  const openAI = openAIResponseSchema.safeParse(raw)
  if (openAI.success) {
    const text = openAI.data.choices?.[0]?.message.content
    if (text?.trim()) return text
    if (openAI.data.output?.trim()) return openAI.data.output
  }

  throw new AIError('response_format', 'API 返回格式无法识别，请检查 API URL 和格式设置')
}

export function extractAPIErrorMessage(raw: unknown): string | undefined {
  const parsed = errorResponseSchema.safeParse(raw)
  if (!parsed.success) return undefined
  if (typeof parsed.data.error === 'string') return parsed.data.error
  return parsed.data.error?.message ?? parsed.data.message
}

export function extractStreamText(raw: unknown, anthropic: boolean): string {
  if (anthropic) {
    const parsed = anthropicStreamSchema.safeParse(raw)
    if (!parsed.success) {
      throw new AIError('response_format', 'AI 流式返回格式异常')
    }
    if (parsed.data.type === 'error') {
      throw new AIError('http', parsed.data.error?.message ?? 'AI 流式请求失败')
    }
    return parsed.data.type === 'content_block_delta' && parsed.data.delta?.type === 'text_delta'
      ? parsed.data.delta.text ?? ''
      : ''
  }

  const parsed = openAIStreamSchema.safeParse(raw)
  if (!parsed.success) {
    throw new AIError('response_format', 'AI 流式返回格式异常')
  }
  if (parsed.data.error) {
    throw new AIError('http', parsed.data.error.message ?? 'AI 流式请求失败')
  }
  return parsed.data.choices?.[0]?.delta.content ?? ''
}
