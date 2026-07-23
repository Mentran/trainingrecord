import { describe, expect, it } from 'vitest'
import { localFileReadResponseSchema, parseLocalFileData } from './localFileSchema'

const savedAt = '2026-07-23T00:00:00.000Z'

function validData() {
  return {
    version: 2,
    savedAt,
    records: [{
      id: 'record-1',
      sportId: 'tennis',
      date: '2026-07-23',
      duration: 60,
      coach: '',
      content: '练习正手',
      contentOriginal: '练习正手',
      reflection: '',
      reflectionOriginal: '',
      createdAt: savedAt,
      updatedAt: savedAt,
    }],
    techniques: [],
    sports: [],
    conversations: [],
    activeConversationIds: {},
  }
}

describe('local file schema', () => {
  it('兼容版本 1，并迁移缺少 sportId 的旧记录', () => {
    const data = validData()
    const parsed = parseLocalFileData({
      ...data,
      version: 1,
      records: [{ ...data.records[0], sportId: undefined }],
    })
    expect(parsed.version).toBe(1)
    expect(parsed.records[0].sportId).toBe('tennis')
  })

  it('拒绝错误字段，但保留历史孤儿引用避免整库不可读', () => {
    const data = validData()
    expect(() => parseLocalFileData({
      ...data,
      records: [{ ...data.records[0], duration: '60' }],
    })).toThrow(/duration/)
    const parsed = parseLocalFileData({
      ...data,
      records: [{ ...data.records[0], sportId: 'missing' }],
    })
    expect(parsed.records[0].sportId).toBe('missing')
  })

  it('文件存在时响应必须包含已校验数据', () => {
    expect(() => localFileReadResponseSchema.parse({
      exists: true,
      path: '/data/app-data.json',
      backupsPath: '/data/backups',
    })).toThrow(/文件存在但缺少数据/)
  })
})
