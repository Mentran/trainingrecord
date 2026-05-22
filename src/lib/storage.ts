import type { TrainingRecord, Sport, TechniqueNote } from '../types'

const RECORDS_KEY = 'tennis_records'
const SPORTS_KEY = 'sports_list'
const ACTIVE_SPORT_KEY = 'active_sport_id'
const TECHNIQUES_KEY = 'technique_notes'

export const DEFAULT_SPORT: Sport = {
  id: 'tennis',
  name: '网球',
  icon: '🎾',
  color: '#1A2E1A',
  accentColor: '#9DC41A',
  createdAt: '2026-01-01T00:00:00.000Z',
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ── Sports ──────────────────────────────────────────────

export function getSports(): Sport[] {
  try {
    const raw = localStorage.getItem(SPORTS_KEY)
    if (!raw) return [DEFAULT_SPORT]
    const list = JSON.parse(raw) as Sport[]
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
  localStorage.setItem(SPORTS_KEY, JSON.stringify(sports))
  return sport
}

export function deleteSport(id: string): void {
  if (id === DEFAULT_SPORT.id) return // 默认运动不可删除
  const sports = getSports().filter(s => s.id !== id)
  localStorage.setItem(SPORTS_KEY, JSON.stringify(sports))
  // 删除该运动下的所有记录
  const records = getRecords().filter(r => r.sportId !== id)
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records))
  // 如果当前激活的是被删除的运动，切回默认
  if (getActiveSportId() === id) setActiveSportId(DEFAULT_SPORT.id)
}

export function getActiveSportId(): string {
  return localStorage.getItem(ACTIVE_SPORT_KEY) ?? DEFAULT_SPORT.id
}

export function setActiveSportId(id: string): void {
  localStorage.setItem(ACTIVE_SPORT_KEY, id)
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
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records))
  return record
}

export function updateRecord(id: string, data: Partial<Omit<TrainingRecord, 'id' | 'createdAt'>>): TrainingRecord | null {
  const records = getRecords()
  const index = records.findIndex(r => r.id === id)
  if (index === -1) return null
  const updated: TrainingRecord = { ...records[index], ...data, updatedAt: new Date().toISOString() }
  records[index] = updated
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records))
  return updated
}

export function deleteRecord(id: string): boolean {
  const records = getRecords()
  const filtered = records.filter(r => r.id !== id)
  if (filtered.length === records.length) return false
  localStorage.setItem(RECORDS_KEY, JSON.stringify(filtered))
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

export function exportRecords(): string {
  return JSON.stringify(getRecords(), null, 2)
}

export function validateImport(json: string): { valid: boolean; count: number; error?: string } {
  try {
    const data = JSON.parse(json)
    if (!Array.isArray(data)) return { valid: false, count: 0, error: '格式错误：需要数组' }
    for (const item of data) {
      if (!item.id || !item.date || !item.content) {
        return { valid: false, count: 0, error: '格式错误：记录缺少必要字段' }
      }
    }
    return { valid: true, count: data.length }
  } catch {
    return { valid: false, count: 0, error: 'JSON 解析失败' }
  }
}

export function importRecords(json: string): void {
  const data = JSON.parse(json)
  localStorage.setItem(RECORDS_KEY, JSON.stringify(data))
}

export function getTechniques(sportId?: string): TechniqueNote[] {
  try {
    const raw = localStorage.getItem(TECHNIQUES_KEY)
    if (!raw) return []
    let notes = JSON.parse(raw) as TechniqueNote[]
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
  localStorage.setItem(TECHNIQUES_KEY, JSON.stringify(notes))
  return note
}

export function updateTechnique(id: string, data: Partial<Omit<TechniqueNote, 'id' | 'createdAt'>>): TechniqueNote | null {
  const notes = getTechniques()
  const index = notes.findIndex(n => n.id === id)
  if (index === -1) return null
  const updated: TechniqueNote = { ...notes[index], ...data, updatedAt: new Date().toISOString() }
  notes[index] = updated
  localStorage.setItem(TECHNIQUES_KEY, JSON.stringify(notes))
  return updated
}

export function deleteTechnique(id: string): boolean {
  const notes = getTechniques()
  const filtered = notes.filter(n => n.id !== id)
  if (filtered.length === notes.length) return false
  localStorage.setItem(TECHNIQUES_KEY, JSON.stringify(filtered))
  return true
}

