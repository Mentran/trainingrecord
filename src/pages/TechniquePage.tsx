import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { getTechniques, saveTechnique, updateTechnique, deleteTechnique, getRecords } from '../lib/storage'
import { generateTechniques, parseExperienceText, hasApiKey, getGeneratedCache, setGeneratedCache, type GeneratedTechnique } from '../lib/ai'
import type { TechniqueNote } from '../types'
import PageHeader from '../components/PageHeader'
import { useSport } from '../components/SportProvider'

type Tab = 'user' | 'ai'

interface EditState {
  id?: string
  title: string
  content: string
  category: string
  tags: string
}

const EMPTY_EDIT: EditState = { title: '', content: '', category: '', tags: '' }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export default function TechniquePage() {
  const location = useLocation()
  const { sport } = useSport()
  const [tab, setTab] = useState<Tab>('user')
  const [notes, setNotes] = useState<TechniqueNote[]>([])
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState<GeneratedTechnique[]>(() => {
    const cache = getGeneratedCache(sport.id)
    return cache ? cache.items : []
  })
  const [collectingIdx, setCollectingIdx] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [edit, setEdit] = useState<EditState>(EMPTY_EDIT)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const reload = useCallback(() => {
    setNotes(getTechniques(sport.id))
  }, [sport.id])

  useEffect(() => { reload() }, [location.key, reload])

  useEffect(() => {
    const cache = getGeneratedCache(sport.id)
    setGenerated(cache ? cache.items : [])
    setCategoryFilter('')
  }, [sport.id])

  const categories = sport.categories ?? []
  const filteredNotes = categoryFilter
    ? notes.filter(n => n.category === categoryFilter)
    : notes

  async function handleGenerate() {
    setGenerating(true)
    try {
      const records = getRecords(sport.id)
      const result = await generateTechniques(records, sport.name)
      const next = [...result, ...generated.filter(g => !result.some(r => r.title === g.title))]
      setGenerated(next)
      setGeneratedCache(sport.id, next)
    } catch (e) {
      alert((e as Error).message ?? '生成失败，请重试')
    } finally {
      setGenerating(false)
    }
  }

  async function handleImport() {
    if (!importText.trim()) return
    setImporting(true)
    try {
      const result = await parseExperienceText(importText, sport.name)
      const next = [...result, ...generated.filter(g => !result.some(r => r.title === g.title))]
      setGenerated(next)
      setGeneratedCache(sport.id, next)
      setImportText('')
      setShowImport(false)
    } catch (e) {
      alert((e as Error).message ?? '解析失败，请重试')
    } finally {
      setImporting(false)
    }
  }

  function handleCollect(item: GeneratedTechnique, idx: number) {
    setCollectingIdx(idx)
    setTimeout(() => {
      saveTechnique({ sportId: sport.id, title: item.title, content: item.content, tags: item.tags, source: 'user', votes: 0 })
      const next = generated.filter((_, i) => i !== idx)
      setGenerated(next)
      setGeneratedCache(sport.id, next)
      setCollectingIdx(null)
      reload()
      setTab('user')
    }, 380)
  }

  function handleVote(id: string, current: number) {
    updateTechnique(id, { votes: current + 1 })
    reload()
  }

  function openNew() {
    setEdit(EMPTY_EDIT)
    setShowForm(true)
  }

  function openEdit(note: TechniqueNote) {
    setEdit({ id: note.id, title: note.title, content: note.content, category: note.category ?? '', tags: (note.tags ?? []).join('、') })
    setShowForm(true)
  }

  function handleSave() {
    if (!edit.title.trim() || !edit.content.trim()) return
    setSaving(true)
    const tags = edit.tags.split(/[,，、\s]+/).map(t => t.trim()).filter(Boolean).slice(0, 3)
    const category = edit.category || undefined
    if (edit.id) {
      updateTechnique(edit.id, { title: edit.title.trim(), content: edit.content.trim(), category, tags })
    } else {
      saveTechnique({ sportId: sport.id, title: edit.title.trim(), content: edit.content.trim(), category, tags, source: 'user', votes: 0 })
    }
    reload()
    setShowForm(false)
    setSaving(false)
  }

  function handleDelete(id: string) {
    if (!confirm('确认删除这条技巧笔记？')) return
    deleteTechnique(id)
    reload()
  }

  const headerBg = `linear-gradient(135deg, ${sport.color} 0%, ${sport.color}cc 100%)`

  return (
    <div className="pb-24">
      <PageHeader title="技巧库" />

      {/* Tab 切换 */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex rounded-2xl p-1 gap-1" style={{ background: '#F0F0EA' }}>
          {([['user', '我的总结'], ['ai', 'AI 草稿箱']] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => { setTab(key); setCategoryFilter('') }}
              className="flex-1 py-2 rounded-xl text-sm font-semibold transition"
              style={tab === key
                ? { background: sport.color, color: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }
                : { color: '#9B9B9B' }
              }
            >
              {label}
              {key === 'ai' && generated.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold"
                  style={{ background: tab === 'ai' ? 'rgba(255,255,255,0.3)' : sport.accentColor + '30', color: tab === 'ai' ? '#fff' : sport.accentColor }}>
                  {generated.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 我的总结 Tab */}
      {tab === 'user' && (
        <div className="px-4 pt-2">
          {/* 分类筛选 */}
          {categories.length > 0 && (
            <div className="flex gap-2 pb-3 overflow-x-auto scrollbar-none">
              <button onClick={() => setCategoryFilter('')}
                className="shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition"
                style={categoryFilter === ''
                  ? { background: sport.accentColor, color: '#fff', borderColor: sport.accentColor }
                  : { background: 'white', color: '#6B7280', borderColor: '#E8E8E2' }
                }>
                全部
              </button>
              {categories.map(c => (
                <button key={c} onClick={() => setCategoryFilter(c === categoryFilter ? '' : c)}
                  className="shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition"
                  style={categoryFilter === c
                    ? { background: sport.accentColor, color: '#fff', borderColor: sport.accentColor }
                    : { background: 'white', color: '#6B7280', borderColor: '#E8E8E2' }
                  }>
                  {c}
                </button>
              ))}
            </div>
          )}

          {notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl"
                style={{ background: sport.accentColor + '18' }}>📝</div>
              <p className="text-[#888] text-sm">还没有技巧总结</p>
              <p className="text-[#ADADAD] text-xs">手动记录，或从 AI 草稿箱收藏</p>
            </div>
          ) : filteredNotes.length > 0 ? (
            <NoteList notes={filteredNotes} sport={sport} expandedId={expandedId}
              onExpand={setExpandedId} onEdit={openEdit} onDelete={handleDelete} onVote={handleVote} />
          ) : (
            <p className="text-xs text-[#9B9B9B] text-center py-8">该分类下暂无技巧</p>
          )}
        </div>
      )}

      {/* AI 草稿箱 Tab */}
      {tab === 'ai' && (
        <div className="px-4 pt-2">
          {/* 操作按钮行 */}
          <div className="flex gap-2 mb-4">
            {hasApiKey() && (
              <button onClick={handleGenerate} disabled={generating}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition active:scale-95"
                style={{ background: headerBg, color: '#fff', opacity: generating ? 0.7 : 1 }}>
                {generating ? (
                  <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />分析中…</>
                ) : '✦ 分析训练记录'}
              </button>
            )}
            <button onClick={() => setShowImport(v => !v)}
              className="flex items-center gap-1.5 px-4 py-3 rounded-2xl text-sm font-semibold transition active:scale-95"
              style={showImport
                ? { background: sport.accentColor, color: '#fff' }
                : { background: '#F0F0EA', color: '#6B7280' }
              }>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M2 11.5h11M7.5 2v8M4.5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              导入经验
            </button>
          </div>

          {/* 经验导入面板 */}
          {showImport && (
            <div className="mb-4 bg-white rounded-2xl p-4 border border-[#F0F0EA] shadow-sm">
              <p className="text-xs text-[#9B9B9B] mb-2">粘贴教练指导或训练笔记，AI 自动整理为技巧条目</p>
              <textarea rows={5} placeholder="例如：今天教练说正手击球时要注意转腰，手腕要放松，随挥要充分…"
                value={importText} onChange={e => setImportText(e.target.value)}
                className="w-full border border-[#E8E8E2] rounded-xl px-3 py-2.5 text-sm text-[#1A1A1A] outline-none focus:ring-2 resize-none mb-3"
                style={{ '--tw-ring-color': sport.accentColor } as React.CSSProperties} />
              <div className="flex gap-2">
                <button onClick={() => { setShowImport(false); setImportText('') }}
                  className="flex-1 py-2 rounded-xl border border-[#E8E8E2] text-sm text-[#6B7280]">
                  取消
                </button>
                <button onClick={handleImport} disabled={importing || !importText.trim()}
                  className="flex-1 py-2 rounded-xl text-sm text-white font-medium disabled:opacity-40 flex items-center justify-center gap-1.5"
                  style={{ background: headerBg }}>
                  {importing ? (
                    <><span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />解析中…</>
                  ) : 'AI 解析'}
                </button>
              </div>
            </div>
          )}

          {/* 草稿列表 */}
          {generated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl"
                style={{ background: sport.accentColor + '18' }}>🤖</div>
              <p className="text-[#888] text-sm">草稿箱是空的</p>
              <p className="text-[#ADADAD] text-xs">分析训练记录或导入经验文字</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <p className="text-xs text-[#9B9B9B] font-medium">收藏后自动归入我的总结</p>
              {generated.map((item, i) => (
                <div key={i}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0F0EA] transition-all duration-300"
                  style={collectingIdx === i ? { opacity: 0, transform: 'scale(0.95) translateY(-6px)' } : { opacity: 1, transform: 'none' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1A1A1A]">{item.title}</p>
                      <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">{item.content}</p>
                      {item.tags?.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {item.tags.map(t => (
                            <span key={t} className="text-[10px] px-2 py-0.5 rounded-full"
                              style={{ background: sport.accentColor + '20', color: sport.accentColor }}>{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={() => handleCollect(item, i)} disabled={collectingIdx !== null}
                      className="shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl transition active:scale-95 disabled:opacity-50"
                      style={{ background: sport.accentColor + '18', color: sport.accentColor }}>
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M3 2h7a1 1 0 011 1v8.5l-4.5-2.5L2 11.5V3a1 1 0 011-1z"
                          stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                      </svg>
                      收藏
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 新建按钮（仅我的总结 Tab） */}
      {tab === 'user' && (
        <button onClick={openNew}
          className="fixed bottom-20 right-4 w-14 h-14 rounded-full flex items-center justify-center active:scale-90 transition-transform z-40"
          style={{ background: headerBg, boxShadow: `0 8px 24px ${sport.accentColor}55, 0 2px 8px rgba(0,0,0,0.15)` }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M11 4v14M4 11h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}

      {/* 新建/编辑表单 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 pb-10 flex flex-col gap-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#1A1A1A]">{edit.id ? '编辑技巧' : '新建技巧'}</h2>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 flex items-center justify-center rounded-full bg-[#F5F5F0] text-[#9B9B9B]">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-xs text-[#9B9B9B] mb-1">动作名称</p>
                <input type="text" placeholder="如：正手击球、发球动作"
                  value={edit.title} onChange={e => setEdit(v => ({ ...v, title: e.target.value }))}
                  autoFocus
                  className="w-full border border-[#E8E8E2] rounded-xl px-3 py-2.5 text-sm text-[#1A1A1A] outline-none focus:ring-2 focus:border-[#9DC41A]" />
              </div>
              <div>
                <p className="text-xs text-[#9B9B9B] mb-1">技巧说明</p>
                <textarea rows={5} placeholder="记录这个动作的要点、注意事项或教练指导…"
                  value={edit.content} onChange={e => setEdit(v => ({ ...v, content: e.target.value }))}
                  className="w-full border border-[#E8E8E2] rounded-xl px-3 py-2.5 text-sm text-[#1A1A1A] outline-none focus:ring-2 focus:border-[#9DC41A] resize-none" />
              </div>
              {categories.length > 0 && (
                <div>
                  <p className="text-xs text-[#9B9B9B] mb-1.5">技术分类</p>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map(c => (
                      <button key={c} type="button"
                        onClick={() => setEdit(v => ({ ...v, category: v.category === c ? '' : c }))}
                        className="px-3 py-1 rounded-full text-xs font-medium border transition"
                        style={edit.category === c
                          ? { background: sport.accentColor, color: '#fff', borderColor: sport.accentColor }
                          : { background: 'white', color: '#6B7280', borderColor: '#E8E8E2' }
                        }>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs text-[#9B9B9B] mb-1">细节标签（最多3个，逗号分隔）</p>
                <input type="text" placeholder="如：转腰、随挥、节奏"
                  value={edit.tags} onChange={e => setEdit(v => ({ ...v, tags: e.target.value }))}
                  className="w-full border border-[#E8E8E2] rounded-xl px-3 py-2.5 text-sm text-[#1A1A1A] outline-none focus:ring-2 focus:border-[#9DC41A]" />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-3 rounded-2xl border border-[#E8E8E2] text-sm text-[#6B7280] font-medium">
                取消
              </button>
              <button onClick={handleSave} disabled={saving || !edit.title.trim() || !edit.content.trim()}
                className="flex-1 py-3 rounded-2xl text-sm text-white font-medium disabled:opacity-40"
                style={{ background: headerBg }}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── NoteList 子组件 ──────────────────────────────────────

interface NoteListProps {
  notes: TechniqueNote[]
  sport: { accentColor: string; color: string; categories?: string[] }
  expandedId: string | null
  onExpand: (id: string | null) => void
  onEdit?: (note: TechniqueNote) => void
  onDelete: (id: string) => void
  onVote: (id: string, current: number) => void
}

function NoteList({ notes, sport, expandedId, onExpand, onEdit, onDelete, onVote }: NoteListProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {notes.map(note => {
        const expanded = expandedId === note.id
        return (
          <div key={note.id} className="bg-white rounded-2xl shadow-sm border border-[#F0F0EA] overflow-hidden">
            <div className="px-4 pt-3.5 pb-3">
              {/* 标题行 */}
              <div className="flex items-start gap-2">
                <button className="flex-1 min-w-0 text-left" onClick={() => onExpand(expanded ? null : note.id)}>
                  <p className="text-sm font-semibold text-[#1A1A1A]">{note.title}</p>
                  <p className={`text-xs text-[#6B7280] mt-1 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
                    {note.content}
                  </p>
                </button>
                {/* 爱心按钮 */}
                <button
                  onClick={() => onVote(note.id, note.votes ?? 0)}
                  className="shrink-0 flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition active:scale-90"
                  style={{ background: (note.votes ?? 0) > 0 ? '#FF4D6D18' : '#F5F5F0' }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 12S1.5 8.5 1.5 4.5a2.5 2.5 0 015 0 2.5 2.5 0 015 0C12.5 8.5 7 12 7 12z"
                      stroke={(note.votes ?? 0) > 0 ? '#FF4D6D' : '#ADADAD'}
                      strokeWidth="1.2" strokeLinejoin="round"
                      fill={(note.votes ?? 0) > 0 ? '#FF4D6D' : 'none'} />
                  </svg>
                  <span className="text-[10px] font-semibold leading-none"
                    style={{ color: (note.votes ?? 0) > 0 ? '#FF4D6D' : '#ADADAD' }}>
                    {note.votes ?? 0}
                  </span>
                </button>
              </div>

              {/* 分类 + 标签 + 时间 */}
              <div className="flex items-center justify-between mt-2 gap-2">
                <div className="flex gap-1 flex-wrap flex-1 min-w-0">
                  {note.category && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: sport.accentColor + '30', color: sport.accentColor }}>{note.category}</span>
                  )}
                  {(note.tags ?? []).map(t => (
                    <span key={t} className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: '#F0F0EA', color: '#6B7280' }}>{t}</span>
                  ))}
                </div>
                <span className="text-[10px] text-[#ADADAD] shrink-0">{formatDate(note.createdAt)}</span>
              </div>
            </div>

            {/* 展开操作栏 */}
            {expanded && (
              <div className="px-4 pb-3 flex gap-2 border-t border-[#F5F5F0] pt-2.5">
                {onEdit && (
                  <button onClick={() => onEdit(note)}
                    className="flex-1 py-2 rounded-xl text-xs font-medium border border-[#E8E8E2] text-[#6B7280]">
                    编辑
                  </button>
                )}
                <button onClick={() => onDelete(note.id)}
                  className="py-2 px-3 rounded-xl text-xs font-medium text-red-400 border border-red-100">
                  删除
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
