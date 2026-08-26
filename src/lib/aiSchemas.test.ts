import { describe, expect, it } from 'vitest'
import {
  extractProviderText,
  extractStreamText,
  generatedTechniquesSchema,
  parseAIJson,
  polishResultSchema,
  sportCategoriesSchema,
  stripJsonCodeFence,
} from './aiSchemas'

describe('AI schemas', () => {
  it('统一移除 JSON 代码围栏并校验润色返回', () => {
    const text = '```json\n{"content":"润色内容","reflection":"训练感悟"}\n```'
    expect(stripJsonCodeFence(text)).toBe('{"content":"润色内容","reflection":"训练感悟"}')
    expect(parseAIJson(text, polishResultSchema, '润色返回')).toEqual({
      content: '润色内容',
      reflection: '训练感悟',
    })
  })

  it('拒绝字段为空或类型错误的结构化返回', () => {
    expect(() => parseAIJson('{"content":null}', polishResultSchema, '润色返回'))
      .toThrow(/content/)
    expect(() => parseAIJson('["正手", 1]', sportCategoriesSchema, '分类返回'))
      .toThrow(/1/)
    expect(() => parseAIJson('[]', generatedTechniquesSchema, '技巧返回'))
      .toThrow(/根节点/)
  })

  it('识别 Anthropic、OpenAI 和代理服务文本格式', () => {
    expect(extractProviderText({
      content: [{ type: 'text', text: 'Anthropic 内容' }],
    })).toBe('Anthropic 内容')
    expect(extractProviderText({
      choices: [{ message: { content: 'OpenAI 内容' } }],
    })).toBe('OpenAI 内容')
    expect(extractProviderText({ output: '代理内容' })).toBe('代理内容')
  })

  it('识别 OpenAI 分段文本内容', () => {
    expect(extractProviderText({
      choices: [{
        message: {
          content: [{ type: 'text', text: '分段' }, { type: 'text', text: '内容' }],
        },
      }],
    })).toBe('分段内容')
  })

  it('OpenAI 兼容接口正文为空时不再误报格式无法识别', () => {
    expect(() => extractProviderText({
      choices: [{
        message: { content: null, reasoning_content: '思考过程' },
        finish_reason: 'length',
      }],
    })).toThrow(/没有返回正文/)
  })

  it('识别流式文本和流内错误', () => {
    expect(extractStreamText({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: '片段' },
    }, true)).toBe('片段')
    expect(extractStreamText({
      choices: [{ delta: { content: '片段' } }],
    }, false)).toBe('片段')
    expect(extractStreamText({
      choices: [{ delta: { reasoning_content: '思考' } }],
    }, false)).toBe('')
    expect(extractStreamText({
      choices: [{ finish_reason: 'stop' }],
    }, false)).toBe('')
    expect(extractStreamText({
      choices: [{ message: { content: '完整回复' }, finish_reason: 'stop' }],
    }, false)).toBe('完整回复')
    expect(() => extractStreamText({
      type: 'error',
      error: { message: '额度不足' },
    }, true)).toThrow(/额度不足/)
  })
})
