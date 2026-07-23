import { describe, expect, it } from 'vitest'
import type { TrainingRecord } from '../types'
import { getRecommendedTrainingPrompt } from './tennisKnowledge'

const record: TrainingRecord = {
  id: 'record-1',
  sportId: 'tennis',
  date: '2026-07-23',
  duration: 60,
  coach: '',
  content: '今天集中练习发球，抛球位置不稳定',
  contentOriginal: '今天集中练习发球，抛球位置不稳定',
  reflection: '',
  reflectionOriginal: '',
  tags: ['发球'],
  createdAt: '2026-07-23T00:00:00.000Z',
  updatedAt: '2026-07-23T00:00:00.000Z',
}

describe('getRecommendedTrainingPrompt', () => {
  it('优先推荐与最新训练标签相关的提示', () => {
    expect(getRecommendedTrainingPrompt('2.0', [record]).category).toBe('发球')
  })
})
