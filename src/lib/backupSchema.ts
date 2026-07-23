import { z } from 'zod'
import type { Conversation } from './ai'
import type { Sport, TechniqueNote, TrainingRecord } from '../types'

const DEFAULT_SPORT_ID = 'tennis'

const nonEmptyString = z.string().trim().min(1)
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期必须为 YYYY-MM-DD')
const isoString = z.string().refine(value => !Number.isNaN(Date.parse(value)), '时间格式无效')

const trainingRecordSchema = z.object({
  id: nonEmptyString,
  sportId: nonEmptyString.optional().default(DEFAULT_SPORT_ID),
  date: dateString,
  duration: z.number().finite().nonnegative(),
  coach: z.string().default(''),
  content: z.string(),
  contentOriginal: z.string().optional(),
  reflection: z.string().default(''),
  reflectionOriginal: z.string().optional(),
  tags: z.array(z.string()).optional(),
  polishStatus: z.enum(['none', 'partial', 'applied', 'failed']).optional(),
  createdAt: isoString.optional(),
  updatedAt: isoString.optional(),
}).transform(record => {
  const fallbackTime = `${record.date}T00:00:00.000Z`
  return {
    ...record,
    contentOriginal: record.contentOriginal ?? record.content,
    reflectionOriginal: record.reflectionOriginal ?? record.reflection,
    createdAt: record.createdAt ?? fallbackTime,
    updatedAt: record.updatedAt ?? record.createdAt ?? fallbackTime,
  } satisfies TrainingRecord
})

const tennisLevelSchema = z.enum(['1.0', '1.5', '2.0', '2.5', '3.0'])

const sportSchema = z.object({
  id: nonEmptyString,
  name: nonEmptyString,
  icon: nonEmptyString,
  color: nonEmptyString,
  accentColor: nonEmptyString,
  categories: z.array(z.string()).default([]),
  level: tennisLevelSchema.optional(),
  createdAt: isoString.optional().default('2026-01-01T00:00:00.000Z'),
}) satisfies z.ZodType<Sport>

const techniqueNoteSchema = z.object({
  id: nonEmptyString,
  sportId: nonEmptyString.optional().default(DEFAULT_SPORT_ID),
  title: nonEmptyString,
  content: z.string(),
  source: z.enum(['ai', 'user']),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  votes: z.number().int().nonnegative().optional().default(0),
  createdAt: isoString,
  updatedAt: isoString,
}) satisfies z.ZodType<TechniqueNote>

const chatMessageSchema = z.object({
  id: nonEmptyString,
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  createdAt: isoString,
})

const conversationSchema = z.object({
  id: nonEmptyString,
  sportId: nonEmptyString.optional().default(DEFAULT_SPORT_ID),
  title: nonEmptyString,
  messages: z.array(chatMessageSchema),
  createdAt: isoString,
  updatedAt: isoString,
}) satisfies z.ZodType<Conversation>

const backupSchema = z.object({
  version: z.literal(2),
  exportedAt: isoString,
  records: z.array(trainingRecordSchema).optional(),
  techniques: z.array(techniqueNoteSchema).optional(),
  sports: z.array(sportSchema).optional(),
  conversations: z.array(conversationSchema).optional(),
})

export interface ParsedBackup {
  version: 2
  exportedAt: string
  records?: TrainingRecord[]
  techniques?: TechniqueNote[]
  sports?: Sport[]
  conversations?: Conversation[]
  legacy: boolean
}

function assertUniqueIds(items: Array<{ id: string }> | undefined, label: string): void {
  if (!items) return
  const seen = new Set<string>()
  for (const item of items) {
    if (seen.has(item.id)) throw new Error(`${label}存在重复 ID：${item.id}`)
    seen.add(item.id)
  }
}

function assertInternalSportReferences(backup: ParsedBackup): void {
  if (!backup.sports) return
  const sportIds = new Set(backup.sports.map(sport => sport.id))
  sportIds.add(DEFAULT_SPORT_ID)
  const groups: Array<[string, Array<{ sportId: string }> | undefined]> = [
    ['训练记录', backup.records],
    ['技巧笔记', backup.techniques],
    ['聊天记录', backup.conversations],
  ]
  for (const [label, items] of groups) {
    const unknown = items?.find(item => !sportIds.has(item.sportId))
    if (unknown) throw new Error(`${label}引用了不存在的运动项目：${unknown.sportId}`)
  }
}

function normalizeError(error: unknown): Error {
  if (!(error instanceof z.ZodError)) return error instanceof Error ? error : new Error('备份格式无效')
  const issue = error.issues[0]
  const path = issue.path.length > 0 ? issue.path.join('.') : '根节点'
  return new Error(`${path}：${issue.message}`)
}

export function parseBackupJson(json: string): ParsedBackup {
  try {
    const raw: unknown = JSON.parse(json)
    let parsed: ParsedBackup
    if (Array.isArray(raw)) {
      parsed = {
        version: 2,
        exportedAt: new Date().toISOString(),
        records: z.array(trainingRecordSchema).parse(raw),
        legacy: true,
      }
    } else {
      const backup = backupSchema.parse(raw)
      parsed = { ...backup, legacy: false }
    }

    assertUniqueIds(parsed.records, '训练记录')
    assertUniqueIds(parsed.techniques, '技巧笔记')
    assertUniqueIds(parsed.sports, '运动项目')
    assertUniqueIds(parsed.conversations, '聊天记录')
    assertInternalSportReferences(parsed)
    return parsed
  } catch (error) {
    throw normalizeError(error)
  }
}
