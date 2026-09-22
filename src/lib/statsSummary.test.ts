import { describe, expect, it } from 'vitest'
import type { TrainingRecord } from '../types'
import { getStatsRecords } from './statsSummary'

function record(id: string, date: string): TrainingRecord {
  return {
    id,
    sportId: 'tennis',
    date,
    duration: 60,
    coach: '',
    content: '训练内容',
    contentOriginal: '训练内容',
    reflection: '',
    reflectionOriginal: '',
    polishStatus: 'none',
    createdAt: `${date}T00:00:00.000Z`,
    updatedAt: `${date}T00:00:00.000Z`,
  }
}

describe('getStatsRecords', () => {
  const records = [
    record('old', '2024-12-31'),
    record('last-year', '2025-12-31'),
    record('current-year', '2026-03-01'),
    record('recent', '2026-09-01'),
    record('future', '2026-09-23'),
  ]
  const today = new Date('2026-09-22T12:00:00')

  it('按本年度筛选，不包含未来记录', () => {
    expect(getStatsRecords(records, 'year', today).map(item => item.id)).toEqual(['current-year', 'recent'])
  })

  it('按过去 12 个月筛选', () => {
    expect(getStatsRecords(records, 'rolling', today).map(item => item.id)).toEqual(['last-year', 'current-year', 'recent'])
  })

  it('全部记录范围不做时间裁剪', () => {
    expect(getStatsRecords(records, 'all', today).map(item => item.id)).toEqual(records.map(item => item.id))
  })
})
