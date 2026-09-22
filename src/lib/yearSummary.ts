import type { TrainingRecord } from '../types'

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function startOfRollingYear(today: Date): Date {
  const start = new Date(today)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - 364)
  return start
}

export function getRollingYearRecords(records: TrainingRecord[], today = new Date()): TrainingRecord[] {
  const start = dateKey(startOfRollingYear(today))
  const end = dateKey(today)
  return records.filter(record => record.date >= start && record.date <= end)
}
