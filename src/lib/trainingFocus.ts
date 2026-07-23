import type { TrainingFocusOutcome, TrainingRecord } from '../types'

export const FOCUS_OUTCOME_LABELS: Record<TrainingFocusOutcome, string> = {
  improved: '有改善',
  unchanged: '没变化',
  worse: '更困难',
}

export function isUnresolvedFocusOutcome(outcome?: TrainingFocusOutcome): boolean {
  return outcome === 'unchanged' || outcome === 'worse'
}

export function getUnresolvedFocusStreak(records: TrainingRecord[], currentRecord: TrainingRecord): number {
  if (!currentRecord.focus || !isUnresolvedFocusOutcome(currentRecord.focus.outcome)) return 0

  const currentIndex = records.findIndex(record => record.id === currentRecord.id)
  if (currentIndex < 0) return 0

  let streak = 0
  for (let index = currentIndex; index < records.length; index += 1) {
    const focus = records[index].focus
    if (focus?.text !== currentRecord.focus.text || !isUnresolvedFocusOutcome(focus.outcome)) break
    streak += 1
  }
  return streak
}
