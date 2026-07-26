import { useState } from 'react'
import type { DuplicateTechniqueGroup, TechniqueAudit } from '../../lib/techniqueMaintenance'

interface TechniqueMaintenancePanelProps {
  audit: TechniqueAudit
  accentColor: string
  onMerge: (group: DuplicateTechniqueGroup) => void
}

export default function TechniqueMaintenancePanel({
  audit,
  accentColor,
  onMerge,
}: TechniqueMaintenancePanelProps) {
  const [open, setOpen] = useState(false)
  const issueCount = audit.duplicateGroups.length
    + audit.uncategorizedCount
    + audit.emptyCategories.length
  if (issueCount === 0) return null

  return (
    <div className="mb-3 rounded-2xl border border-[#E8E8E2] bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        className="w-full px-3.5 py-3 flex items-center gap-2 text-left"
      >
        <span className="text-lg" aria-hidden="true">🧹</span>
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-semibold text-[#1A1A1A]">整理建议</span>
          <span className="block text-[11px] text-[#9B9B9B] mt-0.5">
            {audit.duplicateGroups.length} 组可能重复
            {audit.uncategorizedCount > 0 ? ` · ${audit.uncategorizedCount} 条未分类` : ''}
            {audit.emptyCategories.length > 0 ? ` · ${audit.emptyCategories.length} 个空分类` : ''}
          </span>
        </span>
        <svg
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
        >
          <path d="M5 7.5l5 5 5-5" stroke="#9B9B9B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-[#F0F0EA] px-3.5 py-3 flex flex-col gap-3">
          {audit.duplicateGroups.map(group => (
            <div key={group.id} className="rounded-xl bg-[#FAFAF7] p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-[#9B9B9B]">
                  {group.reason} · {group.notes.length} 条
                </span>
                <button
                  type="button"
                  onClick={() => onMerge(group)}
                  className="text-xs font-semibold"
                  style={{ color: accentColor }}
                >
                  合并这组
                </button>
              </div>
              <p className="text-xs text-[#6B7280] leading-relaxed">
                {group.notes.map(note => note.title).join(' · ')}
              </p>
              <p className="text-[11px] text-[#9B9B9B] mt-1">
                建议保留“{group.plan.title}”，正文、标签和点赞会合并
              </p>
            </div>
          ))}

          {audit.uncategorizedCount > 0 && (
            <div className="rounded-xl px-3 py-2.5 bg-[#FFF8E8] text-xs text-[#8A6720] leading-relaxed">
              有 {audit.uncategorizedCount} 条技巧未正确分类，可展开对应卡片后编辑分类。
            </div>
          )}

          {audit.emptyCategories.length > 0 && (
            <div className="rounded-xl px-3 py-2.5 bg-[#F5F5F0] text-xs text-[#6B7280] leading-relaxed">
              暂无内容的分类：{audit.emptyCategories.join('、')}。后续生成技巧时会优先提示补充缺口。
            </div>
          )}
        </div>
      )}
    </div>
  )
}
