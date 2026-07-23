import type { TrainingRecord, TechniqueNote } from '../types'
import { scheduleLocalFileSync } from './localFileStore'
import { STORAGE_KEYS } from './storageKeys'
import { AIError, isAIError } from './aiErrors'
import {
  aiConfigSchema,
  categorizedTechniquesSchema,
  extractAPIErrorMessage,
  extractProviderText,
  extractStreamText,
  generatedTechniqueCacheSchema,
  generatedTechniquesSchema,
  parseAIJson,
  polishResultSchema,
  sportCategoriesSchema,
} from './aiSchemas'
import type { GeneratedTechnique } from './aiSchemas'

export type { GeneratedTechnique } from './aiSchemas'

const CONFIG_KEY = 'ai_config'
const LEGACY_KEY = 'claude_api_key'
const GENERATED_CACHE_KEY = 'technique_generated_cache'

export interface AIConfig {
  apiUrl: string
  apiKey: string
  model: string
  format: 'anthropic' | 'openai'
}

const DEFAULTS: AIConfig = {
  apiUrl: 'https://api.anthropic.com',
  apiKey: '',
  model: 'claude-sonnet-4-6',
  format: 'anthropic',
}

export function getAIConfig(): AIConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (raw) {
      const stored: unknown = JSON.parse(raw)
      if (stored && typeof stored === 'object') {
        const parsed = aiConfigSchema.safeParse({ ...DEFAULTS, ...stored })
        if (parsed.success) return parsed.data
      }
    }
  } catch { /* ignore */ }
  const legacyKey = localStorage.getItem(LEGACY_KEY) ?? ''
  return { ...DEFAULTS, apiKey: legacyKey }
}

export function setAIConfig(config: Partial<AIConfig>): void {
  const current = getAIConfig()
  const next = { ...current, ...config }
  if (!next.apiKey.trim()) next.apiKey = ''
  localStorage.setItem(CONFIG_KEY, JSON.stringify(next))
  localStorage.removeItem(LEGACY_KEY)
}

export function hasApiKey(): boolean {
  return !!getAIConfig().apiKey
}

// ── URL / format helpers ─────────────────────────────────

function resolveUrl(config: AIConfig): string {
  const base = config.apiUrl.replace(/\/+$/, '')
  if (base.includes('/v1/messages') || base.includes('/v1/chat/completions')) return base
  return config.format === 'anthropic' ? `${base}/v1/messages` : `${base}/v1/chat/completions`
}

function isAnthropicFormat(config: AIConfig): boolean {
  return config.format === 'anthropic' || config.apiUrl.includes('anthropic.com')
}

function buildHeaders(config: AIConfig): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (isAnthropicFormat(config)) {
    h['x-api-key'] = config.apiKey
    h['anthropic-version'] = '2023-06-01'
    h['anthropic-dangerous-direct-browser-access'] = 'true'
  } else {
    h['Authorization'] = `Bearer ${config.apiKey}`
  }
  return h
}

interface CallOptions {
  max_tokens: number
  system?: string
  messages: Array<{ role: string; content: string }>
  stream?: boolean
  signal?: AbortSignal
  timeoutMs?: number
}

interface FetchResult {
  response: Response
  cleanup: () => void
  didTimeout: () => boolean
}

const DEFAULT_REQUEST_TIMEOUT_MS = 45_000
const STREAM_REQUEST_TIMEOUT_MS = 120_000

function buildBody(config: AIConfig, opts: CallOptions): Record<string, unknown> {
  if (isAnthropicFormat(config)) {
    return {
      model: config.model,
      max_tokens: opts.max_tokens,
      ...(opts.stream ? { stream: true } : {}),
      ...(opts.system ? { system: opts.system } : {}),
      messages: opts.messages,
    }
  }
  const messages = opts.system
    ? [{ role: 'system', content: opts.system }, ...opts.messages]
    : opts.messages
  return {
    model: config.model,
    max_tokens: opts.max_tokens,
    ...(opts.stream ? { stream: true } : {}),
    messages,
  }
}

function createRequestSignal(externalSignal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController()
  let timedOut = false
  const handleExternalAbort = () => controller.abort(externalSignal?.reason)
  if (externalSignal?.aborted) handleExternalAbort()
  else externalSignal?.addEventListener('abort', handleExternalAbort, { once: true })

  const timeoutId = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timeoutId)
      externalSignal?.removeEventListener('abort', handleExternalAbort)
    },
  }
}

async function doFetch(config: AIConfig, opts: CallOptions): Promise<FetchResult> {
  const url = resolveUrl(config)
  if (!/^https?:\/\//i.test(config.apiUrl)) {
    throw new AIError('invalid_config', 'API URL 格式不正确，需以 http:// 或 https:// 开头')
  }
  const request = createRequestSignal(
    opts.signal,
    opts.timeoutMs ?? (opts.stream ? STREAM_REQUEST_TIMEOUT_MS : DEFAULT_REQUEST_TIMEOUT_MS),
  )
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(config),
      body: JSON.stringify(buildBody(config, opts)),
      signal: request.signal,
    })
    return { response, cleanup: request.cleanup, didTimeout: request.didTimeout }
  } catch (error) {
    request.cleanup()
    if (request.didTimeout()) {
      throw new AIError('timeout', 'AI 请求超时，请稍后重试', { cause: error })
    }
    if (opts.signal?.aborted || (error as Error).name === 'AbortError') {
      throw new AIError('cancelled', 'AI 请求已取消', { cause: error })
    }
    throw new AIError(
      'network',
      `无法连接到 API（${url}）\n可能原因：\n① 转接服务不支持浏览器直接访问（CORS 限制）\n② URL 填写有误\n③ 网络问题`,
      { cause: error },
    )
  }
}

// ── Non-streaming call (used by polishText) ──────────────

async function callAPI(config: AIConfig, opts: CallOptions): Promise<string> {
  const request = await doFetch(config, opts)
  try {
    const data: unknown = await request.response.json()
    if (!request.response.ok) {
      throw new AIError(
        'http',
        extractAPIErrorMessage(data) ?? `API 错误 ${request.response.status}`,
        { status: request.response.status },
      )
    }
    return extractProviderText(data)
  } catch (error) {
    if (isAIError(error)) throw error
    if (request.didTimeout()) {
      throw new AIError('timeout', 'AI 请求超时，请稍后重试', { cause: error })
    }
    if (opts.signal?.aborted || (error as Error).name === 'AbortError') {
      throw new AIError('cancelled', 'AI 请求已取消', { cause: error })
    }
    if (error instanceof SyntaxError) {
      throw new AIError('response_format', 'API 返回的不是有效 JSON', { cause: error })
    }
    throw new AIError('network', '读取 API 返回时连接中断，请重试', { cause: error })
  } finally {
    request.cleanup()
  }
}

// ── Polish ───────────────────────────────────────────────

export async function polishText(content: string, reflection: string): Promise<{ content: string; reflection: string }> {
  const config = getAIConfig()
  const prompt = `你是一个运动训练日记润色助手。请对以下训练记录进行润色，让文字更流畅、生动，保留原意和所有具体细节，不要添加不存在的内容。

训练内容：
${content}

${reflection ? `感悟：\n${reflection}` : ''}

请按以下 JSON 格式返回，不要有其他内容：
{"content":"润色后的训练内容","reflection":"润色后的感悟"}`

  const data = await callAPI(config, { max_tokens: 1024, messages: [{ role: 'user', content: prompt }] })
  return parseAIJson(data, polishResultSchema, 'AI 润色返回')
}

// ── Generate techniques ──────────────────────────────────

export interface GeneratedTechniqueCache {
  sportId: string
  items: GeneratedTechnique[]
  generatedAt: string
}

export function getGeneratedCache(sportId: string): GeneratedTechniqueCache | null {
  try {
    const raw = localStorage.getItem(GENERATED_CACHE_KEY)
    if (!raw) return null
    const cache = generatedTechniqueCacheSchema.parse(JSON.parse(raw))
    return cache.sportId === sportId ? cache : null
  } catch {
    return null
  }
}

export function setGeneratedCache(sportId: string, items: GeneratedTechnique[]): void {
  const cache: GeneratedTechniqueCache = { sportId, items, generatedAt: new Date().toISOString() }
  localStorage.setItem(GENERATED_CACHE_KEY, JSON.stringify(cache))
}

function normalizeGeneratedTechniques(items: GeneratedTechnique[], categories: string[]): GeneratedTechnique[] {
  return items.map(item => {
    const text = `${item.title} ${item.content} ${(item.tags ?? []).join(' ')}`
    const category = categories.find(c => item.category === c)
      ?? categories.find(c => text.includes(c))
      ?? categories[0]
    const tags = (item.tags ?? [])
      .flatMap(t => t.split(/[,，、/\s]+/))
      .map(t => t.trim())
      .filter(Boolean)
      .filter(t => t !== category)
      .filter(t => t.length <= 6)
      .filter(t => !['技术', '训练', '注意', '要点'].includes(t))
      .filter((t, i, arr) => arr.indexOf(t) === i)
      .slice(0, 2)

    return {
      ...item,
      category,
      tags: tags.length > 0 ? tags : ['动作要点'],
    }
  })
}

export async function generateTechniques(
  records: TrainingRecord[],
  sportName: string,
  categories: string[] = [],
): Promise<GeneratedTechnique[]> {
  const config = getAIConfig()
  if (records.length === 0) throw new Error('暂无训练记录，无法生成技巧')

  const recordSummary = records.slice(0, 10).map(r =>
    `[${r.date}] ${r.content}${r.reflection ? `\n感悟：${r.reflection}` : ''}`
  ).join('\n\n')

  const prompt = `你是一位专业的${sportName}教练。请根据以下训练记录，提炼出3-5条具体的技术要点或经验总结。

要求：
- 每条针对一个具体动作或技术环节
- 内容简洁实用，80字以内
- category 必须从可用技术分类中选 1 个最匹配的分类；不要自创大类
- tags 生成 1-2 个细分标签，来自训练记录中提到的动作细节、发力方式、节奏或常见问题；不要重复 category
- tags 每个不超过 6 个字，避免泛词，如"技术"、"训练"、"注意"

可用技术分类：
${categories.length > 0 ? categories.join('、') : '无'}

训练记录：
${recordSummary}

请严格按以下 JSON 数组格式返回，不要有其他内容：
[{"title":"动作名称","content":"技术要点说明","category":"分类名","tags":["细分标签1","细分标签2"]}]`

  const data = await callAPI(config, { max_tokens: 1500, messages: [{ role: 'user', content: prompt }] })
  return normalizeGeneratedTechniques(
    parseAIJson(data, generatedTechniquesSchema, 'AI 技巧返回'),
    categories,
  )
}

// ── Generate sport categories ────────────────────────────

export async function generateSportCategories(sportName: string): Promise<string[]> {
  const config = getAIConfig()
  const prompt = `请为「${sportName}」这项运动生成6-8个核心技术分类标签，用于对训练技巧笔记进行分类管理。

要求：
- 覆盖该运动最主要的技术方向
- 每个分类2-4个字，简洁明确
- 适合初学者到中级水平

请严格按 JSON 数组格式返回，不要有其他内容：
["分类1","分类2","分类3"]`

  const data = await callAPI(config, { max_tokens: 512, messages: [{ role: 'user', content: prompt }] })
  return parseAIJson(data, sportCategoriesSchema, 'AI 分类返回')
}

export async function categorizeTechniques(
  notes: Array<{ id: string; title: string; content: string }>,
  categories: string[],
): Promise<Array<{ id: string; category: string }>> {
  const config = getAIConfig()
  const noteList = notes.map(n => `{"id":"${n.id}","title":"${n.title}"}`).join('\n')
  const prompt = `请将以下技巧笔记归类到对应分类中。

可用分类：${categories.join('、')}

笔记列表：
${noteList}

请严格按 JSON 数组格式返回，不要有其他内容：
[{"id":"笔记id","category":"分类名"}]`

  const data = await callAPI(config, { max_tokens: 1000, messages: [{ role: 'user', content: prompt }] })
  const parsed = parseAIJson(data, categorizedTechniquesSchema, 'AI 归类返回')
  const allowedIds = new Set(notes.map(note => note.id))
  const allowedCategories = new Set(categories)
  const invalid = parsed.find(item => !allowedIds.has(item.id) || !allowedCategories.has(item.category))
  if (invalid) {
    throw new AIError('response_format', 'AI 归类返回包含未知笔记或分类，请重试')
  }
  return parsed
}



export async function parseExperienceText(
  text: string,
  sportName: string,
  categories: string[] = [],
): Promise<GeneratedTechnique[]> {
  const config = getAIConfig()

  const prompt = `你是一位专业的${sportName}教练。用户粘贴了一段训练经验或教练指导文字，请将其整理为若干条独立的技巧条目。

要求：
- 每条针对一个具体动作或技术环节
- 内容简洁实用，80字以内
- category 必须从可用技术分类中选 1 个最匹配的分类；不要自创大类
- tags 生成 1-2 个细分标签，来自文字中提到的动作细节、发力方式、节奏或常见问题；不要重复 category
- tags 每个不超过 6 个字，避免泛词，如"技术"、"训练"、"注意"
- 如果原文已经很简洁，可以直接整理为1-2条

可用技术分类：
${categories.length > 0 ? categories.join('、') : '无'}

原文：
${text}

请严格按以下 JSON 数组格式返回，不要有其他内容：
[{"title":"动作名称","content":"技术要点说明","category":"分类名","tags":["细分标签1","细分标签2"]}]`

  const data = await callAPI(config, { max_tokens: 1500, messages: [{ role: 'user', content: prompt }] })
  return normalizeGeneratedTechniques(
    parseAIJson(data, generatedTechniquesSchema, 'AI 经验解析返回'),
    categories,
  )
}



export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

// ── Conversations ────────────────────────────────────────

export interface Conversation {
  id: string
  sportId: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

const CONVERSATIONS_KEY = STORAGE_KEYS.conversations
const ACTIVE_CONV_KEY = STORAGE_KEYS.activeConversation
const LEGACY_CHAT_KEY = 'sport_chat_history'

function setSyncedLocalItem(key: string, value: string): void {
  localStorage.setItem(key, value)
  scheduleLocalFileSync()
}

export function getConversations(sportId?: string): Conversation[] {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_KEY)
    if (raw) {
      const stored = JSON.parse(raw) as Array<Conversation | Omit<Conversation, 'sportId'>>
      const migrated = stored.map(conversation => (
        'sportId' in conversation && conversation.sportId
          ? conversation as Conversation
          : { ...conversation, sportId: 'tennis' }
      ))
      if (migrated.some((conversation, index) => !('sportId' in stored[index]) || conversation !== stored[index])) {
        setSyncedLocalItem(CONVERSATIONS_KEY, JSON.stringify(migrated))
      }
      return sportId ? migrated.filter(conversation => conversation.sportId === sportId) : migrated
    }
  } catch { /* ignore */ }
  // 迁移旧数据
  try {
    const legacy = localStorage.getItem(LEGACY_CHAT_KEY)
    if (legacy) {
      const msgs = JSON.parse(legacy) as ChatMessage[]
      if (msgs.length > 0) {
        const conv: Conversation = {
          id: `conv-${Date.now()}`,
          sportId: 'tennis',
          title: msgs.find(m => m.role === 'user')?.content.slice(0, 20) ?? '历史对话',
          messages: msgs,
          createdAt: msgs[0].createdAt,
          updatedAt: msgs[msgs.length - 1].createdAt,
        }
        setSyncedLocalItem(CONVERSATIONS_KEY, JSON.stringify([conv]))
        localStorage.removeItem(LEGACY_CHAT_KEY)
        return !sportId || sportId === 'tennis' ? [conv] : []
      }
    }
  } catch { /* ignore */ }
  return []
}

export function saveConversation(conv: Conversation): void {
  const list = getConversations()
  const idx = list.findIndex(c => c.id === conv.id)
  if (idx >= 0) list[idx] = conv
  else list.unshift(conv)
  setSyncedLocalItem(CONVERSATIONS_KEY, JSON.stringify(list))
}

export function deleteConversation(id: string): void {
  const list = getConversations().filter(c => c.id !== id)
  setSyncedLocalItem(CONVERSATIONS_KEY, JSON.stringify(list))
}

function activeConversationKey(sportId: string): string {
  return `${ACTIVE_CONV_KEY}:${sportId}`
}

export function getActiveConvId(sportId = 'tennis'): string | null {
  const scoped = localStorage.getItem(activeConversationKey(sportId))
  if (scoped) return scoped
  if (sportId !== 'tennis') return null
  const legacy = localStorage.getItem(ACTIVE_CONV_KEY)
  if (legacy) {
    setSyncedLocalItem(activeConversationKey(sportId), legacy)
    localStorage.removeItem(ACTIVE_CONV_KEY)
  }
  return legacy
}

export function setActiveConvId(id: string, sportId = 'tennis'): void {
  setSyncedLocalItem(activeConversationKey(sportId), id)
}

export function clearActiveConvId(sportId = 'tennis'): void {
  localStorage.removeItem(activeConversationKey(sportId))
  scheduleLocalFileSync()
}

// ── System prompt ────────────────────────────────────────

function buildSystemPrompt(sportName: string): string {
  return `你是一位专业的${sportName}运动顾问，只回答与${sportName}训练相关的问题。

你的专长包括：${sportName}技术指导、训练计划建议、运动损伤预防与恢复、体能训练、运动营养等。

如果用户提问与${sportName}或运动无关，请礼貌地说明你只能回答${sportName}相关问题，并引导用户提问相关话题。

回答要简洁实用，结合用户的实际训练情况给出个性化建议。

每次回答结束后，另起一行，以 "FOLLOWUP:" 开头，提供2-3个相关的后续问题，用 "|" 分隔，每个问题不超过15字。例如：
FOLLOWUP: 如何改善正手击球？|发球练习有哪些方法？|如何提高步伐速度？`
}

function buildContext(records: TrainingRecord[], techniques: TechniqueNote[]): string {
  const parts: string[] = []

  if (records.length > 0) {
    const lines = records.slice(0, 8).map(r => {
      const meta = [r.date]
      if (r.coach) meta.push(`教练${r.coach}`)
      if (r.duration) meta.push(`${r.duration}分钟`)
      if (r.tags?.length) meta.push(r.tags.join('/'))
      const reflection = r.reflection ? `\n  感悟：${r.reflection}` : ''
      return `- ${meta.join('，')}：${r.content}${reflection}`
    })
    parts.push(`用户最近的训练记录：\n${lines.join('\n')}`)
  }

  if (techniques.length > 0) {
    const lines = techniques.slice(0, 10).map(n => {
      const cat = n.category ? `[${n.category}] ` : ''
      return `- ${cat}${n.title}：${n.content}`
    })
    parts.push(`用户已积累的技巧笔记（代表其当前技术水平）：\n${lines.join('\n')}`)
  }

  return parts.length > 0 ? '\n\n' + parts.join('\n\n') : ''
}

// ── Streaming chat ───────────────────────────────────────

export async function streamChatMessage(
  userMessage: string,
  history: ChatMessage[],
  records: TrainingRecord[],
  techniques: TechniqueNote[],
  onChunk: (text: string) => void,
  sportName = '运动',
  signal?: AbortSignal,
): Promise<void> {
  const config = getAIConfig()
  const opts: CallOptions = {
    max_tokens: 1024,
    stream: true,
    signal,
    system: buildSystemPrompt(sportName) + buildContext(records, techniques),
    messages: [
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ],
  }

  const request = await doFetch(config, opts)
  try {
    if (!request.response.ok) {
      const data: unknown = await request.response.json().catch(() => undefined)
      throw new AIError(
        'http',
        extractAPIErrorMessage(data) ?? `API 错误 ${request.response.status}`,
        { status: request.response.status },
      )
    }

    const reader = request.response.body?.getReader()
    if (!reader) throw new AIError('response_format', '当前 API 不支持流式输出')

    const decoder = new TextDecoder()
    let buffer = ''
    let receivedText = false
    const anthropic = isAnthropicFormat(config)

    const processLine = (line: string): boolean => {
      const normalized = line.trim()
      if (!normalized.startsWith('data:')) return false
      const data = normalized.slice(5).trim()
      if (!data) return false
      if (data === '[DONE]') {
        if (!receivedText) throw new AIError('empty_response', 'AI 没有返回内容，请重试')
        return true
      }

      let json: unknown
      try {
        json = JSON.parse(data)
      } catch (error) {
        throw new AIError('response_format', 'AI 流式返回包含无效 JSON', { cause: error })
      }
      const text = extractStreamText(json, anthropic)
      if (text) {
        receivedText = true
        onChunk(text)
      }
      return false
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (processLine(line)) return
      }
    }

    buffer += decoder.decode()
    if (buffer && processLine(buffer)) return
    if (!receivedText) throw new AIError('empty_response', 'AI 没有返回内容，请重试')
  } catch (error) {
    if (isAIError(error)) throw error
    if (request.didTimeout()) {
      throw new AIError('timeout', 'AI 请求超时，请稍后重试', { cause: error })
    }
    if (signal?.aborted || (error as Error).name === 'AbortError') {
      throw new AIError('cancelled', 'AI 请求已取消', { cause: error })
    }
    throw new AIError('network', 'AI 流式连接中断，请重试', { cause: error })
  } finally {
    request.cleanup()
  }
}

// ── Legacy non-streaming (kept for compatibility) ────────

export async function sendChatMessage(
  userMessage: string,
  history: ChatMessage[],
  records: TrainingRecord[],
): Promise<string> {
  const config = getAIConfig()
  return callAPI(config, {
    max_tokens: 1024,
    system: buildSystemPrompt('运动') + buildContext(records, []),
    messages: [
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ],
  })
}

// Legacy chat history helpers (kept for any remaining references)
export function getChatHistory(): ChatMessage[] { return [] }
export function saveChatHistory(messages: ChatMessage[]): void { void messages /* migrated to conversations */ }
export function clearChatHistory(): void { localStorage.removeItem(LEGACY_CHAT_KEY) }
