// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from './storageKeys'
import { installMemoryStorage } from '../test/memoryStorage'
import {
  DEFAULT_EXPORT_OPTIONS,
  DEFAULT_SPORT,
  deleteSport,
  getRecords,
  getTechniques,
  hasImportRestorePoint,
  importBackup,
  mergeTechniques,
  restoreLastImport,
  saveRecord,
  updateRecord,
} from './storage'

const now = '2026-07-10T00:00:00.000Z'
const running = {
  id: 'running', name: '跑步', icon: '🏃', color: '#222222', accentColor: '#EE5555',
  categories: ['配速'], createdAt: now,
}
const record = (id: string, sportId = 'tennis') => ({
  id, sportId, date: '2026-07-10', duration: 60, coach: '', content: id,
  contentOriginal: id, reflection: '', reflectionOriginal: '', createdAt: now, updatedAt: now,
})

function backup(data: Record<string, unknown>): string {
  return JSON.stringify({ version: 2, exportedAt: now, ...data })
}

describe('storage import and sport isolation', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    installMemoryStorage()
  })

  it('合并导入时保留不同 ID，并以备份覆盖同 ID', () => {
    localStorage.setItem(STORAGE_KEYS.records, JSON.stringify([record('old'), record('same')]))
    importBackup(backup({ records: [record('same'), record('new')] }), {
      ...DEFAULT_EXPORT_OPTIONS,
      techniques: false,
      sports: false,
      conversations: false,
    }, 'merge')
    expect(getRecords().map(item => item.id)).toEqual(['old', 'same', 'new'])
    expect(hasImportRestorePoint()).toBe(true)
  })

  it('导入完成后可恢复到导入前状态', () => {
    localStorage.setItem(STORAGE_KEYS.records, JSON.stringify([record('before')]))
    importBackup(backup({ records: [record('after')] }), {
      records: true, techniques: false, sports: false, conversations: false,
    })
    restoreLastImport()
    expect(getRecords().map(item => item.id)).toEqual(['before'])
  })

  it('写入中途失败时回滚已修改的数据', () => {
    localStorage.setItem(STORAGE_KEYS.records, JSON.stringify([record('before')]))
    localStorage.setItem(STORAGE_KEYS.techniques, JSON.stringify([]))
    const original = localStorage.setItem.bind(localStorage)
    let failed = false
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === STORAGE_KEYS.techniques && !failed) {
        failed = true
        throw new DOMException('quota', 'QuotaExceededError')
      }
      return original(key, value)
    })

    expect(() => importBackup(backup({
      records: [record('after')],
      techniques: [{
        id: 'note-1', sportId: 'tennis', title: '技巧', content: '内容', source: 'user',
        votes: 0, createdAt: now, updatedAt: now,
      }],
    }), { records: true, techniques: true, sports: false, conversations: false })).toThrow(/原数据已恢复/)
    expect(getRecords().map(item => item.id)).toEqual(['before'])
  })

  it('删除运动时级联清理记录、技巧、会话和活动会话', () => {
    localStorage.setItem(STORAGE_KEYS.sports, JSON.stringify([DEFAULT_SPORT, running]))
    localStorage.setItem(STORAGE_KEYS.records, JSON.stringify([record('tennis'), record('run', 'running')]))
    localStorage.setItem(STORAGE_KEYS.techniques, JSON.stringify([
      { id: 'note', sportId: 'running', title: '配速', content: '', source: 'user', votes: 0, createdAt: now, updatedAt: now },
    ]))
    localStorage.setItem(STORAGE_KEYS.conversations, JSON.stringify([
      { id: 'conv', sportId: 'running', title: '跑步', messages: [], createdAt: now, updatedAt: now },
    ]))
    localStorage.setItem(`${STORAGE_KEYS.activeConversation}:running`, 'conv')

    deleteSport('running')

    expect(getRecords().map(item => item.id)).toEqual(['tennis'])
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.techniques) ?? '[]')).toEqual([])
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.conversations) ?? '[]')).toEqual([])
    expect(localStorage.getItem(`${STORAGE_KEYS.activeConversation}:running`)).toBeNull()
  })

  it('保存关注点并允许训练后补充结果', () => {
    const saved = saveRecord({
      sportId: 'tennis',
      date: '2026-07-10',
      duration: 60,
      coach: '',
      content: '练习正手',
      contentOriginal: '练习正手',
      reflection: '',
      reflectionOriginal: '',
      focus: {
        cardId: 'forehand-ready-turn-15',
        text: '有没有提前转肩？',
      },
      polishStatus: 'none',
    })

    const updated = updateRecord(saved.id, {
      focus: { ...saved.focus!, outcome: 'improved', note: '多数球可以提前准备' },
    })

    expect(updated?.focus).toMatchObject({
      outcome: 'improved',
      note: '多数球可以提前准备',
    })
    expect(getRecords('tennis')[0].focus).toEqual(updated?.focus)
  })

  it('一次写入完成技巧合并并保留正文、标签和点赞', () => {
    localStorage.setItem(STORAGE_KEYS.techniques, JSON.stringify([
      {
        id: 'keep', sportId: 'tennis', title: '转身带动', content: '用身体带动手臂。',
        category: '正手', tags: ['转身'], source: 'user', votes: 2, createdAt: now, updatedAt: now,
      },
      {
        id: 'remove', sportId: 'tennis', title: '转身带动挥拍', content: '先转髋，再转肩。',
        category: '正手', tags: ['动力链'], source: 'ai', votes: 1, createdAt: now, updatedAt: now,
      },
      {
        id: 'other', sportId: 'tennis', title: '抛球', content: '保持稳定。',
        category: '发球', tags: [], source: 'user', votes: 0, createdAt: now, updatedAt: now,
      },
    ]))

    const merged = mergeTechniques({
      keepId: 'keep',
      removeIds: ['remove'],
      title: '转身带动',
      content: '用身体带动手臂。\n\n补充：先转髋，再转肩。',
      category: '正手',
      tags: ['转身', '动力链'],
      votes: 3,
    })

    expect(merged).toMatchObject({
      id: 'keep',
      title: '转身带动',
      category: '正手',
      tags: ['转身', '动力链'],
      votes: 3,
    })
    expect(merged?.content).toContain('用身体带动手臂。')
    expect(merged?.content).toContain('先转髋，再转肩。')
    expect(getTechniques().map(item => item.id)).toEqual(['keep', 'other'])
  })
})
