import { useMemo, useState } from 'react'
import { auditTechniques, type DuplicateTechniqueGroup } from '../../lib/techniqueMaintenance'
import type { Sport, TechniqueNote } from '../../types'
import TechniqueMaintenancePanel from './TechniqueMaintenancePanel'

type SortMode = 'time' | 'votes'

interface TechniqueLibrarySectionProps {
  notes: TechniqueNote[]
  sport: Sport
  onEdit: (note: TechniqueNote) => void
  onDelete: (id: string) => void
  onVote: (id: string, current: number) => void
  onMerge: (group: DuplicateTechniqueGroup) => void
}

export default function TechniqueLibrarySection({
  notes,
  sport,
  onEdit,
  onDelete,
  onVote,
  onMerge,
}: TechniqueLibrarySectionProps) {
  const [categoryFilter, setCategoryFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortMode>('time')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const categories = sport.categories
  const audit = useMemo(() => auditTechniques(notes, categories), [categories, notes])

  const filteredNotes = useMemo(() => notes
    .filter(note => !categoryFilter || note.category === categoryFilter)
    .filter(note => {
      const query = searchQuery.trim().toLowerCase()
      if (!query) return true
      return note.title.toLowerCase().includes(query)
        || note.content.toLowerCase().includes(query)
        || (note.tags ?? []).some(tag => tag.toLowerCase().includes(query))
    })
    .sort((a, b) => sortBy === 'votes'
      ? (b.votes ?? 0) - (a.votes ?? 0)
        || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ), [categoryFilter, notes, searchQuery, sortBy])

  return (
    <div className="px-4 pt-2">
      {categories.length > 0 && (
        <div className="flex gap-2 pb-3 overflow-x-auto scrollbar-none">
          <FilterButton
            active={!categoryFilter}
            label="全部"
            count={notes.length}
            color={sport.accentColor}
            onClick={() => setCategoryFilter('')}
          />
          {categories.map(category => (
            <FilterButton
              key={category}
              active={categoryFilter === category}
              label={category}
              count={notes.filter(note => note.category === category).length}
              color={sport.accentColor}
              onClick={() => setCategoryFilter(current => current === category ? '' : category)}
            />
          ))}
        </div>
      )}

      {notes.length > 0 && (
        <TechniqueMaintenancePanel
          audit={audit}
          accentColor={sport.accentColor}
          onMerge={onMerge}
        />
      )}

      {notes.length > 0 && (
        <div className="flex gap-2 mb-3">
          <label className="flex-1 relative">
            <span className="sr-only">搜索技巧</span>
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#ADADAD]" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="搜索技巧…"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#E8E8E2] bg-white text-sm text-[#1A1A1A] outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': sport.accentColor + '60' } as React.CSSProperties}
            />
          </label>
          <button
            onClick={() => setSortBy(current => current === 'time' ? 'votes' : 'time')}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition"
            style={sortBy === 'votes'
              ? { background: sport.accentColor + '18', color: sport.accentColor, borderColor: sport.accentColor + '40' }
              : { background: 'white', color: '#6B7280', borderColor: '#E8E8E2' }
            }
          >
            {sortBy === 'votes' ? (
              <>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d="M7 12S1.5 8.5 1.5 4.5a2.5 2.5 0 015 0 2.5 2.5 0 015 0C12.5 8.5 7 12 7 12z" stroke="currentColor" strokeWidth="1.3" fill="currentColor" strokeLinejoin="round"/>
                </svg>
                爱心
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M2 3h9M2 6.5h6M2 10h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                时间
              </>
            )}
          </button>
        </div>
      )}

      {notes.length === 0 ? (
        <EmptyState color={sport.accentColor} icon="📝" title="还没有技巧总结" hint="手动记录，或从 AI 草稿箱收藏" />
      ) : filteredNotes.length > 0 ? (
        <NoteList
          notes={filteredNotes}
          accentColor={sport.accentColor}
          expandedId={expandedId}
          onExpand={setExpandedId}
          onEdit={onEdit}
          onDelete={onDelete}
          onVote={onVote}
        />
      ) : (
        <p className="text-xs text-[#9B9B9B] text-center py-8">
          {searchQuery.trim() ? `未找到"${searchQuery.trim()}"相关技巧` : '该分类下暂无技巧'}
        </p>
      )}
    </div>
  )
}

interface FilterButtonProps {
  active: boolean
  label: string
  count: number
  color: string
  onClick: () => void
}

function FilterButton({ active, label, count, color, onClick }: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition"
      style={active
        ? { background: color, color: '#fff', borderColor: color }
        : { background: 'white', color: '#6B7280', borderColor: '#E8E8E2' }
      }
    >
      {label}{count > 0 && <span className="opacity-70 ml-0.5">{count}</span>}
    </button>
  )
}

interface NoteListProps {
  notes: TechniqueNote[]
  accentColor: string
  expandedId: string | null
  onExpand: (id: string | null) => void
  onEdit: (note: TechniqueNote) => void
  onDelete: (id: string) => void
  onVote: (id: string, current: number) => void
}

function NoteList({ notes, accentColor, expandedId, onExpand, onEdit, onDelete, onVote }: NoteListProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {notes.map(note => {
        const expanded = expandedId === note.id
        return (
          <article key={note.id} className="bg-white rounded-2xl shadow-sm border border-[#F0F0EA] overflow-hidden">
            <div className="px-4 pt-3.5 pb-3">
              <div className="flex items-start gap-2">
                <button className="flex-1 min-w-0 text-left" onClick={() => onExpand(expanded ? null : note.id)}>
                  <p className="text-sm font-semibold text-[#1A1A1A]">{note.title}</p>
                  <p className={`text-xs text-[#6B7280] mt-1 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
                    {note.content}
                  </p>
                </button>
                <button
                  onClick={() => onVote(note.id, note.votes ?? 0)}
                  aria-label={`喜欢 ${note.title}`}
                  className="shrink-0 flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition active:scale-90"
                  style={{ background: (note.votes ?? 0) > 0 ? '#FF4D6D18' : '#F5F5F0' }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M7 12S1.5 8.5 1.5 4.5a2.5 2.5 0 015 0 2.5 2.5 0 015 0C12.5 8.5 7 12 7 12z"
                      stroke={(note.votes ?? 0) > 0 ? '#FF4D6D' : '#ADADAD'}
                      strokeWidth="1.2"
                      strokeLinejoin="round"
                      fill={(note.votes ?? 0) > 0 ? '#FF4D6D' : 'none'}
                    />
                  </svg>
                  <span
                    className="text-[10px] font-semibold leading-none"
                    style={{ color: (note.votes ?? 0) > 0 ? '#FF4D6D' : '#ADADAD' }}
                  >
                    {note.votes ?? 0}
                  </span>
                </button>
              </div>
              <div className="flex items-center justify-between mt-2 gap-2">
                <div className="flex gap-1 flex-wrap flex-1 min-w-0">
                  {note.category && (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: accentColor + '30', color: accentColor }}
                    >
                      {note.category}
                    </span>
                  )}
                  {(note.tags ?? []).map(tag => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-[#F0F0EA] text-[#6B7280]">
                      {tag}
                    </span>
                  ))}
                </div>
                <time className="text-[10px] text-[#ADADAD] shrink-0" dateTime={note.createdAt}>
                  {formatDate(note.createdAt)}
                </time>
              </div>
            </div>
            {expanded && (
              <div className="px-4 pb-3 flex gap-2 border-t border-[#F5F5F0] pt-2.5">
                <button
                  onClick={() => onEdit(note)}
                  className="flex-1 py-2 rounded-xl text-xs font-medium border border-[#E8E8E2] text-[#6B7280]"
                >
                  编辑
                </button>
                <button
                  onClick={() => onDelete(note.id)}
                  className="py-2 px-3 rounded-xl text-xs font-medium text-red-400 border border-red-100"
                >
                  删除
                </button>
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function EmptyState({ color, icon, title, hint }: { color: string; icon: string; title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl" style={{ background: color + '18' }}>
        {icon}
      </div>
      <p className="text-[#888] text-sm">{title}</p>
      <p className="text-[#ADADAD] text-xs">{hint}</p>
    </div>
  )
}
