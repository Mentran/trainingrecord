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

const textPartSchema = z.object({
  type: z.string().optional(),
  text: z.string().optional(),
}).passthrough()

const messageContentSchema = z.union([
  z.string(),
  z.null(),
  z.array(z.union([z.string(), textPartSchema])),
]).optional()

const anthropicResponseSchema = z.object({
  content: messageContentSchema,
}).passthrough()

const openAIResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({
      content: messageContentSchema,
    }).passthrough().optional(),
    finish_reason: z.string().nullable().optional(),
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
      content: messageContentSchema,
    }).passthrough().optional(),
    message: z.object({
      content: messageContentSchema,
    }).passthrough().optional(),
    finish_reason: z.string().nullable().optional(),
  }).passthrough()).optional(),
  error: z.object({
    message: z.string().optional(),
  }).passthrough().optional(),
}).passthrough()

function extractMessageText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.map(part => {
    if (typeof part === 'string') return part
    if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
      return part.text
    }
    return ''
  }).join('')
}

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

const EMPTY_CONTENT_MESSAGE = 'AI 没有返回正文。若使用 DeepSeek 等思考模型，思考过程会占用输出额度，请稍后重试'

export function extractProviderText(raw: unknown): string {
  const anthropic = anthropicResponseSchema.safeParse(raw)
  if (anthropic.success) {
    const text = extractMessageText(anthropic.data.content)
    if (text.trim()) return text
  }

  const openAI = openAIResponseSchema.safeParse(raw)
  if (openAI.success) {
    const text = extractMessageText(openAI.data.choices?.[0]?.message?.content)
    if (text.trim()) return text
    if (openAI.data.output?.trim()) return openAI.data.output
    if (openAI.data.choices) {
      throw new AIError('empty_response', EMPTY_CONTENT_MESSAGE)
    }
  }

  if (anthropic.success && anthropic.data.content !== undefined) {
    throw new AIError('empty_response', EMPTY_CONTENT_MESSAGE)
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
    if (!parsed.success) return ''
    if (parsed.data.type === 'error') {
      throw new AIError('http', parsed.data.error?.message ?? 'AI 流式请求失败')
    }
    return parsed.data.type === 'content_block_delta' && parsed.data.delta?.type === 'text_delta'
      ? parsed.data.delta.text ?? ''
      : ''
  }

  const parsed = openAIStreamSchema.safeParse(raw)
  if (!parsed.success) return ''
  if (parsed.data.error) {
    throw new AIError('http', parsed.data.error.message ?? 'AI 流式请求失败')
  }
  const choice = parsed.data.choices?.[0]
  const fromDelta = extractMessageText(choice?.delta?.content)
  if (fromDelta) return fromDelta
  return extractMessageText(choice?.message?.content)
}
