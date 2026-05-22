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

export interface TechniqueNote {
  id: string
  sportId: string
  title: string                // 动作名称，如"正手击球"
  content: string              // 详细说明
  source: 'ai' | 'user'       // ai=AI生成，user=用户自己写
  tags?: string[]
  votes: number                // 实用性 +1 计数
  createdAt: string
  updatedAt: string
}
