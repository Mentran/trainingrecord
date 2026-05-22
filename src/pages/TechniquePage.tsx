import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { getTechniques, saveTechnique, updateTechnique, deleteTechnique, getRecords } from '../lib/storage'
import { generateTechniques, hasApiKey, getGeneratedCache, setGeneratedCache, type GeneratedTechnique } from '../lib/ai'
import type { TechniqueNote } from '../types'
import PageHeader from '../components/PageHeader'
import { useSport } from '../components/SportProvider'

type Tab = 'ai' | 'user'

interface EditState {
  id?: string
  title: string
  content: string
  tags: string
}

const EMPTY_EDIT: EditState = { title: '', content: '', tags: '' }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export default function TechniquePage() {
  const location = useLocation()
  const { sport } = useSport()
  const [tab, setTab] = useState<Tab>('ai')
  const [notes, setNotes] = useState<TechniqueNote[]>([])
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState<GeneratedTechnique[]>(() => {
    const cache = getGeneratedCache(sport.id)
    return cache ? cache.items : []
  })
  const [showForm, setShowForm] = useState(false)
  const [edit, setEdit] = useState<EditState>(EMPTY_EDIT)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tagFilter, setTagFilter] = useState<string>('')

  const reload = useCallback(() => {
    setNotes(getTechniques(sport.id))
  }, [sport.id])

  useEffect(() => { reload() }, [location.key, reload])

  // reset cache when sport changes
  useEffect(() => {
    const cache = getGeneratedCache(sport.id)
    setGenerated(cache ? cache.items : [])
    setTagFilter('')
  }, [sport.id])

  const aiNotes = notes.filter(n => n.source === 'ai')
  const userNotes = notes.filter(n => n.source === 'user')

  // all tags for current tab
  const currentNotes = tab === 'ai' ? aiNotes : userNotes
  const allTags = Array.from(new Set(currentNotes.flatMap(n => n.tags ?? [])))
  const filteredNotes = tagFilter
    ? currentNotes.filter(n => (n.tags ?? []).includes(tagFilter))
    : currentNotes

  async function handleGenerate() {
    setGenerating(true)
    try {
      const records = getRecords(sport.id)
      const result = await generateTechniques(records, sport.name)
      setGenerated(result)
      setGeneratedCache(sport.id, result)
    } catch (e) {
      alert((e as Error).message ?? '生成失败，请重试')
    } finally {
      setGenerating(false)
    }
  }

  function handleCollect(item: GeneratedTechnique) {
    saveTechnique({ sportId: sport.id, title: item.title, content: item.content, tags: item.tags, source: 'ai', votes: 0 })
    reload()
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
    setEdit({ id: note.id, title: note.title, content: note.content, tags: (note.tags ?? []).join('、') })
    setShowForm(true)
  }

  function handleSave() {
    if (!edit.title.trim() || !edit.content.trim()) return
    setSaving(true)
    const tags = edit.tags.split(/[,，、\s]+/).map(t => t.trim()).filter(Boolean)
    if (edit.id) {
      updateTechnique(edit.id, { title: edit.title.trim(), content: edit.content.trim(), tags })
    } else {
      saveTechnique({ sportId: sport.id, title: edit.title.trim(), content: edit.content.trim(), tags, source: 'user', votes: 0 })
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

  function convertToUser(note: TechniqueNote) {
    updateTechnique(note.id, { source: 'user' })
    reload()
    setTab('user')
  }

  const headerBg = `linear-gradient(135deg, ${sport.color} 0%, ${sport.color}cc 100%)`

  return (
    <div className="pb-24">
      <PageHeader title="技巧库" />

      {/* Tab 切换 */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex rounded-2xl p-1 gap-1" style={{ background: '#F0F0EA' }}>
          {([['ai', 'AI 生成'], ['user', '我的总结']] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => { setTab(key); setTagFilter('') }}
              className="flex-1 py-2 rounded-xl text-sm font-semibold transition"
              style={tab === key
                ? { background: sport.color, color: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }
                : { color: '#9B9B9B' }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 标签筛选 */}
      {allTags.length > 0 && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setTagFilter('')}
            className="shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition"
            style={tagFilter === ''
              ? { background: sport.accentColor, color: '#fff', borderColor: sport.accentColor }
              : { background: 'white', color: '#6B7280', borderColor: '#E8E8E2' }
            }
          >
            全部
          </button>
          {allTags.map(t => (
            <button key={t}
              onClick={() => setTagFilter(t === tagFilter ? '' : t)}
              className="shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition"
              style={tagFilter === t
                ? { background: sport.accentColor, color: '#fff', borderColor: sport.accentColor }
                : { background: 'white', color: '#6B7280', borderColor: '#E8E8E2' }
              }
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* AI 生成 Tab */}
      {tab === 'ai' && (
        <div className="px-4 pt-2">
          {hasApiKey() && (
            <button onClick={handleGenerate} disabled={generating}
              className="w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 mb-4 transition active:scale-95"
              style={{ background: headerBg, color: '#fff', opacity: generating ? 0.7 : 1 }}>
              {generating ? (
                <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />AI 分析中…</>
              ) : generated.length > 0 ? '✦ 重新生成' : '✦ 分析训练记录，生成技巧'}
            </button>
          )}

          {/* 本次生成结果 */}
          {generated.length > 0 && (
            <div className="mb-5">
              <p className="text-xs text-[#9B9B9B] mb-2 font-medium">生成结果 — 点击收藏到技巧库</p>
              <div className="flex flex-col gap-2.5">
                {generated.map((item, i) => {
                  const collected = notes.some(n => n.title === item.title && n.source === 'ai')
                  return (
                    <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0F0EA]">
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
                        {collected ? (
                          <span className="text-xs font-medium shrink-0 mt-0.5" style={{ color: sport.accentColor }}>已收藏</span>
                        ) : (
                          <button onClick={() => handleCollect(item)}
                            className="shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl transition active:scale-95"
                            style={{ background: sport.accentColor + '20', color: sport.accentColor }}>
                            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                              <path d="M5.5 1.5l1.18 2.39 2.64.38-1.91 1.86.45 2.63L5.5 7.5 3.14 8.76l.45-2.63L1.68 4.27l2.64-.38L5.5 1.5z"
                                stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                            </svg>
                            收藏
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 已收藏的 AI 笔记 */}
          {aiNotes.length === 0 && generated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl"
                style={{ background: sport.accentColor + '18' }}>🤖</div>
              <p className="text-[#888] text-sm">还没有 AI 生成的技巧</p>
              <p className="text-[#ADADAD] text-xs">点击上方按钮，AI 将分析你的训练记录</p>
            </div>
          ) : filteredNotes.length > 0 ? (
            <>
              {tagFilter && <p className="text-xs text-[#9B9B9B] mb-2">已收藏的技巧</p>}
              <NoteList notes={filteredNotes} sport={sport} expandedId={expandedId}
                onExpand={setExpandedId} onConvert={convertToUser} onDelete={handleDelete}
                onVote={handleVote} showConvert />
            </>
          ) : (
            <p className="text-xs text-[#9B9B9B] text-center py-8">该标签下暂无技巧</p>
          )}
        </div>
      )}

      {/* 我的总结 Tab */}
      {tab === 'user' && (
        <div className="px-4 pt-2">
          {userNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl"
                style={{ background: sport.accentColor + '18' }}>📝</div>
              <p className="text-[#888] text-sm">还没有个人总结</p>
              <p className="text-[#ADADAD] text-xs">点击右下角按钮，记录你的技巧心得</p>
            </div>
          ) : filteredNotes.length > 0 ? (
            <NoteList notes={filteredNotes} sport={sport} expandedId={expandedId}
              onExpand={setExpandedId} onEdit={openEdit} onDelete={handleDelete} onVote={handleVote} />
          ) : (
            <p className="text-xs text-[#9B9B9B] text-center py-8">该标签下暂无技巧</p>
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
              <div>
                <p className="text-xs text-[#9B9B9B] mb-1">标签（逗号或空格分隔）</p>
                <input type="text" placeholder="如：正手、技术、步伐"
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
  sport: { accentColor: string; color: string }
  expandedId: string | null
  onExpand: (id: string | null) => void
  onConvert?: (note: TechniqueNote) => void
  onEdit?: (note: TechniqueNote) => void
  onDelete: (id: string) => void
  onVote: (id: string, current: number) => void
  showConvert?: boolean
}

function NoteList({ notes, sport, expandedId, onExpand, onConvert, onEdit, onDelete, onVote, showConvert }: NoteListProps) {
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
                {/* +1 按钮 */}
                <button
                  onClick={() => onVote(note.id, note.votes ?? 0)}
                  className="shrink-0 flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition active:scale-90"
                  style={{ background: (note.votes ?? 0) > 0 ? sport.accentColor + '15' : '#F5F5F0' }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1.5l1.03 2.09 2.3.33-1.67 1.63.4 2.3L6 6.75 3.94 7.85l.4-2.3L2.67 3.92l2.3-.33L6 1.5z"
                      stroke={sport.accentColor} strokeWidth="1.1" strokeLinejoin="round"
                      fill={(note.votes ?? 0) > 0 ? sport.accentColor : 'none'} />
                  </svg>
                  <span className="text-[10px] font-semibold leading-none"
                    style={{ color: (note.votes ?? 0) > 0 ? sport.accentColor : '#ADADAD' }}>
                    {note.votes ?? 0}
                  </span>
                </button>
              </div>

              {/* 标签 + 时间 */}
              <div className="flex items-center justify-between mt-2 gap-2">
                <div className="flex gap-1 flex-wrap flex-1 min-w-0">
                  {(note.tags ?? []).map(t => (
                    <span key={t} className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: sport.accentColor + '20', color: sport.accentColor }}>{t}</span>
                  ))}
                </div>
                <span className="text-[10px] text-[#ADADAD] shrink-0">{formatDate(note.createdAt)}</span>
              </div>
            </div>

            {/* 展开操作栏 */}
            {expanded && (
              <div className="px-4 pb-3 flex gap-2 border-t border-[#F5F5F0] pt-2.5">
                {showConvert && onConvert && (
                  <button onClick={() => onConvert(note)}
                    className="flex-1 py-2 rounded-xl text-xs font-medium border transition"
                    style={{ borderColor: sport.accentColor + '60', color: sport.accentColor, background: sport.accentColor + '10' }}>
                    收藏到我的总结
                  </button>
                )}
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
