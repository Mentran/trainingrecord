import { z } from 'zod'
import type { Sport, TechniqueNote, TrainingRecord } from '../types'

const DEFAULT_SPORT_ID = 'tennis'
const nonEmptyString = z.string().trim().min(1)
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期必须为 YYYY-MM-DD')
const isoString = z.string().refine(value => !Number.isNaN(Date.parse(value)), '时间格式无效')

const trainingFocusSchema = z.object({
  cardId: nonEmptyString.optional(),
  text: nonEmptyString,
  outcome: z.enum(['improved', 'unchanged', 'worse']).optional(),
  note: z.string().optional(),
})

export const trainingRecordSchema = z.object({
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
  focus: trainingFocusSchema.optional(),
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

export const sportSchema = z.object({
  id: nonEmptyString,
  name: nonEmptyString,
  icon: nonEmptyString,
  color: nonEmptyString,
  accentColor: nonEmptyString,
  categories: z.array(z.string()).default([]),
  level: tennisLevelSchema.optional(),
  createdAt: isoString.optional().default('2026-01-01T00:00:00.000Z'),
}) satisfies z.ZodType<Sport>

export const techniqueNoteSchema = z.object({
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

export const chatMessageSchema = z.object({
  id: nonEmptyString,
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  createdAt: isoString,
})

export const conversationSchema = z.object({
  id: nonEmptyString,
  sportId: nonEmptyString.optional().default(DEFAULT_SPORT_ID),
  title: nonEmptyString,
  messages: z.array(chatMessageSchema),
  createdAt: isoString,
  updatedAt: isoString,
})
