// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from './storageKeys'
import { installMemoryStorage } from '../test/memoryStorage'

const filePayload = (savedAt: string, content: string) => ({
  exists: true,
  path: '/project/data/app-data.json',
  backupsPath: '/project/data/backups',
  data: {
    version: 2,
    savedAt,
    records: [{
      id: 'file', sportId: 'tennis', date: '2026-07-10', duration: 60, coach: '', content,
      contentOriginal: content, reflection: '', reflectionOriginal: '', createdAt: savedAt, updatedAt: savedAt,
    }],
    techniques: [], sports: [], conversations: [], activeConversationIds: {},
  },
})

describe('local file conflict resolution', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    installMemoryStorage()
  })

  it('浏览器数据较新时不被旧文件覆盖', async () => {
    localStorage.setItem(STORAGE_KEYS.records, JSON.stringify([{ id: 'browser' }]))
    localStorage.setItem(STORAGE_KEYS.localUpdatedAt, '2026-07-10T12:00:00.000Z')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(
      filePayload('2026-07-10T10:00:00.000Z', '旧文件')
    ), { status: 200, headers: { 'Content-Type': 'application/json' } })))

    const { initializeLocalFileStore } = await import('./localFileStore')
    const status = await initializeLocalFileStore()

    expect(status.source).toBe('browser')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.records) ?? '[]')[0].id).toBe('browser')
  })

  it('文件数据较新时恢复文件内容', async () => {
    localStorage.setItem(STORAGE_KEYS.records, JSON.stringify([{ id: 'browser' }]))
    localStorage.setItem(STORAGE_KEYS.localUpdatedAt, '2026-07-10T09:00:00.000Z')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(
      filePayload('2026-07-10T10:00:00.000Z', '新文件')
    ), { status: 200, headers: { 'Content-Type': 'application/json' } })))

    const { initializeLocalFileStore } = await import('./localFileStore')
    const status = await initializeLocalFileStore()

    expect(status.source).toBe('file')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.records) ?? '[]')[0].content).toBe('新文件')
  })

  it('服务端返回损坏数据时保留浏览器缓存', async () => {
    localStorage.setItem(STORAGE_KEYS.records, JSON.stringify([{ id: 'browser' }]))
    const payload = filePayload('2026-07-10T10:00:00.000Z', '损坏文件')
    payload.data.records[0].duration = '60' as unknown as number
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })))

    const { initializeLocalFileStore } = await import('./localFileStore')
    const status = await initializeLocalFileStore()

    expect(status.available).toBe(false)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.records) ?? '[]')[0].id).toBe('browser')
  })
})
