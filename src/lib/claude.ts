const KEY = 'claude_api_key'

export function getApiKey(): string {
  return localStorage.getItem(KEY) ?? ''
}

export function setApiKey(key: string): void {
  if (key.trim()) {
    localStorage.setItem(KEY, key.trim())
  } else {
    localStorage.removeItem(KEY)
  }
}

export async function polishText(
  content: string,
  reflection: string,
  apiKey: string
): Promise<{ content: string; reflection: string }> {
  const prompt = `你是一个运动训练日记润色助手。请对以下训练记录进行润色，让文字更流畅、生动，保留原意和所有具体细节，不要添加不存在的内容。

训练内容：
${content}

${reflection ? `感悟：\n${reflection}` : ''}

请按以下 JSON 格式返回，不要有其他内容：
{"content":"润色后的训练内容","reflection":"润色后的感悟"}`

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
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `API 错误 ${res.status}`)
  }

  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  const text = data.content.find(b => b.type === 'text')?.text ?? ''
  try {
    const parsed = JSON.parse(text) as { content: string; reflection: string }
    return parsed
  } catch {
    throw new Error('AI 返回格式异常，请重试')
  }
}
