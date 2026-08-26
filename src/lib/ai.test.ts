// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installMemoryStorage } from '../test/memoryStorage'
import { generateTechniques, polishText, setAIConfig, streamChatMessage } from './ai'

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

  it('生成技巧时参考已有内容并过滤同名重复', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      choices: [{
        message: {
          content: JSON.stringify([
            {
              title: '挥拍顺序',
              content: '重复内容',
              category: '正手',
              tags: ['挥拍'],
            },
            {
              title: '击球前减速',
              content: '问题：跑过头；动作：小步减速；练习：喂球10次；标准：击球时身体平衡。',
              category: '步伐',
              tags: ['减速', '平衡'],
            },
          ]),
        },
      }],
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateTechniques([{
      id: 'record-1',
      sportId: 'tennis',
      date: '2026-07-26',
      duration: 60,
      coach: '',
      content: '跑动击球时经常冲过头',
      contentOriginal: '跑动击球时经常冲过头',
      reflection: '',
      reflectionOriginal: '',
      polishStatus: 'none',
      createdAt: '2026-07-26T00:00:00.000Z',
      updatedAt: '2026-07-26T00:00:00.000Z',
    }], '网球', ['正手', '步伐'], [{
      title: '挥拍顺序',
      category: '正手',
    }])

    expect(result).toEqual([{
      title: '击球前减速',
      content: '问题：跑过头；动作：小步减速；练习：喂球10次；标准：击球时身体平衡。',
      category: '步伐',
      tags: ['减速', '平衡'],
    }])
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
    expect(requestBody.messages[0].content).toContain('[正手] 挥拍顺序')
    expect(requestBody.messages[0].content).toContain('问题：…；动作：…；练习：…；标准：…')
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

  it('DeepSeek 思考片段后仍能读到正文', async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"reasoning_content":"思考"}}]}\n'))
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"建议转腰"}}]}\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n'))
        controller.close()
      },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })))
    let output = ''

    await streamChatMessage('问题', [], [], [], chunk => {
      output += chunk
    })

    expect(output).toBe('建议转腰')
  })

  it('对忽略 stream 的接口回退解析完整 JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      choices: [{ message: { content: '完整回复' } }],
    })))
    let output = ''

    await streamChatMessage('问题', [], [], [], chunk => {
      output += chunk
    })

    expect(output).toBe('完整回复')
  })

  it('官方 DeepSeek 关闭思考模式以免占满输出额度', async () => {
    setAIConfig({
      apiUrl: 'https://api.deepseek.com',
      apiKey: 'test-key',
      model: 'deepseek-v4-flash',
      format: 'openai',
    })
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      choices: [{
        message: { content: '{"content":"动作更完整","reflection":""}' },
      }],
    }))
    vi.stubGlobal('fetch', fetchMock)

    await polishText('原内容', '')

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.deepseek.com/v1/chat/completions')
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
    expect(requestBody.thinking).toEqual({ type: 'disabled' })
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
