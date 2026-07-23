import { z } from 'zod'
import {
  conversationSchema,
  sportSchema,
  techniqueNoteSchema,
  trainingRecordSchema,
} from './entitySchemas'

const isoString = z.string().refine(value => !Number.isNaN(Date.parse(value)), '时间格式无效')
const nonEmptyString = z.string().trim().min(1)

export const localFileDataSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
  savedAt: isoString,
  records: z.array(trainingRecordSchema),
  techniques: z.array(techniqueNoteSchema),
  sports: z.array(sportSchema),
  conversations: z.array(conversationSchema),
  activeSportId: nonEmptyString.optional(),
  activeConversationId: nonEmptyString.optional(),
  activeConversationIds: z.record(z.string(), nonEmptyString).optional(),
})

export type LocalFileData = z.infer<typeof localFileDataSchema>

export const localFileReadResponseSchema = z.object({
  exists: z.boolean(),
  data: localFileDataSchema.optional(),
  path: z.string(),
  backupsPath: z.string(),
}).superRefine((payload, context) => {
  if (payload.exists && !payload.data) {
    context.addIssue({
      code: 'custom',
      path: ['data'],
      message: '文件存在但缺少数据',
    })
  }
})

export const localFileWriteResponseSchema = z.object({
  ok: z.literal(true),
  savedAt: isoString,
  path: z.string(),
  backupsPath: z.string(),
})

export function parseLocalFileData(raw: unknown): LocalFileData {
  try {
    return localFileDataSchema.parse(raw)
  } catch (error) {
    if (!(error instanceof z.ZodError)) throw error
    const issue = error.issues[0]
    const path = issue.path.length > 0 ? issue.path.join('.') : '根节点'
    throw new Error(`${path}：${issue.message}`, { cause: error })
  }
}
