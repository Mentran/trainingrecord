import type { TechniqueNote } from '../types'

export interface TechniqueMergePlan {
  keepId: string
  removeIds: string[]
  title: string
  content: string
  category?: string
  tags: string[]
  votes: number
}

export interface DuplicateTechniqueGroup {
  id: string
  reason: '相同标题' | '相似标题'
  notes: TechniqueNote[]
  plan: TechniqueMergePlan
}

export interface TechniqueAudit {
  duplicateGroups: DuplicateTechniqueGroup[]
  uncategorizedCount: number
  emptyCategories: string[]
}

function normalizeTitle(title: string): string {
  return title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s：:，,。.!！?？、/\\（）()《》“”"'—_-]+/g, '')
}

function titleBigrams(title: string): Set<string> {
  const normalized = normalizeTitle(title)
  if (normalized.length < 2) return new Set([normalized])
  return new Set(Array.from({ length: normalized.length - 1 }, (_, index) =>
    normalized.slice(index, index + 2)
  ))
}

function titleSimilarity(left: string, right: string): number {
  const leftPairs = titleBigrams(left)
  const rightPairs = titleBigrams(right)
  const overlap = [...leftPairs].filter(pair => rightPairs.has(pair)).length
  return (2 * overlap) / (leftPairs.size + rightPairs.size)
}

function categoriesCompatible(left: TechniqueNote, right: TechniqueNote): boolean {
  return !left.category || !right.category || left.category === right.category
}

function titlesMatch(left: TechniqueNote, right: TechniqueNote): boolean {
  if (!categoriesCompatible(left, right)) return false
  const leftTitle = normalizeTitle(left.title)
  const rightTitle = normalizeTitle(right.title)
  if (leftTitle === rightTitle) return true
  if (Math.min(leftTitle.length, rightTitle.length) >= 4
    && (leftTitle.includes(rightTitle) || rightTitle.includes(leftTitle))) {
    return true
  }
  return titleSimilarity(left.title, right.title) >= 0.72
}

function chooseKeeper(notes: TechniqueNote[]): TechniqueNote {
  return [...notes].sort((left, right) =>
    (right.votes ?? 0) - (left.votes ?? 0)
    || right.content.length - left.content.length
    || new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  )[0]
}

function mergeContents(notes: TechniqueNote[], keeper: TechniqueNote): string {
  const unique = [keeper, ...notes.filter(note => note.id !== keeper.id)]
    .map(note => note.content.trim())
    .filter(Boolean)
    .filter((content, index, all) => all.indexOf(content) === index)
    .sort((left, right) => right.length - left.length)
    .filter((content, index, all) =>
      !all.some((other, otherIndex) => otherIndex < index && other.includes(content))
    )
  const [primary = keeper.content, ...supplements] = unique
  return supplements.length > 0
    ? `${primary}\n\n${supplements.map(content => `补充：${content}`).join('\n')}`
    : primary
}

export function createTechniqueMergePlan(notes: TechniqueNote[]): TechniqueMergePlan {
  if (notes.length < 2) throw new Error('至少需要两条技巧才能合并')
  const keeper = chooseKeeper(notes)
  const category = keeper.category
    ?? notes.map(note => note.category).find(Boolean)
  const tags = [keeper, ...notes.filter(note => note.id !== keeper.id)]
    .flatMap(note => note.tags ?? [])
    .filter(tag => tag !== category)
    .filter((tag, index, all) => all.indexOf(tag) === index)
    .slice(0, 3)

  return {
    keepId: keeper.id,
    removeIds: notes.filter(note => note.id !== keeper.id).map(note => note.id),
    title: keeper.title,
    content: mergeContents(notes, keeper),
    category,
    tags,
    votes: notes.reduce((sum, note) => sum + (note.votes ?? 0), 0),
  }
}

export function findDuplicateTechniqueGroups(notes: TechniqueNote[]): DuplicateTechniqueGroup[] {
  const parents = notes.map((_, index) => index)
  const find = (index: number): number => {
    let root = index
    while (parents[root] !== root) root = parents[root]
    while (parents[index] !== index) {
      const next = parents[index]
      parents[index] = root
      index = next
    }
    return root
  }
  const union = (left: number, right: number): void => {
    const leftRoot = find(left)
    const rightRoot = find(right)
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot
  }

  notes.forEach((note, leftIndex) => {
    notes.slice(leftIndex + 1).forEach((candidate, offset) => {
      if (titlesMatch(note, candidate)) union(leftIndex, leftIndex + offset + 1)
    })
  })

  const grouped = new Map<number, TechniqueNote[]>()
  notes.forEach((note, index) => {
    const root = find(index)
    grouped.set(root, [...(grouped.get(root) ?? []), note])
  })

  return [...grouped.values()]
    .filter(group => group.length > 1)
    .map(group => {
      const normalizedTitles = new Set(group.map(note => normalizeTitle(note.title)))
      const reason: DuplicateTechniqueGroup['reason'] = normalizedTitles.size === 1
        ? '相同标题'
        : '相似标题'
      return {
        id: group.map(note => note.id).sort().join(':'),
        reason,
        notes: group,
        plan: createTechniqueMergePlan(group),
      }
    })
    .sort((left, right) =>
      right.notes.length - left.notes.length
      || left.plan.title.localeCompare(right.plan.title, 'zh-CN')
    )
}

export function auditTechniques(notes: TechniqueNote[], categories: string[]): TechniqueAudit {
  return {
    duplicateGroups: findDuplicateTechniqueGroups(notes),
    uncategorizedCount: notes.filter(note => !note.category || !categories.includes(note.category)).length,
    emptyCategories: categories.filter(category => !notes.some(note => note.category === category)),
  }
}
