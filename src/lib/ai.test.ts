// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installMemoryStorage } from '../test/memoryStorage'
import { polishText, setAIConfig, streamChatMessage } from './ai'

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('AI transport', () => {
  beforeEach(() => {
    installMemoryStorage()
    setAIConfig({
      apiUrl: 'https://example.test',
      apiKey: 'test-key',
      model: 'test-model',
      format: 'openai',
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('校验代码围栏中的结构化润色结果', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      choices: [{
        message: {
          content: '```json\n{"content":"动作更完整","reflection":"保持放松"}\n```',
        },
      }],
    })))

    await expect(polishText('原内容', '原感悟')).resolves.toEqual({
      content: '动作更完整',
      reflection: '保持放松',
    })
  })

  it('兼容 Anthropic 响应格式', async () => {
    setAIConfig({ format: 'anthropic', apiUrl: 'https://api.anthropic.test' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      content: [{
        type: 'text',
        text: '{"content":"动作连贯","reflection":""}',
      }],
    })))

    await expect(polishText('原内容', '')).resolves.toEqual({
      content: '动作连贯',
      reflection: '',
    })
  })

  it('格式错误时返回可区分的错误且不接受坏数据', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      choices: [{ message: { content: '{"content":null,"reflection":[]}' } }],
    })))

    await expect(polishText('原内容', '原感悟')).rejects.toMatchObject({
      code: 'response_format',
    })
  })

  it('保留 API 返回的 HTTP 错误信息', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      error: { message: '模型不可用' },
    }, 503)))

    await expect(polishText('原内容', '')).rejects.toMatchObject({
      code: 'http',
      status: 503,
      message: '模型不可用',
    })
  })

  it('读取没有换行结尾的最后一个流式片段', async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"尾片段"}}]}'))
        controller.close()
      },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })))
    let output = ''

    await streamChatMessage('问题', [], [], [], chunk => {
      output += chunk
    })

    expect(output).toBe('尾片段')
  })

  it('不再忽略损坏的流式 JSON', async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {invalid}\n'))
        controller.close()
      },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })))

    await expect(streamChatMessage('问题', [], [], [], () => {})).rejects.toMatchObject({
      code: 'response_format',
    })
  })

  it('外部取消保持 AbortError 语义', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init?: RequestInit) => (
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'))
        }, { once: true })
      })
    )))
    const controller = new AbortController()
    const request = streamChatMessage('问题', [], [], [], () => {}, '网球', controller.signal)
    const assertion = expect(request).rejects.toMatchObject({
      code: 'cancelled',
      name: 'AbortError',
    })
    controller.abort()
    await assertion
  })

  it('请求超过时限后返回 timeout 错误', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init?: RequestInit) => (
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'))
        }, { once: true })
      })
    )))

    const request = polishText('原内容', '')
    const assertion = expect(request).rejects.toMatchObject({ code: 'timeout' })
    await vi.advanceTimersByTimeAsync(45_000)
    await assertion
  })
})
