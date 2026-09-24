import { describe, expect, it } from 'vitest'
import type { TrainingRecord } from '../types'
import { buildAnnualCalendar, getCalendarYearRecords, getRollingYearRecords } from './yearSummary'

function record(overrides: Partial<TrainingRecord>): TrainingRecord {
  return {
    id: 'record',
    sportId: 'tennis',
    date: '2026-09-01',
    duration: 60,
    coach: '',
    content: '训练内容',
    contentOriginal: '训练内容',
    reflection: '',
    reflectionOriginal: '',
    polishStatus: 'none',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('yearSummary', () => {
  const today = new Date('2026-09-22T12:00:00')

  it('按自然年生成 12 个固定高度的月份网格', () => {
    const months = buildAnnualCalendar(2026, today)

    expect(months).toHaveLength(12)
    expect(months[0]).toMatchObject({ year: 2026, month: 0 })
    expect(months[11]).toMatchObject({ year: 2026, month: 11 })
    expect(months.every(month => month.days.length === 42)).toBe(true)
    expect(months[0].days.find(day => day?.date === '2026-01-01')?.isFuture).toBe(false)
    expect(months[8].days.find(day => day?.date === '2026-09-23')?.isFuture).toBe(true)
  })

  it('按自然年筛选记录，并截断当前年份的未来日期', () => {
    const records = [
      record({ id: 'previous-year', date: '2025-12-31' }),
      record({ id: 'current-year', date: '2026-09-22' }),
      record({ id: 'future', date: '2026-09-23' }),
    ]

    expect(getCalendarYearRecords(records, 2025, today).map(item => item.id)).toEqual(['previous-year'])
    expect(getCalendarYearRecords(records, 2026, today).map(item => item.id)).toEqual(['current-year'])
  })

  it('只统计过去 365 天内的记录', () => {
    const records = [
      record({ id: 'old', date: '2025-09-22' }),
      record({ id: 'start', date: '2025-09-23' }),
      record({ id: 'current', date: '2026-09-22' }),
      record({ id: 'future', date: '2026-09-23' }),
    ]

    expect(getRollingYearRecords(records, today).map(item => item.id)).toEqual(['start', 'current'])
  })

})
