import { describe, expect, it } from 'vitest'
import type { TrainingRecord } from '../types'
import { getRollingYearRecords } from './yearSummary'

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
