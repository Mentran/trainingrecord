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

export interface AnnualMonth {
  year: number
  month: number
  days: (AnnualDay | null)[]
}

export interface AnnualDay {
  date: string
  isFuture: boolean
}

/** Build 12 fixed-height month grids for a natural calendar year. */
export function buildAnnualCalendar(year: number, today = new Date()): AnnualMonth[] {
  const todayKey = dateKey(today)

  return Array.from({ length: 12 }, (_, month) => {
    const firstDay = new Date(year, month, 1).getDay()
    const count = new Date(year, month + 1, 0).getDate()
    const days: (AnnualDay | null)[] = Array.from({ length: firstDay }, () => null)

    for (let day = 1; day <= count; day++) {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      days.push({ date, isFuture: date > todayKey })
    }

    while (days.length < 42) days.push(null)
    return { year, month, days }
  })
}

export function getCalendarYearRecords(records: TrainingRecord[], year: number, today = new Date()): TrainingRecord[] {
  const start = `${year}-01-01`
  const end = year === today.getFullYear() ? dateKey(today) : `${year}-12-31`
  return records.filter(record => record.date >= start && record.date <= end)
}

export function getRollingYearRecords(records: TrainingRecord[], today = new Date()): TrainingRecord[] {
  const start = dateKey(startOfRollingYear(today))
  const end = dateKey(today)
  return records.filter(record => record.date >= start && record.date <= end)
}
