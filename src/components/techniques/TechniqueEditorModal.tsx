export interface TechniqueEditState {
  id?: string
  title: string
  content: string
  category: string
  tags: string
}

interface TechniqueEditorModalProps {
  heading: string
  value: TechniqueEditState
  categories: string[]
  accentColor: string
  submitBackground: string
  tagLimit: number
  tagLabel: string
  submitLabel: string
  saving?: boolean
  onChange: (value: TechniqueEditState) => void
  onClose: () => void
  onSubmit: () => void
}

export default function TechniqueEditorModal({
  heading,
  value,
  categories,
  accentColor,
  submitBackground,
  tagLimit,
  tagLabel,
  submitLabel,
  saving = false,
  onChange,
  onClose,
  onSubmit,
}: TechniqueEditorModalProps) {
  const headingId = `technique-editor-${value.id ?? 'new'}`

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="bg-white rounded-t-3xl w-full max-w-lg p-6 pb-10 flex flex-col gap-4"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id={headingId} className="text-base font-semibold text-[#1A1A1A]">{heading}</h2>
          <button
            onClick={onClose}
            aria-label="关闭编辑"
            className="w-7 h-7 flex items-center justify-center rounded-full bg-[#F5F5F0] text-[#9B9B9B]"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <label className="block">
            <span className="block text-xs text-[#9B9B9B] mb-1">动作名称</span>
            <input
              type="text"
              placeholder="如：正手击球、发球动作"
              value={value.title}
              onChange={event => onChange({ ...value, title: event.target.value })}
              autoFocus
              className="w-full border border-[#E8E8E2] rounded-xl px-3 py-2.5 text-sm text-[#1A1A1A] outline-none focus:ring-2"
              style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
            />
          </label>
          <label className="block">
            <span className="block text-xs text-[#9B9B9B] mb-1">技巧说明</span>
            <textarea
              rows={5}
              placeholder="记录这个动作的要点、注意事项或教练指导…"
              value={value.content}
              onChange={event => onChange({ ...value, content: event.target.value })}
              className="w-full border border-[#E8E8E2] rounded-xl px-3 py-2.5 text-sm text-[#1A1A1A] outline-none focus:ring-2 resize-none"
              style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
            />
          </label>
          {categories.length > 0 && (
            <div>
              <p className="text-xs text-[#9B9B9B] mb-1.5">技术分类</p>
              <div className="flex flex-wrap gap-1.5">
                {categories.map(category => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => onChange({ ...value, category: value.category === category ? '' : category })}
                    className="px-3 py-1 rounded-full text-xs font-medium border transition"
                    style={value.category === category
                      ? { background: accentColor, color: '#fff', borderColor: accentColor }
                      : { background: 'white', color: '#6B7280', borderColor: '#E8E8E2' }
                    }
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          )}
          <label className="block">
            <span className="block text-xs text-[#9B9B9B] mb-1">{tagLabel}（最多{tagLimit}个，逗号分隔）</span>
            <input
              type="text"
              placeholder={tagLimit === 2 ? '如：转腰、随挥' : '如：转腰、随挥、节奏'}
              value={value.tags}
              onChange={event => onChange({ ...value, tags: event.target.value })}
              className="w-full border border-[#E8E8E2] rounded-xl px-3 py-2.5 text-sm text-[#1A1A1A] outline-none focus:ring-2"
              style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
            />
          </label>
        </div>
        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl border border-[#E8E8E2] text-sm text-[#6B7280] font-medium"
          >
            取消
          </button>
          <button
            onClick={onSubmit}
            disabled={saving || !value.title.trim() || !value.content.trim()}
            className="flex-1 py-3 rounded-2xl text-sm text-white font-medium disabled:opacity-40"
            style={{ background: submitBackground }}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
