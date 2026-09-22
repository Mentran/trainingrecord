import { describe, expect, it } from 'vitest'
import { applyAiProxy as applyAiProxyPlan } from './aiProxyShared'
import {
  AI_PROXY_PATH,
  AI_TARGET_HEADER,
  describeAiNetworkError,
  isAllowedAiTarget,
  isAiProxyEnabled,
} from './aiProxy'

describe('AI proxy helpers', () => {
  it('测试环境不启用浏览器代理，避免改写直连请求', () => {
    expect(isAiProxyEnabled()).toBe(false)
  })

  it('只允许 https 和本机 http 作为转发目标', () => {
    expect(isAllowedAiTarget('https://www.packyapi.ai/v1/chat/completions')).toBe(true)
    expect(isAllowedAiTarget('http://127.0.0.1:11434/v1/chat/completions')).toBe(true)
    expect(isAllowedAiTarget('http://evil.example/v1/chat/completions')).toBe(false)
    expect(isAllowedAiTarget('javascript:alert(1)')).toBe(false)
  })

  it('启用时代理到同源路径并带上目标地址', () => {
    expect(applyAiProxyPlan('https://www.packyapi.ai/v1/chat/completions', {
      Authorization: 'Bearer test',
    }, true)).toEqual({
      url: AI_PROXY_PATH,
      headers: {
        Authorization: 'Bearer test',
        [AI_TARGET_HEADER]: 'https://www.packyapi.ai/v1/chat/completions',
      },
    })
  })

  it('为 PackyAPI 给出可执行的跨域说明', () => {
    expect(describeAiNetworkError('https://www.packyapi.ai/v1/chat/completions'))
      .toMatch(/npm run dev/)
  })
})
