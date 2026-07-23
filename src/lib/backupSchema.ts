import { z } from 'zod'
import type { Conversation } from './ai'
import type { Sport, TechniqueNote, TrainingRecord } from '../types'
import {
  conversationSchema,
  sportSchema,
  techniqueNoteSchema,
  trainingRecordSchema,
} from './entitySchemas'

const DEFAULT_SPORT_ID = 'tennis'

const isoString = z.string().refine(value => !Number.isNaN(Date.parse(value)), '时间格式无效')

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
