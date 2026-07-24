import { useState } from 'react'
import { generateTechniques, hasApiKey, parseExperienceText, type GeneratedTechnique } from '../../lib/ai'
import { getRecords } from '../../lib/storage'
import type { Sport } from '../../types'

interface AIDraftsSectionProps {
  sport: Sport
  items: GeneratedTechnique[]
  collectingIndex: number | null
  onItemsChange: (items: GeneratedTechnique[]) => void
  onCollect: (item: GeneratedTechnique, index: number) => void
  onEdit: (item: GeneratedTechnique, index: number) => void
}

export default function AIDraftsSection({
  sport,
  items,
  collectingIndex,
  onItemsChange,
  onCollect,
  onEdit,
}: AIDraftsSectionProps) {
  const [generating, setGenerating] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const categories = sport.categories ?? []
  const headerBackground = `linear-gradient(135deg, ${sport.color} 0%, ${sport.color}cc 100%)`

  async function handleGenerate() {
    setGenerating(true)
    try {
      const result = await generateTechniques(getRecords(sport.id), sport.name, categories)
      onItemsChange(mergeDrafts(result, items))
    } catch (error) {
      alert((error as Error).message ?? '生成失败，请重试')
    } finally {
      setGenerating(false)
    }
  }

  async function handleImport() {
    if (!importText.trim()) return
    setImporting(true)
    try {
      const result = await parseExperienceText(importText, sport.name, categories)
      onItemsChange(mergeDrafts(result, items))
      setImportText('')
      setShowImport(false)
    } catch (error) {
      alert((error as Error).message ?? '解析失败，请重试')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="px-4 pt-2">
      <div className="flex gap-2 mb-4">
        {hasApiKey() && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex-1 py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition active:scale-95"
            style={{ background: headerBackground, color: '#fff', opacity: generating ? 0.7 : 1 }}
          >
            {generating ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                分析中…
              </>
            ) : '✦ 分析训练记录'}
          </button>
        )}
        <button
          onClick={() => setShowImport(value => !value)}
          className="flex items-center gap-1.5 px-4 py-3 rounded-2xl text-sm font-semibold transition active:scale-95"
          style={showImport
            ? { background: sport.accentColor, color: '#fff' }
            : { background: '#F0F0EA', color: '#6B7280' }
          }
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M2 11.5h11M7.5 2v8M4.5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          导入经验
        </button>
      </div>

      {showImport && (
        <div className="mb-4 bg-white rounded-2xl p-4 border border-[#F0F0EA] shadow-sm">
          <label className="block">
            <span className="block text-xs text-[#9B9B9B] mb-2">粘贴教练指导或训练笔记，AI 自动整理为技巧条目</span>
            <textarea
              rows={5}
              placeholder="例如：今天教练说正手击球时要注意转腰，手腕要放松，随挥要充分…"
              value={importText}
              onChange={event => setImportText(event.target.value)}
              className="w-full border border-[#E8E8E2] rounded-xl px-3 py-2.5 text-sm text-[#1A1A1A] outline-none focus:ring-2 resize-none mb-3"
              style={{ '--tw-ring-color': sport.accentColor } as React.CSSProperties}
            />
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowImport(false)
                setImportText('')
              }}
              className="flex-1 py-2 rounded-xl border border-[#E8E8E2] text-sm text-[#6B7280]"
            >
              取消
            </button>
            <button
              onClick={handleImport}
              disabled={importing || !importText.trim()}
              className="flex-1 py-2 rounded-xl text-sm text-white font-medium disabled:opacity-40 flex items-center justify-center gap-1.5"
              style={{ background: headerBackground }}
            >
              {importing ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  解析中…
                </>
              ) : 'AI 解析'}
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div
            className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl"
            style={{ background: sport.accentColor + '18' }}
          >
            🤖
          </div>
          <p className="text-[#888] text-sm">草稿箱是空的</p>
          <p className="text-[#ADADAD] text-xs">分析训练记录或导入经验文字</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <p className="text-xs text-[#9B9B9B] font-medium">收藏后自动归入我的总结</p>
          {items.map((item, index) => (
            <article
              key={`${item.title}-${index}`}
              className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0F0EA] transition-all duration-300"
              style={collectingIndex === index
                ? { opacity: 0, transform: 'scale(0.95) translateY(-6px)' }
                : { opacity: 1, transform: 'none' }
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1A1A1A]">{item.title}</p>
                  <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">{item.content}</p>
                  {(item.category || item.tags?.length > 0) && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {item.category && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background: sport.accentColor + '30', color: sport.accentColor }}
                        >
                          {item.category}
                        </span>
                      )}
                      {(item.tags ?? []).map(tag => (
                        <span
                          key={tag}
                          className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{ background: sport.accentColor + '20', color: sport.accentColor }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="shrink-0 flex flex-col gap-1.5">
                  <button
                    onClick={() => onEdit(item, index)}
                    disabled={collectingIndex !== null}
                    className="flex items-center justify-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl border transition active:scale-95 disabled:opacity-50"
                    style={{ borderColor: sport.accentColor + '40', color: sport.accentColor, background: '#fff' }}
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => onCollect(item, index)}
                    disabled={collectingIndex !== null}
                    className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl transition active:scale-95 disabled:opacity-50"
                    style={{ background: sport.accentColor + '18', color: sport.accentColor }}
                  >
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <path d="M3 2h7a1 1 0 011 1v8.5l-4.5-2.5L2 11.5V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                    </svg>
                    收藏
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function mergeDrafts(incoming: GeneratedTechnique[], existing: GeneratedTechnique[]): GeneratedTechnique[] {
  return [...incoming, ...existing.filter(item => !incoming.some(next => next.title === item.title))]
}
