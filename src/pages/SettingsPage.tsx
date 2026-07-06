import { useState, useRef } from 'react'
import { exportAll, validateBackup, importBackup, saveSport, updateSport, deleteSport, DEFAULT_SPORT, SPORT_CATEGORY_PRESETS, DEFAULT_EXPORT_OPTIONS, type AppBackup, type ExportOptions } from '../lib/storage'
import { getAIConfig, setAIConfig, hasApiKey, generateSportCategories, categorizeTechniques, getConversations, type AIConfig } from '../lib/ai'
import { getRecords, getTechniques, updateTechnique } from '../lib/storage'
import { getLocalFileStoreStatus, saveCurrentDataToLocalFile } from '../lib/localFileStore'
import { useToast } from '../components/ToastProvider'
import { useSport } from '../components/SportProvider'
import PageHeader from '../components/PageHeader'
import type { Sport } from '../types'

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

interface PendingImport {
  json: string
  summary: string
  options: ExportOptions
  available: ExportOptions
  counts: Record<keyof ExportOptions, number>
}

function getBackupMeta(): BackupMeta | null {
  try {
    const raw = localStorage.getItem(BACKUP_META_KEY)
    return raw ? (JSON.parse(raw) as BackupMeta) : null
  } catch {
    return null
  }
}

function formatRelativeDate(iso?: string): string {
  if (!iso) return '从未导出'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return '今天'
  if (days === 1) return '昨天'
  return `${days} 天前`
}

function estimateTextSize(text: string): string {
  const bytes = new Blob([text]).size
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function SettingsPage() {
  const { showToast } = useToast()
  const { sports, switchSport, refreshSports, sport: activeSport } = useSport()
  const fileRef = useRef<HTMLInputElement>(null)
  const [aiConfig, setAiConfigState] = useState<AIConfig>(getAIConfig)
  const [showKey, setShowKey] = useState(false)
  const [editingAI, setEditingAI] = useState(false)
  const [aiDraft, setAiDraft] = useState<AIConfig>(getAIConfig)
  const [showAddSport, setShowAddSport] = useState(false)
  const [addForm, setAddForm] = useState<AddSportForm>({ name: '', icon: '🏃', colorIndex: 1 })
  const [deleteTarget, setDeleteTarget] = useState<Sport | null>(null)
  const [generatingCategories, setGeneratingCategories] = useState(false)
  const [editingCategoriesSportId, setEditingCategoriesSportId] = useState<string | null>(null)
  const [categoryDraft, setCategoryDraft] = useState<string[]>([])
  const [categoryInput, setCategoryInput] = useState('')
  const [categorizingId, setCategorizingId] = useState<string | null>(null)
  const [exportOptions, setExportOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS)
  const [showExportOptions, setShowExportOptions] = useState(false)
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null)
  const [localFileStatus, setLocalFileStatus] = useState(getLocalFileStoreStatus)
  const [savingLocalFile, setSavingLocalFile] = useState(false)
  const [backupMeta, setBackupMeta] = useState<BackupMeta | null>(getBackupMeta)

  function handleExport() {
    const selectedCount = Object.values(exportOptions).filter(Boolean).length
    if (selectedCount === 0) {
      showToast('请至少选择一类数据', 'error')
      return
    }
    const json = exportAll(exportOptions)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `training-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    if (exportOptions.records) {
      const nextMeta = { exportedAt: new Date().toISOString(), recordsCount: getRecords().length }
      localStorage.setItem(BACKUP_META_KEY, JSON.stringify(nextMeta))
      setBackupMeta(nextMeta)
    }
    showToast(selectedCount === 4 ? '已导出完整备份' : '已导出所选数据')
  }

  function toggleExportOption(key: keyof ExportOptions) {
    setExportOptions(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function toggleExportOptions() {
    setShowExportOptions(prev => !prev)
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const check = validateBackup(text)
      if (!check.valid) {
        showToast(check.error ?? '导入失败', 'error')
        return
      }
      const parsed = JSON.parse(text) as AppBackup | unknown[]
      const available: ExportOptions = {
        records: Array.isArray(parsed) || Array.isArray(parsed.records),
        techniques: !Array.isArray(parsed) && Array.isArray(parsed.techniques),
        sports: !Array.isArray(parsed) && Array.isArray(parsed.sports),
        conversations: !Array.isArray(parsed) && Array.isArray(parsed.conversations),
      }
      const counts: Record<keyof ExportOptions, number> = {
        records: Array.isArray(parsed) ? parsed.length : parsed.records?.length ?? 0,
        techniques: !Array.isArray(parsed) ? parsed.techniques?.length ?? 0 : 0,
        sports: !Array.isArray(parsed) ? parsed.sports?.length ?? 0 : 0,
        conversations: !Array.isArray(parsed) ? parsed.conversations?.length ?? 0 : 0,
      }
      setPendingImport({ json: text, summary: check.summary, options: available, available, counts })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function toggleImportOption(key: keyof ExportOptions) {
    setPendingImport(prev => {
      if (!prev || !prev.available[key]) return prev
      return { ...prev, options: { ...prev.options, [key]: !prev.options[key] } }
    })
  }

  function handleConfirmImport() {
    if (!pendingImport) return
    const selectedCount = Object.values(pendingImport.options).filter(Boolean).length
    if (selectedCount === 0) {
      showToast('请至少选择一类数据', 'error')
      return
    }
    const selectedLabels = importItems
      .filter(item => pendingImport.options[item.key])
      .map(item => item.label)
      .join('、')
    if (!confirm(`导入将覆盖所选数据：${selectedLabels}。确认继续？`)) return
    importBackup(pendingImport.json, pendingImport.options)
    setPendingImport(null)
    refreshSports()
    showToast('导入成功，请刷新页面')
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

  function startEditAI() {
    setAiDraft(aiConfig)
    setEditingAI(true)
  }

  function saveAI() {
    setAIConfig(aiDraft)
    setAiConfigState(getAIConfig())
    setEditingAI(false)
    showToast(aiDraft.apiKey.trim() ? 'AI 配置已保存' : 'AI 配置已清除')
  }

  function handleAddSport() {
    if (!addForm.name.trim()) return
    const preset = PRESET_COLORS[addForm.colorIndex]
    const categories = SPORT_CATEGORY_PRESETS[addForm.name.trim()] ?? []
    saveSport({ name: addForm.name.trim(), icon: addForm.icon, color: preset.color, accentColor: preset.accent, categories })
    refreshSports()
    setShowAddSport(false)
    setAddForm({ name: '', icon: '🏃', colorIndex: 1 })
    showToast('运动项目已添加')
  }

  function handleDeleteSport(sport: Sport) {
    deleteSport(sport.id)
    if (activeSport.id === sport.id) switchSport(DEFAULT_SPORT.id)
    else refreshSports()
    setDeleteTarget(null)
    showToast('已删除')
  }

  function openEditCategories(sport: Sport) {
    setEditingCategoriesSportId(sport.id)
    setCategoryDraft([...(sport.categories ?? [])])
    setCategoryInput('')
  }

  function saveCategories(sportId: string) {
    updateSport(sportId, { categories: categoryDraft })
    refreshSports()
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

  const maskedKey = aiConfig.apiKey
    ? aiConfig.apiKey.slice(0, 8) + '••••••••' + aiConfig.apiKey.slice(-4)
    : ''

  const allRecords = getRecords()
  const allTechniques = getTechniques()
  const allConversations = getConversations()
  const storageSize = estimateTextSize(exportAll())
  const backupDays = backupMeta ? Math.floor((Date.now() - new Date(backupMeta.exportedAt).getTime()) / 86400000) : null
  const recordsSinceBackup = backupMeta ? Math.max(0, allRecords.length - backupMeta.recordsCount) : allRecords.length
  const shouldRemindBackup = allRecords.length > 0 && (!backupMeta || recordsSinceBackup >= BACKUP_RECORD_INTERVAL || (backupDays ?? 0) >= BACKUP_DAY_INTERVAL)
  const backupReminder = !backupMeta
    ? '还没有导出过训练记录，建议先保存一份 JSON 备份。'
    : recordsSinceBackup >= BACKUP_RECORD_INTERVAL
      ? `上次导出后新增 ${recordsSinceBackup} 条训练记录，建议备份。`
      : `距离上次导出已 ${backupDays} 天，建议更新备份。`
  const storageModeLabel = localFileStatus.available ? '本地 JSON 文件' : '浏览器缓存'

  const exportItems: Array<{ key: keyof ExportOptions; label: string; desc: string }> = [
    { key: 'records', label: '训练记录', desc: `${allRecords.length} 条` },
    { key: 'techniques', label: '技巧笔记', desc: `${allTechniques.length} 条` },
    { key: 'sports', label: '运动配置', desc: `${sports.length} 个运动` },
    { key: 'conversations', label: '聊天记录', desc: `${allConversations.length} 组对话` },
  ]
  const importItems: Array<{ key: keyof ExportOptions; label: string; unit: string }> = [
    { key: 'records', label: '训练记录', unit: '条' },
    { key: 'techniques', label: '技巧笔记', unit: '条' },
    { key: 'sports', label: '运动配置', unit: '个运动' },
    { key: 'conversations', label: '聊天记录', unit: '组对话' },
  ]
  const localFilePath = localFileStatus.path?.replace('/Users/vitamin/Desktop/vibecoding/projects/网球训练记录/', '')
  const localBackupPath = localFileStatus.backupsPath?.replace('/Users/vitamin/Desktop/vibecoding/projects/网球训练记录/', '')

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

        {/* 本地文件存储 */}
        <div>
          <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-3">本地文件</p>
          <div className="bg-white rounded-2xl card-shadow overflow-hidden px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-base ${
                  localFileStatus.available ? 'bg-[#E8F5C8]' : 'bg-[#FFF1D6]'
                }`}>
                  {localFileStatus.available ? '✓' : 'i'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1A1A1A]">
                    {localFileStatus.available ? '已启用本地 JSON 存储' : '浏览器本地缓存'}
                  </p>
                  <p className="text-xs text-[#9B9B9B] mt-1">
                    {localFileStatus.message}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLocalFileStatus(getLocalFileStoreStatus())}
                className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-[#E8E8E2] text-[#6B7280]"
              >
                刷新
              </button>
            </div>
            {localFileStatus.available && (
              <div className="mt-3 flex flex-col gap-2">
                <div className="bg-[#F5F5F0] rounded-xl px-3 py-2">
                  <p className="text-xs text-[#9B9B9B] mb-0.5">数据文件</p>
                  <p className="text-xs font-mono text-[#6B7280] truncate">{localFilePath}</p>
                </div>
                <div className="bg-[#F5F5F0] rounded-xl px-3 py-2">
                  <p className="text-xs text-[#9B9B9B] mb-0.5">自动备份</p>
                  <p className="text-xs font-mono text-[#6B7280] truncate">{localBackupPath}</p>
                </div>
              </div>
            )}
            {localFileStatus.available && (
              <button
                onClick={handleSaveLocalFileNow}
                disabled={savingLocalFile}
                className="mt-3 w-full py-3 rounded-2xl text-sm text-white font-medium disabled:opacity-40"
                style={{ background: activeSport.color }}
              >
                {savingLocalFile ? '保存中…' : '立即保存当前数据'}
              </button>
            )}
            {localFileStatus.error && localFileStatus.available && (
              <p className="text-xs text-red-500 mt-3">{localFileStatus.error}</p>
            )}
            {!localFileStatus.available && (
              <div className="mt-3 bg-[#FFF8E8] rounded-xl px-3 py-2.5 border border-[#F4E3B8]">
                <p className="text-xs font-medium text-[#7A5A16]">线上使用注意</p>
                <p className="text-xs text-[#8A7448] mt-1 leading-relaxed">
                  数据只保存在当前浏览器；换设备不会同步，清理浏览器数据可能丢失，建议定期导出 JSON。
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 数据概览 */}
        <div>
          <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-3">数据概览</p>
          <div className="bg-white rounded-2xl card-shadow overflow-hidden">
            <div className="grid grid-cols-2 border-b border-[#E8E8E2]">
              {[
                { label: '训练记录', value: allRecords.length, unit: '条' },
                { label: '技巧笔记', value: allTechniques.length, unit: '条' },
                { label: '聊天记录', value: allConversations.length, unit: '组' },
                { label: '运动项目', value: sports.length, unit: '个' },
              ].map((item, idx) => (
                <div key={item.label} className={`px-4 py-3.5 ${idx % 2 === 0 ? 'border-r border-[#E8E8E2]' : ''} ${idx > 1 ? 'border-t border-[#E8E8E2]' : ''}`}>
                  <p className="text-xs text-[#9B9B9B]">{item.label}</p>
                  <p className="text-lg font-semibold text-[#1A1A1A] mt-0.5">
                    {item.value}<span className="text-xs text-[#9B9B9B] ml-1">{item.unit}</span>
                  </p>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#9B9B9B]">存储模式</span>
                <span className="text-[#1A1A1A] font-medium">{storageModeLabel}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#9B9B9B]">估算大小</span>
                <span className="text-[#1A1A1A] font-medium">{storageSize}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#9B9B9B]">上次导出</span>
                <span className="text-[#1A1A1A] font-medium">{formatRelativeDate(backupMeta?.exportedAt)}</span>
              </div>
              {localFileStatus.available && localFileStatus.lastSavedAt && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#9B9B9B]">文件保存</span>
                  <span className="text-[#1A1A1A] font-medium">{formatRelativeDate(localFileStatus.lastSavedAt)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI 功能 */}
        <div>
          <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-3">AI 功能</p>
          <div className="bg-white rounded-2xl card-shadow overflow-hidden">
            <div className="px-4 py-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#F0F7E0] flex items-center justify-center text-base">✦</div>
                  <div>
                    <p className="text-sm font-medium text-[#1A1A1A]">AI 接口配置</p>
                    <p className="text-xs text-[#9B9B9B] mt-0.5">润色和运动顾问共用</p>
                  </div>
                </div>
                {!editingAI && (
                  <button onClick={startEditAI} className="text-xs text-[#9DC41A] font-medium">
                    {aiConfig.apiKey ? '修改' : '配置'}
                  </button>
                )}
              </div>

              {editingAI ? (
                <div className="flex flex-col gap-2.5">
                  <div>
                    <p className="text-xs text-[#9B9B9B] mb-1">接口格式</p>
                    <div className="flex gap-2">
                      {(['anthropic', 'openai'] as const).map(fmt => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => setAiDraft(d => ({ ...d, format: fmt }))}
                          className={`flex-1 py-2 rounded-xl text-xs font-medium border transition ${
                            aiDraft.format === fmt
                              ? 'bg-[#1A2E1A] text-white border-[#1A2E1A]'
                              : 'bg-white text-[#6B7280] border-[#E8E8E2]'
                          }`}
                        >
                          {fmt === 'anthropic' ? 'Anthropic' : 'OpenAI 兼容'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-[#9B9B9B] mb-1">API 地址</p>
                    <input
                      type="text"
                      value={aiDraft.apiUrl}
                      onChange={e => setAiDraft(d => ({ ...d, apiUrl: e.target.value }))}
                      placeholder={aiDraft.format === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com'}
                      className="w-full border border-[#E8E8E2] rounded-xl px-3 py-2.5 text-sm text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#9DC41A]/40 focus:border-[#9DC41A] font-mono"
                    />
                    <p className="text-xs text-[#ADADAD] mt-1">填写 base URL 即可，路径自动补全</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#9B9B9B] mb-1">API Key</p>
                    <input
                      type="text"
                      value={aiDraft.apiKey}
                      onChange={e => setAiDraft(d => ({ ...d, apiKey: e.target.value }))}
                      placeholder="sk-ant-..."
                      autoFocus
                      className="w-full border border-[#E8E8E2] rounded-xl px-3 py-2.5 text-sm text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#9DC41A]/40 focus:border-[#9DC41A] font-mono"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-[#9B9B9B] mb-1">模型</p>
                    <input
                      type="text"
                      value={aiDraft.model}
                      onChange={e => setAiDraft(d => ({ ...d, model: e.target.value }))}
                      placeholder="claude-sonnet-4-6"
                      className="w-full border border-[#E8E8E2] rounded-xl px-3 py-2.5 text-sm text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#9DC41A]/40 focus:border-[#9DC41A] font-mono"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setEditingAI(false)}
                      className="flex-1 py-2 rounded-xl border border-[#E8E8E2] text-sm text-[#6B7280]"
                    >
                      取消
                    </button>
                    <button
                      onClick={saveAI}
                      className="flex-1 py-2 rounded-xl bg-[#1A2E1A] text-sm text-white font-medium"
                    >
                      保存
                    </button>
                  </div>
                </div>
              ) : aiConfig.apiKey ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 bg-[#F5F5F0] rounded-xl px-3 py-2">
                    <span className="text-xs text-[#9B9B9B] w-10 shrink-0">Key</span>
                    <span className="text-xs font-mono text-[#6B7280] flex-1 truncate">
                      {showKey ? aiConfig.apiKey : maskedKey}
                    </span>
                    <button onClick={() => setShowKey(v => !v)} className="text-xs text-[#9B9B9B] shrink-0">
                      {showKey ? '隐藏' : '显示'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 bg-[#F5F5F0] rounded-xl px-3 py-2">
                    <span className="text-xs text-[#9B9B9B] w-10 shrink-0">模型</span>
                    <span className="text-xs font-mono text-[#6B7280] flex-1 truncate">{aiConfig.model}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#9B9B9B]">未配置，AI 功能不可用</p>
              )}
            </div>
            <div className="px-4 pb-3">
              <p className="text-xs text-[#9B9B9B]">配置仅存储在本设备浏览器中，不会上传到任何服务器。</p>
            </div>
          </div>
        </div>

        {/* 数据备份 */}
        <div>
          <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-3">数据备份</p>
          <div className="bg-white rounded-2xl card-shadow overflow-hidden">
            {shouldRemindBackup && (
              <div className="px-4 py-3 border-b border-[#E8E8E2] bg-[#FFF8E8]">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#FFE7AA] flex items-center justify-center text-sm shrink-0">!</div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#7A5A16]">建议导出备份</p>
                    <p className="text-xs text-[#8A7448] mt-1 leading-relaxed">{backupReminder}</p>
                  </div>
                </div>
              </div>
            )}
            <button
              onClick={toggleExportOptions}
              className="w-full flex items-center justify-between px-4 py-4 text-sm text-[#1A1A1A] active:bg-[#F5F5F0] transition border-b border-[#E8E8E2]"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#E8F5C8] flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2v8M5 7l3 3 3-3M3 12h10" stroke="#5A8A00" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span>导出记录</span>
              </div>
              <span className="text-[#9B9B9B] text-xs">{showExportOptions ? '收起 ↑' : '选择 →'}</span>
            </button>
            {showExportOptions && (
              <div className="px-4 py-4 border-b border-[#E8E8E2] bg-[#FAFAF7]">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-[#1A1A1A]">选择导出内容</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {exportItems.map(item => {
                    const checked = exportOptions[item.key]
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => toggleExportOption(item.key)}
                        className={`text-left rounded-xl border px-3 py-2.5 transition ${
                          checked ? 'border-[#9DC41A] bg-white' : 'border-[#E8E8E2] bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              checked ? 'bg-[#9DC41A] border-[#9DC41A]' : 'border-[#D1D5DB]'
                            }`}
                          >
                            {checked && (
                              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </span>
                          <span className="text-sm font-medium text-[#1A1A1A]">{item.label}</span>
                        </div>
                        <p className="text-xs text-[#9B9B9B] mt-1 ml-6">{item.desc}</p>
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={handleExport}
                  className="mt-3 w-full py-3 rounded-2xl text-sm text-white font-medium active:opacity-85 transition"
                  style={{ background: activeSport.color }}
                >
                  导出所选数据
                </button>
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-between px-4 py-4 text-sm text-[#1A1A1A] active:bg-[#F5F5F0] transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#E8F0FF] flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 10V2M5 5l3-3 3 3M3 12h10" stroke="#4A90D9" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span>导入数据</span>
              </div>
              <span className="text-[#9B9B9B] text-xs">覆盖现有 →</span>
            </button>
            {pendingImport && (
              <div className="px-4 py-4 border-t border-[#E8E8E2] bg-[#FAFAF7]">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium text-[#1A1A1A]">选择导入内容</p>
                    <p className="text-xs text-[#9B9B9B] mt-0.5">{pendingImport.summary}</p>
                  </div>
                  <button
                    onClick={() => setPendingImport(null)}
                    className="text-xs text-[#9B9B9B]"
                  >
                    取消
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {importItems.map(item => {
                    const available = pendingImport.available[item.key]
                    const checked = pendingImport.options[item.key]
                    return (
                      <button
                        key={item.key}
                        type="button"
                        disabled={!available}
                        onClick={() => toggleImportOption(item.key)}
                        className={`text-left rounded-xl border px-3 py-2.5 transition disabled:opacity-40 ${
                          checked ? 'border-[#4A90D9] bg-white' : 'border-[#E8E8E2] bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              checked ? 'bg-[#4A90D9] border-[#4A90D9]' : 'border-[#D1D5DB]'
                            }`}
                          >
                            {checked && (
                              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </span>
                          <span className="text-sm font-medium text-[#1A1A1A]">{item.label}</span>
                        </div>
                        <p className="text-xs text-[#9B9B9B] mt-1 ml-6">
                          {available ? `${pendingImport.counts[item.key]} ${item.unit}` : '备份中没有'}
                        </p>
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={handleConfirmImport}
                  className="mt-3 w-full py-3 rounded-2xl text-sm text-white font-medium active:opacity-85 transition"
                  style={{ background: '#4A90D9' }}
                >
                  导入所选数据
                </button>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
          <p className="text-xs text-[#9B9B9B] mt-2 px-1">可按需导出训练记录、技巧笔记、运动配置和聊天记录，建议定期备份。</p>
        </div>
      </div>

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 pb-10" onClick={e => e.stopPropagation()}>
            <p className="text-base font-semibold text-[#1A1A1A] mb-1">删除「{deleteTarget.name}」？</p>
            <p className="text-sm text-[#6B7280] mb-6">该运动下的所有训练记录也会一并删除，无法恢复。</p>
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
