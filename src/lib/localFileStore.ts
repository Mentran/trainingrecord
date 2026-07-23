import type { Conversation } from './ai'
import { localFileReadResponseSchema, localFileWriteResponseSchema } from './localFileSchema'
import type { LocalFileData } from './localFileSchema'
import { STORAGE_KEYS } from './storageKeys'
import type { Sport, TechniqueNote, TrainingRecord } from '../types'

export type { LocalFileData } from './localFileSchema'

export interface LocalFileStoreStatus {
  available: boolean
  loadedFromFile: boolean
  message: string
  path?: string
  backupsPath?: string
  lastSavedAt?: string
  error?: string
  source?: 'browser' | 'file'
}

let initialized = false
let available = false
let hydrating = false
let syncTimer: number | null = null
let syncInFlight = false
let syncQueued = false

let status: LocalFileStoreStatus = {
  available: false,
  loadedFromFile: false,
  message: '数据保存在当前浏览器',
}

const LOCAL_FILE_STORE_ENABLED = import.meta.env.DEV
const LOCAL_FILE_TIMEOUT_MS = 3000

function activeConversationKey(sportId: string): string {
  return `${STORAGE_KEYS.activeConversation}:${sportId}`
}

function browserHasCoreData(): boolean {
  return [STORAGE_KEYS.records, STORAGE_KEYS.techniques, STORAGE_KEYS.sports, STORAGE_KEYS.conversations]
    .some(key => localStorage.getItem(key) !== null)
}

function markLocalDataChanged(): string {
  const now = new Date().toISOString()
  localStorage.setItem(STORAGE_KEYS.localUpdatedAt, now)
  return now
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), LOCAL_FILE_TIMEOUT_MS)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new Error(`本地文件服务 ${LOCAL_FILE_TIMEOUT_MS / 1000} 秒内未响应`, { cause: error })
    }
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function collectLocalData(): LocalFileData {
  const sports = readJson<Sport[]>(STORAGE_KEYS.sports, [])
  const sportIds = ['tennis', ...sports.map(sport => sport.id)]
  const activeConversationIds = Object.fromEntries(
    sportIds
      .map(sportId => [sportId, localStorage.getItem(activeConversationKey(sportId))] as const)
      .filter((entry): entry is readonly [string, string] => entry[1] !== null)
  )
  return {
    version: 2,
    savedAt: localStorage.getItem(STORAGE_KEYS.localUpdatedAt) ?? new Date().toISOString(),
    records: readJson<TrainingRecord[]>(STORAGE_KEYS.records, []),
    techniques: readJson<TechniqueNote[]>(STORAGE_KEYS.techniques, []),
    sports,
    conversations: readJson<Conversation[]>(STORAGE_KEYS.conversations, []),
    activeSportId: localStorage.getItem(STORAGE_KEYS.activeSport) ?? undefined,
    activeConversationId: localStorage.getItem(STORAGE_KEYS.activeConversation) ?? undefined,
    activeConversationIds,
  }
}

function applyFileData(data: LocalFileData): void {
  hydrating = true
  try {
    localStorage.setItem(STORAGE_KEYS.records, JSON.stringify(data.records ?? []))
    localStorage.setItem(STORAGE_KEYS.techniques, JSON.stringify(data.techniques ?? []))
    localStorage.setItem(STORAGE_KEYS.sports, JSON.stringify(data.sports ?? []))
    localStorage.setItem(STORAGE_KEYS.conversations, JSON.stringify(data.conversations ?? []))
    localStorage.setItem(STORAGE_KEYS.localUpdatedAt, data.savedAt)

    if (data.activeSportId) localStorage.setItem(STORAGE_KEYS.activeSport, data.activeSportId)
    else localStorage.removeItem(STORAGE_KEYS.activeSport)

    if (data.activeConversationId) localStorage.setItem(STORAGE_KEYS.activeConversation, data.activeConversationId)
    else localStorage.removeItem(STORAGE_KEYS.activeConversation)

    const activeIds = data.activeConversationIds ?? (
      data.activeConversationId ? { tennis: data.activeConversationId } : {}
    )
    const sportIds = ['tennis', ...(data.sports ?? []).map(sport => sport.id)]
    for (const sportId of sportIds) {
      const key = activeConversationKey(sportId)
      const activeId = activeIds[sportId]
      if (activeId) localStorage.setItem(key, activeId)
      else localStorage.removeItem(key)
    }
  } finally {
    hydrating = false
  }
}

async function writeLocalFileNow(): Promise<void> {
  if (!available || syncInFlight) {
    syncQueued = syncInFlight
    return
  }

  syncInFlight = true
  try {
    const res = await fetchWithTimeout('/api/local-store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collectLocalData()),
    })
    if (!res.ok) throw new Error(`本地文件写入失败：${res.status}`)
    const next = localFileWriteResponseSchema.parse(await res.json())
    status = {
      ...status,
      available: true,
      path: next.path ?? status.path,
      backupsPath: next.backupsPath ?? status.backupsPath,
      lastSavedAt: next.savedAt,
      error: undefined,
    }
  } catch (error) {
    status = {
      ...status,
      error: (error as Error).message,
    }
  } finally {
    syncInFlight = false
    if (syncQueued) {
      syncQueued = false
      void writeLocalFileNow()
    }
  }
}

export async function initializeLocalFileStore(): Promise<LocalFileStoreStatus> {
  if (!LOCAL_FILE_STORE_ENABLED) {
    initialized = true
    available = false
    status = {
      available: false,
      loadedFromFile: false,
      message: '线上静态站点使用浏览器本地缓存',
    }
    return status
  }

  try {
    const res = await fetchWithTimeout('/api/local-store', { cache: 'no-store' })
    if (!res.ok) throw new Error(`本地文件服务不可用：${res.status}`)
    const payload = localFileReadResponseSchema.parse(await res.json())

    available = true
    initialized = true
    const browserSavedAt = localStorage.getItem(STORAGE_KEYS.localUpdatedAt)
    const fileSavedAt = payload.data?.savedAt
    const browserIsNewer = Boolean(
      payload.exists && payload.data && browserHasCoreData() && browserSavedAt && fileSavedAt
      && Date.parse(browserSavedAt) > Date.parse(fileSavedAt)
    )

    status = {
      available: true,
      loadedFromFile: Boolean(payload.exists && !browserIsNewer),
      message: browserIsNewer
        ? '浏览器数据更新，已保留并等待同步到文件'
        : payload.exists ? '启动时已从文件恢复数据' : '首次新增或修改数据后会创建文件',
      path: payload.path,
      backupsPath: payload.backupsPath,
      lastSavedAt: fileSavedAt,
      source: browserIsNewer ? 'browser' : payload.exists ? 'file' : 'browser',
    }

    if (payload.exists && payload.data && !browserIsNewer) applyFileData(payload.data)
    if (browserIsNewer) scheduleLocalFileSync()

    return status
  } catch (error) {
    initialized = true
    available = false
    status = {
      available: false,
      loadedFromFile: false,
      message: '本地文件服务不可用，已改用浏览器缓存',
      error: (error as Error).message,
    }
    return status
  }
}

export function getLocalFileStoreStatus(): LocalFileStoreStatus {
  return status
}

export async function saveCurrentDataToLocalFile(): Promise<LocalFileStoreStatus> {
  if (!initialized) await initializeLocalFileStore()
  if (!available) throw new Error(status.message)
  markLocalDataChanged()
  if (syncTimer !== null) {
    window.clearTimeout(syncTimer)
    syncTimer = null
  }
  await writeLocalFileNow()
  return status
}

export function scheduleLocalFileSync(): void {
  if (hydrating) return
  markLocalDataChanged()
  if (!initialized || !available) return
  if (syncTimer !== null) window.clearTimeout(syncTimer)
  syncTimer = window.setTimeout(() => {
    syncTimer = null
    void writeLocalFileNow()
  }, 250)
}
