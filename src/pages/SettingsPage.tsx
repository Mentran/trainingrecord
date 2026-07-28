import { useState } from 'react'
import { exportAll, saveSport, updateSport, deleteSport, DEFAULT_SPORT, SPORT_CATEGORY_PRESETS } from '../lib/storage'
import { getAIConfig, setAIConfig, hasApiKey, generateSportCategories, categorizeTechniques, type AIConfig } from '../lib/ai'
import { getTechniques, updateTechnique } from '../lib/storage'
import { getLocalFileStoreStatus, saveCurrentDataToLocalFile } from '../lib/localFileStore'
import { useToast } from '../contexts/ToastContext'
import { useSport } from '../contexts/SportContext'
import PageHeader from '../components/PageHeader'
import AISettingsSection from '../components/settings/AISettingsSection'
import BackupSection from '../components/settings/BackupSection'
import TennisLevelSection from '../components/settings/TennisLevelSection'
import { DataOverviewSection, LocalFileSection } from '../components/settings/DataStorageSections'
import type { Sport, TennisLevel } from '../types'
import { useRecords, useTechniques } from '../hooks/useLocalData'
import { useConversations } from '../hooks/useConversations'

const PRESET_COLORS: { color: string; accent: string; label: string }[] = [
  { color: '#1A2E1A', accent: '#9DC41A', label: '网球绿' },
  { color: '#1A1F3A', accent: '#4A90D9', label: '游泳蓝' },
  { color: '#2E1A1A', accent: '#E85D5D', label: '跑步红' },
  { color: '#1A1A2E', accent: '#9B59B6', label: '紫色' },
  { color: '#1A2A2E', accent: '#1ABC9C', label: '青色' },
  { color: '#2E2A1A', accent: '#E8A838', label: '橙色' },
]

const PRESET_EMOJIS = ['🎾', '🏊', '🏃', '⚽', '🏀', '🏋️', '🚴', '🧘', '🥊', '🏸', '⛷️', '🤸']
const BACKUP_META_KEY = 'training_backup_meta'
const BACKUP_RECORD_INTERVAL = 5
const BACKUP_DAY_INTERVAL = 14

interface AddSportForm {
  name: string
  icon: string
  colorIndex: number
}

interface BackupMeta {
  exportedAt: string
  recordsCount: number
}

function getBackupMeta(): BackupMeta | null {
  try {
    const raw = localStorage.getItem(BACKUP_META_KEY)
    return raw ? (JSON.parse(raw) as BackupMeta) : null
  } catch {
    return null
  }
}

function estimateTextSize(text: string): string {
  const bytes = new Blob([text]).size
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function SettingsPage() {
  const { showToast } = useToast()
  const { sports, switchSport, sport: activeSport } = useSport()
  const allRecords = useRecords()
  const allTechniques = useTechniques()
  const allConversations = useConversations()
  const [aiConfig, setAiConfigState] = useState<AIConfig>(getAIConfig)
  const [showAddSport, setShowAddSport] = useState(false)
  const [addForm, setAddForm] = useState<AddSportForm>({ name: '', icon: '🏃', colorIndex: 1 })
  const [deleteTarget, setDeleteTarget] = useState<Sport | null>(null)
  const [generatingCategories, setGeneratingCategories] = useState(false)
  const [editingCategoriesSportId, setEditingCategoriesSportId] = useState<string | null>(null)
  const [categoryDraft, setCategoryDraft] = useState<string[]>([])
  const [categoryInput, setCategoryInput] = useState('')
  const [categorizingId, setCategorizingId] = useState<string | null>(null)
  const [localFileStatus, setLocalFileStatus] = useState(getLocalFileStoreStatus)
  const [savingLocalFile, setSavingLocalFile] = useState(false)
  const [backupMeta, setBackupMeta] = useState<BackupMeta | null>(getBackupMeta)
  const [renderedAt] = useState(() => Date.now())

  function handleBackupCreated(meta: BackupMeta) {
    localStorage.setItem(BACKUP_META_KEY, JSON.stringify(meta))
    setBackupMeta(meta)
  }

  async function handleSaveLocalFileNow() {
    setSavingLocalFile(true)
    try {
      const next = await saveCurrentDataToLocalFile()
      setLocalFileStatus(next)
      showToast('已保存到本地文件')
    } catch (e) {
      setLocalFileStatus(getLocalFileStoreStatus())
      showToast((e as Error).message ?? '保存失败', 'error')
    } finally {
      setSavingLocalFile(false)
    }
  }

  function handleSaveAI(config: AIConfig) {
    setAIConfig(config)
    setAiConfigState(getAIConfig())
    showToast(config.apiKey.trim() ? 'AI 配置已保存' : 'AI 配置已清除')
  }

  function handleAddSport() {
    if (!addForm.name.trim()) return
    const preset = PRESET_COLORS[addForm.colorIndex]
    const categories = SPORT_CATEGORY_PRESETS[addForm.name.trim()] ?? []
    saveSport({ name: addForm.name.trim(), icon: addForm.icon, color: preset.color, accentColor: preset.accent, categories })
    setShowAddSport(false)
    setAddForm({ name: '', icon: '🏃', colorIndex: 1 })
    showToast('运动项目已添加')
  }

  function handleDeleteSport(sport: Sport) {
    deleteSport(sport.id)
    setDeleteTarget(null)
    showToast('已删除')
  }

  function handleSetTennisLevel(level: TennisLevel) {
    updateSport(DEFAULT_SPORT.id, { level })
    showToast('网球等级已更新')
  }

  function openEditCategories(sport: Sport) {
    setEditingCategoriesSportId(sport.id)
    setCategoryDraft([...(sport.categories ?? [])])
    setCategoryInput('')
  }

  function saveCategories(sportId: string) {
    updateSport(sportId, { categories: categoryDraft })
    setEditingCategoriesSportId(null)
    showToast('分类已保存')
  }

  async function handleGenerateCategories(sportName: string) {
    setGeneratingCategories(true)
    try {
      const cats = await generateSportCategories(sportName)
      setCategoryDraft(cats)
    } catch (e) {
      showToast((e as Error).message ?? '生成失败', 'error')
    } finally {
      setGeneratingCategories(false)
    }
  }

  async function handleCategorizeAll(sport: Sport) {
    const notes = getTechniques(sport.id).filter(n => !n.category)
    if (notes.length === 0) { showToast('所有笔记已有分类'); return }
    if (!sport.categories?.length) { showToast('请先设置分类', 'error'); return }
    setCategorizingId(sport.id)
    try {
      const results = await categorizeTechniques(
        notes.map(n => ({ id: n.id, title: n.title, content: n.content })),
        sport.categories,
      )
      results.forEach(r => updateTechnique(r.id, { category: r.category }))
      showToast(`已归类 ${results.length} 条笔记`)
    } catch (e) {
      showToast((e as Error).message ?? '归类失败', 'error')
    } finally {
      setCategorizingId(null)
    }
  }

  const storageSize = estimateTextSize(exportAll())
  const backupDays = backupMeta ? Math.floor((renderedAt - new Date(backupMeta.exportedAt).getTime()) / 86400000) : null
  const recordsSinceBackup = backupMeta ? Math.max(0, allRecords.length - backupMeta.recordsCount) : allRecords.length
  const shouldRemindBackup = allRecords.length > 0 && (!backupMeta || recordsSinceBackup >= BACKUP_RECORD_INTERVAL || (backupDays ?? 0) >= BACKUP_DAY_INTERVAL)
  const backupReminder = !backupMeta
    ? '还没有导出过训练记录，建议先保存一份 JSON 备份。'
    : recordsSinceBackup >= BACKUP_RECORD_INTERVAL
      ? `上次导出后新增 ${recordsSinceBackup} 条训练记录，建议备份。`
      : `距离上次导出已 ${backupDays} 天，建议更新备份。`
  const storageModeLabel = localFileStatus.available ? '本地 JSON 文件' : '浏览器缓存'

  const tennisSport = sports.find(s => s.id === DEFAULT_SPORT.id) ?? DEFAULT_SPORT
  const tennisLevel = tennisSport.level ?? DEFAULT_SPORT.level ?? '2.0'

  return (
    <div className="pb-8">
      <PageHeader title="设置" />

      <div className="px-4 pt-5 flex flex-col gap-6">

        {/* 我的运动 */}
        <div>
          <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-3">我的运动</p>
          <div className="bg-white rounded-2xl card-shadow overflow-hidden">
            {sports.map((s, i) => (
              <div key={s.id} className={i > 0 ? 'border-t border-[#E8E8E2]' : ''}>
                {/* 运动行 */}
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: s.accentColor + '22' }}
                  >
                    {s.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A1A1A]">{s.name}</p>
                    {s.id === activeSport.id && (
                      <p className="text-xs mt-0.5" style={{ color: s.accentColor }}>当前使用</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => editingCategoriesSportId === s.id ? setEditingCategoriesSportId(null) : openEditCategories(s)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-[#E8E8E2] text-[#6B7280]"
                    >
                      分类
                    </button>
                    {s.id !== activeSport.id && (
                      <button
                        onClick={() => switchSport(s.id)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-[#E8E8E2] text-[#6B7280]"
                      >
                        切换
                      </button>
                    )}
                    {s.id !== DEFAULT_SPORT.id && (
                      <button
                        onClick={() => setDeleteTarget(s)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-[#9B9B9B] active:bg-red-50 active:text-red-400 transition"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M5 3.5l.5 7.5M9 3.5l-.5 7.5M3.5 3.5l.5 7.5a1 1 0 001 .9h4a1 1 0 001-.9l.5-7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* 分类管理面板 */}
                {editingCategoriesSportId === s.id && (
                  <div className="px-4 pb-4 border-t border-[#F5F5F0] pt-3 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-[#9B9B9B]">技术分类（用于筛选技巧笔记）</p>
                      {hasApiKey() && (
                        <button
                          onClick={() => handleGenerateCategories(s.name)}
                          disabled={generatingCategories}
                          className="text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 disabled:opacity-50"
                          style={{ color: s.accentColor, background: s.accentColor + '15' }}
                        >
                          {generatingCategories
                            ? <span className="inline-block w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: s.accentColor + '40', borderTopColor: s.accentColor }} />
                            : '✦'} AI 生成
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {categoryDraft.map(cat => (
                        <span key={cat} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{ background: s.accentColor + '20', color: s.accentColor }}>
                          {cat}
                          <button onClick={() => setCategoryDraft(d => d.filter(c => c !== cat))} className="opacity-60 leading-none text-sm">×</button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="添加分类，回车确认"
                        value={categoryInput}
                        onChange={e => setCategoryInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            const t = categoryInput.trim()
                            if (t && !categoryDraft.includes(t)) setCategoryDraft(d => [...d, t])
                            setCategoryInput('')
                          }
                        }}
                        className="flex-1 border border-[#E8E8E2] rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#9DC41A]/40 focus:border-[#9DC41A]"
                      />
                    </div>
                    <div className="flex gap-2">
                      {hasApiKey() && getTechniques(s.id).some(n => !n.category) && (
                        <button
                          onClick={() => handleCategorizeAll(s)}
                          disabled={!!categorizingId || !categoryDraft.length}
                          className="flex-1 py-2 rounded-xl text-xs font-medium border disabled:opacity-40 flex items-center justify-center gap-1"
                          style={{ borderColor: s.accentColor + '60', color: s.accentColor, background: s.accentColor + '10' }}
                        >
                          {categorizingId === s.id
                            ? <><span className="inline-block w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: s.accentColor + '40', borderTopColor: s.accentColor }} />归类中…</>
                            : '✦ AI 批量归类现有笔记'}
                        </button>
                      )}
                      <button
                        onClick={() => saveCategories(s.id)}
                        className="flex-1 py-2 rounded-xl text-xs font-medium text-white"
                        style={{ background: s.color }}
                      >
                        保存分类
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* 添加运动 */}
            {!showAddSport ? (
              <button
                onClick={() => setShowAddSport(true)}
                className="w-full flex items-center gap-3 px-4 py-3.5 border-t border-[#E8E8E2] text-sm text-[#9DC41A] font-medium active:bg-[#F5F5F0] transition"
              >
                <div className="w-9 h-9 rounded-xl border-2 border-dashed border-[#9DC41A]/40 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 2v10M2 7h10" stroke="#9DC41A" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </div>
                添加运动项目
              </button>
            ) : (
              <div className="border-t border-[#E8E8E2] px-4 py-4 flex flex-col gap-3">
                {/* 名称 */}
                <input
                  type="text"
                  placeholder="运动名称，如「游泳」"
                  value={addForm.name}
                  onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  autoFocus
                  className="w-full border border-[#E8E8E2] rounded-xl px-3 py-2.5 text-sm text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#9DC41A]/40 focus:border-[#9DC41A]"
                />

                {/* Emoji 选择 */}
                <div>
                  <p className="text-xs text-[#9B9B9B] mb-2">图标</p>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setAddForm(f => ({ ...f, icon: emoji }))}
                        className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition ${
                          addForm.icon === emoji
                            ? 'bg-[#1A2E1A] ring-2 ring-[#9DC41A]'
                            : 'bg-[#F5F5F0]'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 颜色选择 */}
                <div>
                  <p className="text-xs text-[#9B9B9B] mb-2">主题色</p>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map((c, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setAddForm(f => ({ ...f, colorIndex: idx }))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                          addForm.colorIndex === idx
                            ? 'border-[#1A1A1A] bg-[#F5F5F0]'
                            : 'border-[#E8E8E2] bg-white'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ background: c.accent }}
                        />
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => { setShowAddSport(false); setAddForm({ name: '', icon: '🏃', colorIndex: 1 }) }}
                    className="flex-1 py-2.5 rounded-xl border border-[#E8E8E2] text-sm text-[#6B7280]"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleAddSport}
                    disabled={!addForm.name.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-[#1A2E1A] text-sm text-white font-medium disabled:opacity-40"
                  >
                    添加
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <TennisLevelSection value={tennisLevel} onChange={handleSetTennisLevel} />

        <LocalFileSection
          status={localFileStatus}
          saving={savingLocalFile}
          color={activeSport.color}
          onRefresh={() => setLocalFileStatus(getLocalFileStoreStatus())}
          onSave={handleSaveLocalFileNow}
        />

        <DataOverviewSection
          records={allRecords.length}
          techniques={allTechniques.length}
          conversations={allConversations.length}
          sports={sports.length}
          storageMode={storageModeLabel}
          storageSize={storageSize}
          lastExportedAt={backupMeta?.exportedAt}
          lastFileSavedAt={localFileStatus.available ? localFileStatus.lastSavedAt : undefined}
          now={renderedAt}
        />

        <AISettingsSection config={aiConfig} onSave={handleSaveAI} />

        <BackupSection
          counts={{
            records: allRecords.length,
            techniques: allTechniques.length,
            sports: sports.length,
            conversations: allConversations.length,
          }}
          color={activeSport.color}
          reminder={shouldRemindBackup ? backupReminder : undefined}
          onBackupCreated={handleBackupCreated}
        />

        <footer className="pb-2 text-center">
          <a
            href="https://github.com/Mentran/trainingrecord"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[#9B9B9B] hover:text-[#6B7280] transition-colors"
          >
            GitHub 源码
            <span aria-hidden="true">↗</span>
          </a>
        </footer>
      </div>

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 pb-10" onClick={e => e.stopPropagation()}>
            <p className="text-base font-semibold text-[#1A1A1A] mb-1">删除「{deleteTarget.name}」？</p>
            <p className="text-sm text-[#6B7280] mb-6">该运动下的训练记录、技巧笔记和聊天记录都会一并删除，无法恢复。</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-3 rounded-2xl border border-[#E8E8E2] text-sm text-[#6B7280] font-medium"
              >
                取消
              </button>
              <button
                onClick={() => handleDeleteSport(deleteTarget)}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-sm text-white font-medium"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
