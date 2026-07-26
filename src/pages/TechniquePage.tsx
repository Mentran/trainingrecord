import { useState } from 'react'
import { deleteTechnique, mergeTechniques, saveTechnique, updateTechnique } from '../lib/storage'
import { getGeneratedCache, setGeneratedCache, type GeneratedTechnique } from '../lib/ai'
import type { DuplicateTechniqueGroup } from '../lib/techniqueMaintenance'
import type { Sport, TechniqueNote } from '../types'
import PageHeader from '../components/PageHeader'
import AIDraftsSection from '../components/techniques/AIDraftsSection'
import TechniqueEditorModal, { type TechniqueEditState } from '../components/techniques/TechniqueEditorModal'
import TechniqueLibrarySection from '../components/techniques/TechniqueLibrarySection'
import { useSport } from '../contexts/SportContext'
import { useToast } from '../contexts/ToastContext'
import { useTechniques } from '../hooks/useLocalData'

type Tab = 'user' | 'ai'

interface DraftEditState {
  index: number
  value: TechniqueEditState
}

const EMPTY_EDIT: TechniqueEditState = {
  title: '',
  content: '',
  category: '',
  tags: '',
}

export default function TechniquePage() {
  const { sport } = useSport()
  return <TechniquePageForSport key={sport.id} sport={sport} />
}

function TechniquePageForSport({ sport }: { sport: Sport }) {
  const { showToast } = useToast()
  const [tab, setTab] = useState<Tab>('user')
  const notes = useTechniques(sport.id)
  const [generated, setGenerated] = useState<GeneratedTechnique[]>(() => getGeneratedCache(sport.id)?.items ?? [])
  const [collectingIndex, setCollectingIndex] = useState<number | null>(null)
  const [edit, setEdit] = useState<TechniqueEditState | null>(null)
  const [draftEdit, setDraftEdit] = useState<DraftEditState | null>(null)
  const categories = sport.categories ?? []
  const headerBackground = `linear-gradient(135deg, ${sport.color} 0%, ${sport.color}cc 100%)`

  function updateGenerated(items: GeneratedTechnique[]) {
    setGenerated(items)
    setGeneratedCache(sport.id, items)
  }

  function handleCollect(item: GeneratedTechnique, index: number) {
    setCollectingIndex(index)
    setTimeout(() => {
      saveTechnique({
        sportId: sport.id,
        title: item.title,
        content: item.content,
        category: item.category ?? categories[0],
        tags: normalizeDraftTags(item.tags ?? []),
        source: 'ai',
        votes: 0,
      })
      setGenerated(current => {
        const next = current.filter(draft => draft.title !== item.title)
        setGeneratedCache(sport.id, next)
        return next
      })
      setCollectingIndex(null)
      setTab('user')
    }, 380)
  }

  function openDraftEdit(item: GeneratedTechnique, index: number) {
    setDraftEdit({
      index,
      value: {
        title: item.title,
        content: item.content,
        category: item.category ?? '',
        tags: (item.tags ?? []).join('、'),
      },
    })
  }

  function saveDraftEdit() {
    if (!draftEdit || !draftEdit.value.title.trim() || !draftEdit.value.content.trim()) return
    const next = generated.map((item, index) => index === draftEdit.index
      ? {
          ...item,
          title: draftEdit.value.title.trim(),
          content: draftEdit.value.content.trim(),
          category: draftEdit.value.category || categories[0],
          tags: normalizeDraftTags(draftEdit.value.tags.split(/[,，、\s]+/)),
        }
      : item
    )
    updateGenerated(next)
    setDraftEdit(null)
  }

  function openEdit(note: TechniqueNote) {
    setEdit({
      id: note.id,
      title: note.title,
      content: note.content,
      category: note.category ?? '',
      tags: (note.tags ?? []).join('、'),
    })
  }

  function handleSave() {
    if (!edit || !edit.title.trim() || !edit.content.trim()) return
    const tags = edit.tags
      .split(/[,，、\s]+/)
      .map(tag => tag.trim())
      .filter(Boolean)
      .slice(0, 3)
    const category = edit.category || undefined
    if (edit.id) {
      updateTechnique(edit.id, {
        title: edit.title.trim(),
        content: edit.content.trim(),
        category,
        tags,
      })
    } else {
      saveTechnique({
        sportId: sport.id,
        title: edit.title.trim(),
        content: edit.content.trim(),
        category,
        tags,
        source: 'user',
        votes: 0,
      })
    }
    setEdit(null)
  }

  function handleDelete(id: string) {
    if (!confirm('确认删除这条技巧笔记？')) return
    deleteTechnique(id)
  }

  function handleVote(id: string, current: number) {
    updateTechnique(id, { votes: current + 1 })
  }

  function handleMerge(group: DuplicateTechniqueGroup) {
    const confirmed = confirm(
      `确认将这 ${group.notes.length} 条技巧合并为“${group.plan.title}”？\n\n正文、标签和点赞会保留到合并后的技巧中。`
    )
    if (!confirmed) return
    const merged = mergeTechniques(group.plan)
    if (!merged) {
      showToast('合并失败，技巧数据可能已发生变化')
      return
    }
    showToast(`已合并 ${group.notes.length} 条技巧`)
  }

  return (
    <div className="pb-24">
      <PageHeader title="技巧库" />

      <div className="px-4 pt-4 pb-2">
        <div className="flex rounded-2xl p-1 gap-1 bg-[#F0F0EA]">
          {([
            ['user', '我的总结'],
            ['ai', 'AI 草稿箱'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex-1 py-2 rounded-xl text-sm font-semibold transition"
              style={tab === key
                ? { background: sport.color, color: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }
                : { color: '#9B9B9B' }
              }
            >
              {label}
              {key === 'ai' && generated.length > 0 && (
                <span
                  className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold"
                  style={{
                    background: tab === 'ai' ? 'rgba(255,255,255,0.3)' : sport.accentColor + '30',
                    color: tab === 'ai' ? '#fff' : sport.accentColor,
                  }}
                >
                  {generated.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === 'user' ? (
        <TechniqueLibrarySection
          key={sport.id}
          notes={notes}
          sport={sport}
          onEdit={openEdit}
          onDelete={handleDelete}
          onVote={handleVote}
          onMerge={handleMerge}
        />
      ) : (
        <AIDraftsSection
          key={sport.id}
          sport={sport}
          items={generated}
          collectingIndex={collectingIndex}
          onItemsChange={updateGenerated}
          onCollect={handleCollect}
          onEdit={openDraftEdit}
        />
      )}

      {tab === 'user' && (
        <button
          onClick={() => setEdit(EMPTY_EDIT)}
          aria-label="新建技巧"
          className="fixed bottom-20 right-4 w-14 h-14 rounded-full flex items-center justify-center active:scale-90 transition-transform z-40"
          style={{
            background: headerBackground,
            boxShadow: `0 8px 24px ${sport.accentColor}55, 0 2px 8px rgba(0,0,0,0.15)`,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M11 4v14M4 11h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}

      {edit && (
        <TechniqueEditorModal
          heading={edit.id ? '编辑技巧' : '新建技巧'}
          value={edit}
          categories={categories}
          accentColor={sport.accentColor}
          submitBackground={headerBackground}
          tagLimit={3}
          tagLabel="细节标签"
          submitLabel="保存"
          onChange={setEdit}
          onClose={() => setEdit(null)}
          onSubmit={handleSave}
        />
      )}

      {draftEdit && (
        <TechniqueEditorModal
          heading="编辑 AI 草稿"
          value={draftEdit.value}
          categories={categories}
          accentColor={sport.accentColor}
          submitBackground={headerBackground}
          tagLimit={2}
          tagLabel="细分标签"
          submitLabel="保存草稿"
          onChange={value => setDraftEdit(current => current ? { ...current, value } : current)}
          onClose={() => setDraftEdit(null)}
          onSubmit={saveDraftEdit}
        />
      )}
    </div>
  )
}

function normalizeDraftTags(tags: string[]): string[] {
  const normalized = tags
    .flatMap(tag => tag.split(/[,，、/\s]+/))
    .map(tag => tag.trim())
    .filter(Boolean)
    .filter((tag, index, all) => all.indexOf(tag) === index)
    .slice(0, 2)
  return normalized.length > 0 ? normalized : ['动作要点']
}
