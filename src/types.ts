export interface TrainingRecord {
  id: string
  sportId: string              // 关联运动项目
  date: string                 // YYYY-MM-DD
  duration: number             // 分钟
  coach: string
  content: string
  contentOriginal: string
  reflection: string
  reflectionOriginal: string
  tags?: string[]
  polishStatus?: 'none' | 'partial' | 'applied' | 'failed'
  createdAt: string
  updatedAt: string
}

export interface Sport {
  id: string
  name: string                 // 如"网球"
  icon: string                 // emoji，如"🎾"
  color: string                // 主题色 hex（深色，用于 header）
  accentColor: string          // 强调色 hex（亮色，用于 badge/按钮）
  createdAt: string
}
