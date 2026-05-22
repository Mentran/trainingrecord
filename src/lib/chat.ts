import type { TrainingRecord } from '../types'

const CHAT_KEY = 'sport_chat_history'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export function getChatHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_KEY)
    return raw ? (JSON.parse(raw) as ChatMessage[]) : []
  } catch {
    return []
  }
}

export function saveChatHistory(messages: ChatMessage[]): void {
  localStorage.setItem(CHAT_KEY, JSON.stringify(messages))
}

export function clearChatHistory(): void {
  localStorage.removeItem(CHAT_KEY)
}

function buildContext(records: TrainingRecord[]): string {
  if (records.length === 0) return ''
  const recent = records.slice(0, 5)
  const lines = recent.map(r => {
    const parts = [r.date]
    if (r.coach) parts.push(`教练${r.coach}`)
    if (r.duration) parts.push(`${r.duration}分钟`)
    return `- ${parts.join('，')}：${r.content.slice(0, 80)}`
  })
  return `\n\n用户最近的训练记录（供参考）：\n${lines.join('\n')}`
}

const SYSTEM_PROMPT = `你是一位专业的运动顾问，只回答与运动、健身、训练相关的问题。

你的专长包括：运动技术指导、训练计划建议、运动损伤预防与恢复、体能训练、运动营养等。

如果用户提问与运动无关，请礼貌地说明你只能回答运动相关问题，并引导用户提问运动话题。

回答要简洁实用，结合用户的实际训练情况给出个性化建议。`

export async function sendChatMessage(
  userMessage: string,
  history: ChatMessage[],
  records: TrainingRecord[],
  apiKey: string
): Promise<string> {
  const systemWithContext = SYSTEM_PROMPT + buildContext(records)

  const messages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: userMessage },
  ]

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemWithContext,
      messages,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `API 错误 ${res.status}`)
  }

  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  return data.content.find(b => b.type === 'text')?.text ?? ''
}
