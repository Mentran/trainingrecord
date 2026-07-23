import { describe, expect, it } from 'vitest'
import { parseBackupJson } from './backupSchema'

const legacyRecord = {
  id: 'record-1',
  date: '2026-07-10',
  duration: 60,
  coach: '教练',
  content: '练习正手',
  reflection: '',
}

describe('parseBackupJson', () => {
  it('迁移旧格式记录并补齐关键字段', () => {
    const parsed = parseBackupJson(JSON.stringify([legacyRecord]))
    expect(parsed.legacy).toBe(true)
    expect(parsed.records?.[0]).toMatchObject({
      sportId: 'tennis',
      contentOriginal: '练习正手',
      reflectionOriginal: '',
    })
  })

  it('拒绝字段类型错误的备份', () => {
    const invalid = [{ ...legacyRecord, duration: '60' }]
    expect(() => parseBackupJson(JSON.stringify(invalid))).toThrow(/duration/)
  })

  it('拒绝重复 ID', () => {
    expect(() => parseBackupJson(JSON.stringify([legacyRecord, legacyRecord]))).toThrow(/重复 ID/)
  })

  it('拒绝引用不存在运动的实体', () => {
    const backup = {
      version: 2,
      exportedAt: '2026-07-10T00:00:00.000Z',
      sports: [{
        id: 'tennis', name: '网球', icon: '🎾', color: '#111111', accentColor: '#99CC00',
        categories: [], createdAt: '2026-01-01T00:00:00.000Z',
      }],
      records: [{ ...legacyRecord, sportId: 'running' }],
    }
    expect(() => parseBackupJson(JSON.stringify(backup))).toThrow(/不存在的运动项目/)
  })
})
