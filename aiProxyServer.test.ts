import { describe, expect, it } from 'vitest'
import { MAX_AI_PROXY_BYTES, pickForwardHeaders } from './aiProxyServer'

describe('AI proxy server', () => {
  it('只转发调用上游所需的请求头', () => {
    expect(pickForwardHeaders({
      authorization: 'Bearer test-key',
      'content-type': 'application/json',
      'x-ai-target-url': 'https://www.packyapi.ai/v1/chat/completions',
      cookie: 'should-not-forward',
      host: 'localhost:5173',
    })).toEqual({
      authorization: 'Bearer test-key',
      'content-type': 'application/json',
    })
  })

  it('限制代理请求体大小', () => {
    expect(MAX_AI_PROXY_BYTES).toBe(1024 * 1024)
  })
})
