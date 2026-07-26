import { describe, expect, it } from 'vitest'
import type { TennisLevel, TrainingRecord } from '../types'
import {
  TENNIS_KNOWLEDGE_CARDS,
  getRecommendedTrainingPrompt,
  type TennisKnowledgeCategory,
} from './tennisKnowledge'

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

  it('每个等级和技术分类至少有两条提示', () => {
    const levels: TennisLevel[] = ['1.0', '1.5', '2.0', '2.5', '3.0']
    const categories: TennisKnowledgeCategory[] = ['正手', '反手', '发球', '步伐', '截击', '战术']

    expect(TENNIS_KNOWLEDGE_CARDS).toHaveLength(60)
    expect(new Set(TENNIS_KNOWLEDGE_CARDS.map(card => card.id))).toHaveLength(60)
    levels.forEach(level => {
      categories.forEach(category => {
        expect(TENNIS_KNOWLEDGE_CARDS.filter(card =>
          card.level === level && card.category === category
        )).toHaveLength(2)
      })
    })
  })

  it('连续日期和换一条会在 12 条候选中稳定轮换', () => {
    const firstDate = new Date(2026, 6, 26)
    const nextDate = new Date(2026, 6, 27)
    const first = getRecommendedTrainingPrompt('2.0', [], 0, firstDate)
    const next = getRecommendedTrainingPrompt('2.0', [], 0, nextDate)
    const switched = Array.from({ length: 12 }, (_, offset) =>
      getRecommendedTrainingPrompt('2.0', [], offset, firstDate).id
    )

    expect(next.id).not.toBe(first.id)
    expect(new Set(switched)).toHaveLength(12)
  })

  it('设置等级后所有轮换提示都严格匹配该等级', () => {
    const date = new Date(2026, 6, 26)
    const prompts = Array.from({ length: 12 }, (_, offset) =>
      getRecommendedTrainingPrompt('3.0', [record], offset, date)
    )

    expect(prompts.every(prompt => prompt.level === '3.0')).toBe(true)
    expect(prompts.every(prompt => prompt.category === '发球')).toBe(true)
  })
})
