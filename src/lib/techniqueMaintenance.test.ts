import { describe, expect, it } from 'vitest'
import type { TechniqueNote } from '../types'
import {
  auditTechniques,
  createTechniqueMergePlan,
  findDuplicateTechniqueGroups,
} from './techniqueMaintenance'

const timestamp = '2026-07-26T00:00:00.000Z'

function note(
  id: string,
  title: string,
  content: string,
  category?: string,
  votes = 0,
  tags: string[] = [],
): TechniqueNote {
  return {
    id,
    sportId: 'tennis',
    title,
    content,
    category,
    tags,
    votes,
    source: 'user',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

describe('technique maintenance', () => {
  it('识别同名和同分类的相似标题，但不跨分类误合并', () => {
    const groups = findDuplicateTechniqueGroups([
      note('a', '挥拍顺序', '内容一', '正手'),
      note('b', '挥拍顺序', '内容二', '正手'),
      note('c', '转身带动', '正手转身', '正手'),
      note('d', '转身带动挥拍', '正手转身挥拍', '正手'),
      note('e', '转身带动发球', '发球转身', '发球'),
    ])

    expect(groups).toHaveLength(2)
    expect(groups.map(group => group.reason)).toEqual(['相同标题', '相似标题'])
    expect(groups.flatMap(group => group.notes.map(item => item.id))).not.toContain('e')
  })

  it('合并方案保留点赞、标签和不重复正文', () => {
    const plan = createTechniqueMergePlan([
      note('a', '转身带动', '用身体转动带动手臂。', '正手', 2, ['转身']),
      note('b', '转身带动挥拍', '先转髋，再转肩，最后带动球拍。', '正手', 1, ['动力链', '转身']),
    ])

    expect(plan.keepId).toBe('a')
    expect(plan.removeIds).toEqual(['b'])
    expect(plan.votes).toBe(3)
    expect(plan.tags).toEqual(['转身', '动力链'])
    expect(plan.content).toContain('用身体转动带动手臂。')
    expect(plan.content).toContain('先转髋，再转肩，最后带动球拍。')
  })

  it('统计未分类技巧和空分类', () => {
    const audit = auditTechniques([
      note('a', '正手准备', '内容', '正手'),
      note('b', '待分类', '内容'),
    ], ['正手', '反手', '发球'])

    expect(audit.uncategorizedCount).toBe(1)
    expect(audit.emptyCategories).toEqual(['反手', '发球'])
  })
})
