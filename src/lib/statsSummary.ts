import type { TrainingRecord } from '../types'
import { getRollingYearRecords } from './yearSummary'

export type StatsRange = 'rolling' | 'year' | 'all'

export const STATS_RANGE_LABELS: Record<StatsRange, string> = {
  rolling: '过去 12 个月',
  year: '本年度',
  all: '全部记录',
}

export function getStatsRecords(records: TrainingRecord[], range: StatsRange, today = new Date()): TrainingRecord[] {
  if (range === 'rolling') return getRollingYearRecords(records, today)
  if (range === 'all') return records

  const start = `${today.getFullYear()}-01-01`
  const end = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return records.filter(record => record.date >= start && record.date <= end)
}
