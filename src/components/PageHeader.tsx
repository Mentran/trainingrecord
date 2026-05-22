import { useSport } from './SportProvider'

interface PageHeaderProps {
  title: string
  subtitle?: string
  right?: React.ReactNode
  onBack?: () => void
}

export default function PageHeader({ title, subtitle, right, onBack }: PageHeaderProps) {
  const { sport } = useSport()
  return (
    <div
      className="px-4 pt-12 pb-5"
      style={{ background: `linear-gradient(135deg, ${sport.color} 0%, ${sport.color}cc 100%)` }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/15 text-white"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          <div>
            <h1 className="text-xl font-semibold text-white leading-tight">{title}</h1>
            {subtitle && <p className="text-sm text-white/60 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {right && <div className="flex items-center gap-2">{right}</div>}
      </div>
    </div>
  )
}
