import type { TrainingRecord } from '../types'

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
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AIConfig>) }
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
}

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

async function doFetch(config: AIConfig, opts: CallOptions): Promise<Response> {
  const url = resolveUrl(config)
  if (!config.apiUrl.startsWith('http')) throw new Error('API URL 格式不正确，需以 http:// 或 https:// 开头')
  try {
    return await fetch(url, { method: 'POST', headers: buildHeaders(config), body: JSON.stringify(buildBody(config, opts)) })
  } catch {
    throw new Error(`无法连接到 API（${url}）\n可能原因：\n① 转接服务不支持浏览器直接访问（CORS 限制）\n② URL 填写有误\n③ 网络问题`)
  }
}

// ── Non-streaming call (used by polishText) ──────────────

async function callAPI(config: AIConfig, opts: CallOptions): Promise<string> {
  const res = await doFetch(config, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = (err as { error?: { message?: string } }).error?.message
    throw new Error(msg ?? `API 错误 ${res.status}`)
  }
  const data = await res.json() as Record<string, unknown>
  if (Array.isArray(data.content)) {
    const text = (data.content as Array<{ type: string; text: string }>).find(b => b.type === 'text')?.text
    if (text !== undefined) return text
  }
  if (Array.isArray(data.choices)) {
    const text = (data.choices as Array<{ message: { content: string } }>)[0]?.message?.content
    if (text !== undefined) return text
  }
  throw new Error('API 返回格式无法识别，请检查 API URL 是否正确')
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
  try {
    return JSON.parse(data) as { content: string; reflection: string }
  } catch {
    throw new Error('AI 返回格式异常，请重试')
  }
}

// ── Generate techniques ──────────────────────────────────

export interface GeneratedTechnique {
  title: string
  content: string
  tags: string[]
}

export interface GeneratedTechniqueCache {
  sportId: string
  items: GeneratedTechnique[]
  generatedAt: string
}

export function getGeneratedCache(sportId: string): GeneratedTechniqueCache | null {
  try {
    const raw = localStorage.getItem(GENERATED_CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw) as GeneratedTechniqueCache
    return cache.sportId === sportId ? cache : null
  } catch {
    return null
  }
}

export function setGeneratedCache(sportId: string, items: GeneratedTechnique[]): void {
  const cache: GeneratedTechniqueCache = { sportId, items, generatedAt: new Date().toISOString() }
  localStorage.setItem(GENERATED_CACHE_KEY, JSON.stringify(cache))
}

export async function generateTechniques(
  records: TrainingRecord[],
  sportName: string,
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
- 标签选自训练记录中提到的技术点

训练记录：
${recordSummary}

请严格按以下 JSON 数组格式返回，不要有其他内容：
[{"title":"动作名称","content":"技术要点说明","tags":["标签1","标签2"]}]`

  const data = await callAPI(config, { max_tokens: 1500, messages: [{ role: 'user', content: prompt }] })
  try {
    const cleaned = data.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
    return JSON.parse(cleaned) as GeneratedTechnique[]
  } catch {
    throw new Error('AI 返回格式异常，请重试')
  }
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

  const data = await callAPI(config, { max_tokens: 200, messages: [{ role: 'user', content: prompt }] })
  try {
    const cleaned = data.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
    return JSON.parse(cleaned) as string[]
  } catch {
    throw new Error('AI 返回格式异常，请重试')
  }
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
  try {
    const cleaned = data.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
    return JSON.parse(cleaned) as Array<{ id: string; category: string }>
  } catch {
    throw new Error('AI 返回格式异常，请重试')
  }
}



export async function parseExperienceText(
  text: string,
  sportName: string,
): Promise<GeneratedTechnique[]> {
  const config = getAIConfig()

  const prompt = `你是一位专业的${sportName}教练。用户粘贴了一段训练经验或教练指导文字，请将其整理为若干条独立的技巧条目。

要求：
- 每条针对一个具体动作或技术环节
- 内容简洁实用，80字以内
- 标签选自文字中提到的技术点
- 如果原文已经很简洁，可以直接整理为1-2条

原文：
${text}

请严格按以下 JSON 数组格式返回，不要有其他内容：
[{"title":"动作名称","content":"技术要点说明","tags":["标签1","标签2"]}]`

  const data = await callAPI(config, { max_tokens: 1500, messages: [{ role: 'user', content: prompt }] })
  try {
    const cleaned = data.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
    return JSON.parse(cleaned) as GeneratedTechnique[]
  } catch {
    throw new Error('AI 返回格式异常，请重试')
  }
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
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

const CONVERSATIONS_KEY = 'sport_conversations'
const ACTIVE_CONV_KEY = 'sport_active_conv'
const LEGACY_CHAT_KEY = 'sport_chat_history'

export function getConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_KEY)
    if (raw) return JSON.parse(raw) as Conversation[]
  } catch { /* ignore */ }
  // 迁移旧数据
  try {
    const legacy = localStorage.getItem(LEGACY_CHAT_KEY)
    if (legacy) {
      const msgs = JSON.parse(legacy) as ChatMessage[]
      if (msgs.length > 0) {
        const conv: Conversation = {
          id: `conv-${Date.now()}`,
          title: msgs.find(m => m.role === 'user')?.content.slice(0, 20) ?? '历史对话',
          messages: msgs,
          createdAt: msgs[0].createdAt,
          updatedAt: msgs[msgs.length - 1].createdAt,
        }
        localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify([conv]))
        localStorage.removeItem(LEGACY_CHAT_KEY)
        return [conv]
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
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(list))
}

export function deleteConversation(id: string): void {
  const list = getConversations().filter(c => c.id !== id)
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(list))
}

export function getActiveConvId(): string | null {
  return localStorage.getItem(ACTIVE_CONV_KEY)
}

export function setActiveConvId(id: string): void {
  localStorage.setItem(ACTIVE_CONV_KEY, id)
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

function buildContext(records: TrainingRecord[]): string {
  if (records.length === 0) return ''
  const lines = records.slice(0, 5).map(r => {
    const parts = [r.date]
    if (r.coach) parts.push(`教练${r.coach}`)
    if (r.duration) parts.push(`${r.duration}分钟`)
    return `- ${parts.join('，')}：${r.content.slice(0, 80)}`
  })
  return `\n\n用户最近的训练记录（供参考）：\n${lines.join('\n')}`
}

// ── Streaming chat ───────────────────────────────────────

export async function streamChatMessage(
  userMessage: string,
  history: ChatMessage[],
  records: TrainingRecord[],
  onChunk: (text: string) => void,
  sportName = '运动',
): Promise<void> {
  const config = getAIConfig()
  const opts: CallOptions = {
    max_tokens: 1024,
    stream: true,
    system: buildSystemPrompt(sportName) + buildContext(records),
    messages: [
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ],
  }

  const res = await doFetch(config, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = (err as { error?: { message?: string } }).error?.message
    throw new Error(msg ?? `API 错误 ${res.status}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('不支持流式输出')

  const decoder = new TextDecoder()
  let buffer = ''
  const anthropic = isAnthropicFormat(config)

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') return
      try {
        const json = JSON.parse(data) as Record<string, unknown>
        let text = ''
        if (anthropic) {
          if (json.type === 'content_block_delta') {
            const delta = json.delta as Record<string, unknown>
            if (delta?.type === 'text_delta') text = (delta.text as string) ?? ''
          }
        } else {
          const choices = json.choices as Array<{ delta: { content?: string } }>
          text = choices?.[0]?.delta?.content ?? ''
        }
        if (text) onChunk(text)
      } catch { /* ignore parse errors */ }
    }
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
    system: buildSystemPrompt('运动') + buildContext(records),
    messages: [
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ],
  })
}

// Legacy chat history helpers (kept for any remaining references)
export function getChatHistory(): ChatMessage[] { return [] }
export function saveChatHistory(_messages: ChatMessage[]): void { /* migrated to conversations */ }
export function clearChatHistory(): void { localStorage.removeItem(LEGACY_CHAT_KEY) }
