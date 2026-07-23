import { describe, expect, it } from 'vitest'
import type { TrainingFocusOutcome, TrainingRecord } from '../types'
import { getUnresolvedFocusStreak, isUnresolvedFocusOutcome } from './trainingFocus'

const now = '2026-07-23T00:00:00.000Z'

function focusedRecord(id: string, outcome: TrainingFocusOutcome, text = '提前转肩'): TrainingRecord {
  return {
    id,
    sportId: 'tennis',
    date: '2026-07-23',
    duration: 60,
    coach: '',
    content: '练习正手',
    contentOriginal: '练习正手',
    reflection: '',
    reflectionOriginal: '',
    focus: { text, outcome },
    createdAt: now,
    updatedAt: now,
  }
}

describe('training focus', () => {
  it('只把没变化和更困难视为未解决', () => {
    expect(isUnresolvedFocusOutcome('unchanged')).toBe(true)
    expect(isUnresolvedFocusOutcome('worse')).toBe(true)
    expect(isUnresolvedFocusOutcome('improved')).toBe(false)
    expect(isUnresolvedFocusOutcome()).toBe(false)
  })

  it('计算截至当前记录的连续未改善次数', () => {
    const current = focusedRecord('current', 'unchanged')
    const records = [
      current,
      focusedRecord('previous', 'worse'),
      focusedRecord('older', 'unchanged'),
      focusedRecord('resolved', 'improved'),
    ]
    expect(getUnresolvedFocusStreak(records, current)).toBe(3)
  })

  it('关注点变化后重新计数', () => {
    const current = focusedRecord('current', 'unchanged')
    const records = [
      current,
      focusedRecord('different', 'unchanged', '放松握拍'),
      focusedRecord('older', 'unchanged'),
    ]
    expect(getUnresolvedFocusStreak(records, current)).toBe(1)
  })
})
