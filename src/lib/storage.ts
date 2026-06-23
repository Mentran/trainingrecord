import type { Conversation } from './ai'
import { scheduleLocalFileSync } from './localFileStore'
import { STORAGE_KEYS } from './storageKeys'
import type { TrainingRecord, Sport, TechniqueNote } from '../types'

const RECORDS_KEY = STORAGE_KEYS.records
const SPORTS_KEY = STORAGE_KEYS.sports
const ACTIVE_SPORT_KEY = STORAGE_KEYS.activeSport
const TECHNIQUES_KEY = STORAGE_KEYS.techniques
const CONVERSATIONS_KEY = STORAGE_KEYS.conversations

export const DEFAULT_SPORT: Sport = {
  id: 'tennis',
  name: '网球',
  icon: '🎾',
  color: '#1A2E1A',
  accentColor: '#9DC41A',
  categories: ['正手', '反手', '发球', '步伐', '截击', '战术'],
  createdAt: '2026-01-01T00:00:00.000Z',
}

export const SPORT_CATEGORY_PRESETS: Record<string, string[]> = {
  '网球': ['正手', '反手', '发球', '步伐', '截击', '战术'],
  '羽毛球': ['正手', '反手', '发球', '步伐', '网前', '战术'],
  '乒乓球': ['正手', '反手', '发球', '步伐', '旋转', '战术'],
  '篮球': ['运球', '传球', '投篮', '防守', '步伐', '战术'],
  '足球': ['传球', '射门', '控球', '防守', '步伐', '战术'],
  '游泳': ['自由泳', '蛙泳', '仰泳', '蝶泳', '转身', '呼吸'],
  '跑步': ['姿势', '呼吸', '配速', '起跑', '冲刺', '体能'],
  '健身': ['热身', '力量', '有氧', '拉伸', '核心', '恢复'],
  '瑜伽': ['呼吸', '体式', '平衡', '柔韧', '冥想', '放松'],
  '拳击': ['刺拳', '直拳', '勾拳', '防守', '步伐', '体能'],
  '高尔夫': ['开球', '铁杆', '推杆', '沙坑', '站姿', '挥杆'],
  '滑雪': ['转弯', '制动', '姿势', '平衡', '坡度', '安全'],
  '骑行': ['踏频', '爬坡', '下坡', '变速', '姿势', '体能'],
  '排球': ['发球', '传球', '扣球', '拦网', '步伐', '战术'],
  '武术': ['基本功', '套路', '散打', '步伐', '力量', '柔韧'],
  '舞蹈': ['基本步', '节奏', '手位', '转圈', '表现力', '柔韧'],
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function setLocalItem(key: string, value: string): void {
  localStorage.setItem(key, value)
  scheduleLocalFileSync()
}

// ── Sports ──────────────────────────────────────────────

export function getSports(): Sport[] {
  try {
    const raw = localStorage.getItem(SPORTS_KEY)
    if (!raw) return [DEFAULT_SPORT]
    let list = JSON.parse(raw) as Sport[]
    // 迁移：旧数据没有 categories 字段
    list = list.map(s => s.categories ? s : { ...s, categories: s.id === DEFAULT_SPORT.id ? DEFAULT_SPORT.categories : [] })
    // 保证默认网球项目始终存在
    if (!list.find(s => s.id === DEFAULT_SPORT.id)) {
      list.unshift(DEFAULT_SPORT)
    }
    return list
  } catch {
    return [DEFAULT_SPORT]
  }
}

export function saveSport(data: Omit<Sport, 'id' | 'createdAt'>): Sport {
  const sports = getSports()
  const sport: Sport = { ...data, id: generateId(), createdAt: new Date().toISOString() }
  sports.push(sport)
  setLocalItem(SPORTS_KEY, JSON.stringify(sports))
  return sport
}

export function updateSport(id: string, data: Partial<Omit<Sport, 'id' | 'createdAt'>>): void {
  const sports = getSports()
  const idx = sports.findIndex(s => s.id === id)
  if (idx === -1) return
  sports[idx] = { ...sports[idx], ...data }
  setLocalItem(SPORTS_KEY, JSON.stringify(sports))
}

export function deleteSport(id: string): void {
  if (id === DEFAULT_SPORT.id) return // 默认运动不可删除
  const sports = getSports().filter(s => s.id !== id)
  setLocalItem(SPORTS_KEY, JSON.stringify(sports))
  // 删除该运动下的所有记录
  const records = getRecords().filter(r => r.sportId !== id)
  setLocalItem(RECORDS_KEY, JSON.stringify(records))
  // 如果当前激活的是被删除的运动，切回默认
  if (getActiveSportId() === id) setActiveSportId(DEFAULT_SPORT.id)
}

export function getActiveSportId(): string {
  return localStorage.getItem(ACTIVE_SPORT_KEY) ?? DEFAULT_SPORT.id
}

export function setActiveSportId(id: string): void {
  setLocalItem(ACTIVE_SPORT_KEY, id)
}

export function getActiveSport(): Sport {
  const id = getActiveSportId()
  return getSports().find(s => s.id === id) ?? DEFAULT_SPORT
}

// ── Records ─────────────────────────────────────────────

export function getRecords(sportId?: string): TrainingRecord[] {
  try {
    const raw = localStorage.getItem(RECORDS_KEY)
    if (!raw) return []
    let records = JSON.parse(raw) as TrainingRecord[]
    // 迁移：旧记录没有 sportId，补默认值
    records = records.map(r => r.sportId ? r : { ...r, sportId: DEFAULT_SPORT.id })
    if (sportId) records = records.filter(r => r.sportId === sportId)
    return records
  } catch {
    return []
  }
}

export function saveRecord(data: Omit<TrainingRecord, 'id' | 'createdAt' | 'updatedAt'>): TrainingRecord {
  const records = getRecords()
  const now = new Date().toISOString()
  const record: TrainingRecord = { ...data, id: generateId(), createdAt: now, updatedAt: now }
  records.unshift(record)
  setLocalItem(RECORDS_KEY, JSON.stringify(records))
  return record
}

export function updateRecord(id: string, data: Partial<Omit<TrainingRecord, 'id' | 'createdAt'>>): TrainingRecord | null {
  const records = getRecords()
  const index = records.findIndex(r => r.id === id)
  if (index === -1) return null
  const updated: TrainingRecord = { ...records[index], ...data, updatedAt: new Date().toISOString() }
  records[index] = updated
  setLocalItem(RECORDS_KEY, JSON.stringify(records))
  return updated
}

export function deleteRecord(id: string): boolean {
  const records = getRecords()
  const filtered = records.filter(r => r.id !== id)
  if (filtered.length === records.length) return false
  setLocalItem(RECORDS_KEY, JSON.stringify(filtered))
  return true
}

export function getCoaches(sportId?: string): string[] {
  const records = getRecords(sportId)
  const seen = new Set<string>()
  const coaches: string[] = []
  for (const r of records) {
    if (r.coach && !seen.has(r.coach)) {
      seen.add(r.coach)
      coaches.push(r.coach)
    }
  }
  return coaches
}

export interface AppBackup {
  version: 2
  exportedAt: string
  records?: TrainingRecord[]
  techniques?: TechniqueNote[]
  sports?: Sport[]
  conversations?: Conversation[]
}

export interface ExportOptions {
  records: boolean
  techniques: boolean
  sports: boolean
  conversations: boolean
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  records: true,
  techniques: true,
  sports: true,
  conversations: true,
}

function getConversationsForBackup(): Conversation[] {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_KEY)
    return raw ? (JSON.parse(raw) as Conversation[]) : []
  } catch {
    return []
  }
}

export function exportAll(options: ExportOptions = DEFAULT_EXPORT_OPTIONS): string {
  const backup: AppBackup = {
    version: 2,
    exportedAt: new Date().toISOString(),
  }
  if (options.records) backup.records = getRecords()
  if (options.techniques) backup.techniques = getTechniques()
  if (options.sports) backup.sports = getSports()
  if (options.conversations) backup.conversations = getConversationsForBackup()
  return JSON.stringify(backup, null, 2)
}

export function validateBackup(json: string): { valid: boolean; summary: string; error?: string } {
  try {
    const data = JSON.parse(json) as Partial<AppBackup>
    // 兼容旧格式（纯记录数组）
    if (Array.isArray(data)) {
      return { valid: true, summary: `训练记录 ${(data as TrainingRecord[]).length} 条（旧格式）` }
    }
    if (data.version !== 2) return { valid: false, summary: '', error: '不支持的备份格式' }
    const parts = [
      data.records ? `训练记录 ${data.records.length} 条` : '',
      data.techniques ? `技巧笔记 ${data.techniques.length} 条` : '',
      data.sports ? `运动项目 ${data.sports.length} 个` : '',
      data.conversations ? `聊天记录 ${data.conversations.length} 组` : '',
    ]
    return { valid: true, summary: parts.filter(Boolean).join('，') || '空备份' }
  } catch {
    return { valid: false, summary: '', error: 'JSON 解析失败' }
  }
}

export function importBackup(json: string, options: ExportOptions = DEFAULT_EXPORT_OPTIONS): void {
  const data = JSON.parse(json) as AppBackup | TrainingRecord[]
  // 兼容旧格式（纯记录数组）
  if (Array.isArray(data)) {
    if (options.records) setLocalItem(RECORDS_KEY, JSON.stringify(data))
    return
  }
  if (options.records && data.records) setLocalItem(RECORDS_KEY, JSON.stringify(data.records))
  if (options.techniques && data.techniques) setLocalItem(TECHNIQUES_KEY, JSON.stringify(data.techniques))
  if (options.sports && data.sports) setLocalItem(SPORTS_KEY, JSON.stringify(data.sports))
  if (options.conversations && data.conversations) setLocalItem(CONVERSATIONS_KEY, JSON.stringify(data.conversations))
}

// 保留旧名称供外部兼容
export function exportRecords(): string { return exportAll() }
export function validateImport(json: string): { valid: boolean; count: number; error?: string } {
  const r = validateBackup(json)
  return { valid: r.valid, count: 0, error: r.error }
}
export function importRecords(json: string): void { importBackup(json) }

export function getTechniques(sportId?: string): TechniqueNote[] {
  try {
    const raw = localStorage.getItem(TECHNIQUES_KEY)
    if (!raw) return []
    let notes = JSON.parse(raw) as TechniqueNote[]
    // 迁移：旧数据没有 votes 字段
    notes = notes.map(n => (n.votes !== undefined ? n : { ...n, votes: 0 }))
    if (sportId) notes = notes.filter(n => n.sportId === sportId)
    return notes
  } catch {
    return []
  }
}

export function saveTechnique(data: Omit<TechniqueNote, 'id' | 'createdAt' | 'updatedAt'>): TechniqueNote {
  const notes = getTechniques()
  const now = new Date().toISOString()
  const note: TechniqueNote = { ...data, id: generateId(), createdAt: now, updatedAt: now }
  notes.unshift(note)
  setLocalItem(TECHNIQUES_KEY, JSON.stringify(notes))
  return note
}

export function updateTechnique(id: string, data: Partial<Omit<TechniqueNote, 'id' | 'createdAt'>>): TechniqueNote | null {
  const notes = getTechniques()
  const index = notes.findIndex(n => n.id === id)
  if (index === -1) return null
  const updated: TechniqueNote = { ...notes[index], ...data, updatedAt: new Date().toISOString() }
  notes[index] = updated
  setLocalItem(TECHNIQUES_KEY, JSON.stringify(notes))
  return updated
}

export function deleteTechnique(id: string): boolean {
  const notes = getTechniques()
  const filtered = notes.filter(n => n.id !== id)
  if (filtered.length === notes.length) return false
  setLocalItem(TECHNIQUES_KEY, JSON.stringify(filtered))
  return true
}
