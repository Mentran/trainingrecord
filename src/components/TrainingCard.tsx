const COACH_COLORS = ['#E8A838', '#4A90D9', '#E85D5D', '#9B59B6', '#1ABC9C']

export function getCoachColor(coach: string, allCoaches: string[]): string {
  const index = allCoaches.indexOf(coach)
  return COACH_COLORS[index % COACH_COLORS.length] ?? '#9DC41A'
}

interface TrainingCardProps {
  date: string
  coach?: string
  duration?: number
  content: string
  tags?: string[]
  coachColor?: string
  onClick?: () => void
  compact?: boolean
}

function formatDate(date: string, compact = false) {
  const d = new Date(date + 'T00:00:00')
  if (compact) return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
}

function excerpt(text: string, max: number) {
  return text.length > max ? text.slice(0, max) + '…' : text
}

export default function TrainingCard({ date, coach, duration, content, tags, coachColor, onClick, compact = false }: TrainingCardProps) {
  const accent = coachColor ?? '#9DC41A'
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl overflow-hidden active:scale-[0.985] transition-transform"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)' }}
    >
      <div className="px-4 pt-4 pb-3">
        {/* 顶部：日期 + badges */}
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <span className={`font-semibold text-[#111] leading-tight ${compact ? 'text-sm' : 'text-[15px]'}`}>
            {formatDate(date, compact)}
          </span>
          <div className="flex gap-1.5 shrink-0 mt-0.5">
            {coach && (
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: accent }}
              >
                {coach}
              </span>
            )}
            {duration && duration > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F2F2EE] text-[#888]">
                {duration}′
              </span>
            )}
          </div>
        </div>
        {/* 内容摘要 */}
        <p className={`text-[#888] leading-relaxed line-clamp-2 ${compact ? 'text-xs' : 'text-sm'}`}>
          {excerpt(content, compact ? 50 : 90)}
        </p>
        {/* 标签 */}
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.map(tag => (
              <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-[#F2F2EE] text-[#888]">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
      {/* 底部彩色细线 */}
      <div
        className="h-[3px] mx-4 mb-3 rounded-full"
        style={{ backgroundColor: accent, opacity: 0.35 }}
      />
    </button>
  )
}
