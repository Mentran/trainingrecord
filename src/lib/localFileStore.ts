import type { Conversation } from './ai'
import { STORAGE_KEYS } from './storageKeys'
import type { Sport, TechniqueNote, TrainingRecord } from '../types'

export interface LocalFileData {
  version: 1
  savedAt: string
  records: TrainingRecord[]
  techniques: TechniqueNote[]
  sports: Sport[]
  conversations: Conversation[]
  activeSportId?: string
  activeConversationId?: string
}

export interface LocalFileStoreStatus {
  available: boolean
  loadedFromFile: boolean
  path?: string
  backupsPath?: string
  lastSavedAt?: string
  error?: string
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
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    records: readJson<TrainingRecord[]>(STORAGE_KEYS.records, []),
    techniques: readJson<TechniqueNote[]>(STORAGE_KEYS.techniques, []),
    sports: readJson<Sport[]>(STORAGE_KEYS.sports, []),
    conversations: readJson<Conversation[]>(STORAGE_KEYS.conversations, []),
    activeSportId: localStorage.getItem(STORAGE_KEYS.activeSport) ?? undefined,
    activeConversationId: localStorage.getItem(STORAGE_KEYS.activeConversation) ?? undefined,
  }
}

function applyFileData(data: LocalFileData): void {
  hydrating = true
  try {
    localStorage.setItem(STORAGE_KEYS.records, JSON.stringify(data.records ?? []))
    localStorage.setItem(STORAGE_KEYS.techniques, JSON.stringify(data.techniques ?? []))
    localStorage.setItem(STORAGE_KEYS.sports, JSON.stringify(data.sports ?? []))
    localStorage.setItem(STORAGE_KEYS.conversations, JSON.stringify(data.conversations ?? []))

    if (data.activeSportId) localStorage.setItem(STORAGE_KEYS.activeSport, data.activeSportId)
    else localStorage.removeItem(STORAGE_KEYS.activeSport)

    if (data.activeConversationId) localStorage.setItem(STORAGE_KEYS.activeConversation, data.activeConversationId)
    else localStorage.removeItem(STORAGE_KEYS.activeConversation)
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
    const res = await fetch('/api/local-store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collectLocalData()),
    })
    if (!res.ok) throw new Error(`本地文件写入失败：${res.status}`)
    const next = await res.json() as { savedAt?: string; path?: string; backupsPath?: string }
    status = {
      ...status,
      available: true,
      path: next.path ?? status.path,
      backupsPath: next.backupsPath ?? status.backupsPath,
      lastSavedAt: next.savedAt ?? new Date().toISOString(),
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
  try {
    const res = await fetch('/api/local-store', { cache: 'no-store' })
    if (!res.ok) throw new Error(`本地文件服务不可用：${res.status}`)
    const payload = await res.json() as {
      exists: boolean
      data?: LocalFileData
      path: string
      backupsPath: string
    }

    available = true
    initialized = true
    status = {
      available: true,
      loadedFromFile: payload.exists,
      path: payload.path,
      backupsPath: payload.backupsPath,
      lastSavedAt: payload.data?.savedAt,
    }

    if (payload.exists && payload.data) applyFileData(payload.data)

    return status
  } catch (error) {
    initialized = true
    available = false
    status = {
      available: false,
      loadedFromFile: false,
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
  if (!available) throw new Error(status.error ?? '本地文件服务不可用')
  if (syncTimer !== null) {
    window.clearTimeout(syncTimer)
    syncTimer = null
  }
  await writeLocalFileNow()
  return status
}

export function scheduleLocalFileSync(): void {
  if (!initialized || !available || hydrating) return
  if (syncTimer !== null) window.clearTimeout(syncTimer)
  syncTimer = window.setTimeout(() => {
    syncTimer = null
    void writeLocalFileNow()
  }, 250)
}
