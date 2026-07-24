// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveRecord } from '../lib/storage'
import { STORAGE_KEYS } from '../lib/storageKeys'
import { installMemoryStorage } from '../test/memoryStorage'
import { useRecords } from './useLocalData'

let root: Root | null = null
let container: HTMLDivElement | null = null

function RecordCount() {
  const records = useRecords('tennis')
  return <span>{records.length}</span>
}

function record(id: string) {
  const timestamp = '2026-07-24T00:00:00.000Z'
  return {
    id,
    sportId: 'tennis',
    date: '2026-07-24',
    duration: 60,
    coach: '',
    content: '正手训练',
    contentOriginal: '正手训练',
    reflection: '',
    reflectionOriginal: '',
    polishStatus: 'none' as const,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

describe('useLocalData', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    installMemoryStorage()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root?.unmount())
    container?.remove()
    root = null
    container = null
  })

  it('同一页面写入记录后自动刷新订阅组件', () => {
    act(() => root?.render(<RecordCount />))
    expect(container?.textContent).toBe('0')

    act(() => {
      saveRecord({
        sportId: 'tennis',
        date: '2026-07-24',
        duration: 60,
        coach: '',
        content: '正手训练',
        contentOriginal: '正手训练',
        reflection: '',
        reflectionOriginal: '',
        polishStatus: 'none',
      })
    })

    expect(container?.textContent).toBe('1')
  })

  it('其他标签页触发 storage 事件后刷新订阅组件', () => {
    act(() => root?.render(<RecordCount />))

    localStorage.setItem(STORAGE_KEYS.records, JSON.stringify([record('external')]))
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.records }))
    })

    expect(container?.textContent).toBe('1')
  })
})
