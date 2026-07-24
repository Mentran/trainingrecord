import { useRef, useState, type ChangeEvent } from 'react'
import {
  DEFAULT_EXPORT_OPTIONS,
  exportAll,
  hasImportRestorePoint,
  importBackup,
  restoreLastImport,
  validateBackup,
  type AppBackup,
  type ExportOptions,
  type ImportMode,
} from '../../lib/storage'
import { useToast } from '../../contexts/ToastContext'

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
  mode: ImportMode
}

interface BackupSectionProps {
  counts: {
    records: number
    techniques: number
    sports: number
    conversations: number
  }
  color: string
  reminder?: string
  onBackupCreated: (meta: BackupMeta) => void
  onDataChanged: () => void
}

const EXPORT_ITEMS: Array<{ key: keyof ExportOptions; label: string }> = [
  { key: 'records', label: '训练记录' },
  { key: 'techniques', label: '技巧笔记' },
  { key: 'sports', label: '运动配置' },
  { key: 'conversations', label: '聊天记录' },
]

const IMPORT_ITEMS: Array<{ key: keyof ExportOptions; label: string; unit: string }> = [
  { key: 'records', label: '训练记录', unit: '条' },
  { key: 'techniques', label: '技巧笔记', unit: '条' },
  { key: 'sports', label: '运动配置', unit: '个运动' },
  { key: 'conversations', label: '聊天记录', unit: '组对话' },
]

export default function BackupSection({
  counts,
  color,
  reminder,
  onBackupCreated,
  onDataChanged,
}: BackupSectionProps) {
  const { showToast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [exportOptions, setExportOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS)
  const [showExportOptions, setShowExportOptions] = useState(false)
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null)
  const [canRestoreImport, setCanRestoreImport] = useState(hasImportRestorePoint)

  const exportItems = EXPORT_ITEMS.map(item => ({
    ...item,
    desc: item.key === 'sports'
      ? `${counts.sports} 个运动`
      : item.key === 'conversations'
        ? `${counts.conversations} 组对话`
        : `${counts[item.key]} 条`,
  }))

  function handleExport() {
    const selectedCount = Object.values(exportOptions).filter(Boolean).length
    if (selectedCount === 0) {
      showToast('请至少选择一类数据', 'error')
      return
    }
    const json = exportAll(exportOptions)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `training-backup-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    if (exportOptions.records) {
      onBackupCreated({ exportedAt: new Date().toISOString(), recordsCount: counts.records })
    }
    showToast(selectedCount === 4 ? '已导出完整备份' : '已导出所选数据')
  }

  function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = loadEvent => {
      const text = loadEvent.target?.result as string
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
      const importedCounts: Record<keyof ExportOptions, number> = {
        records: Array.isArray(parsed) ? parsed.length : parsed.records?.length ?? 0,
        techniques: !Array.isArray(parsed) ? parsed.techniques?.length ?? 0 : 0,
        sports: !Array.isArray(parsed) ? parsed.sports?.length ?? 0 : 0,
        conversations: !Array.isArray(parsed) ? parsed.conversations?.length ?? 0 : 0,
      }
      setPendingImport({
        json: text,
        summary: check.summary,
        options: available,
        available,
        counts: importedCounts,
        mode: 'replace',
      })
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  function handleConfirmImport() {
    if (!pendingImport) return
    const selectedCount = Object.values(pendingImport.options).filter(Boolean).length
    if (selectedCount === 0) {
      showToast('请至少选择一类数据', 'error')
      return
    }
    const selectedLabels = IMPORT_ITEMS
      .filter(item => pendingImport.options[item.key])
      .map(item => item.label)
      .join('、')
    const action = pendingImport.mode === 'merge' ? '合并' : '覆盖'
    if (!confirm(`导入将${action}所选数据：${selectedLabels}。确认继续？`)) return
    try {
      importBackup(pendingImport.json, pendingImport.options, pendingImport.mode)
      setPendingImport(null)
      setCanRestoreImport(true)
      onDataChanged()
      showToast(`导入成功（${action}），可在设置中撤销`)
    } catch (error) {
      showToast((error as Error).message ?? '导入失败，原数据未改变', 'error')
    }
  }

  function handleRestoreImport() {
    if (!confirm('将恢复到上次导入前的数据，当前数据会成为新的恢复点。确认继续？')) return
    try {
      restoreLastImport()
      setCanRestoreImport(true)
      onDataChanged()
      showToast('已恢复到上次导入前的数据')
    } catch (error) {
      showToast((error as Error).message ?? '恢复失败', 'error')
    }
  }

  return (
    <section>
      <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-3">数据备份</p>
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        {reminder && (
          <div className="px-4 py-3 border-b border-[#E8E8E2] bg-[#FFF8E8]">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#FFE7AA] flex items-center justify-center text-sm shrink-0">!</div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#7A5A16]">建议导出备份</p>
                <p className="text-xs text-[#8A7448] mt-1 leading-relaxed">{reminder}</p>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={() => setShowExportOptions(value => !value)}
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
            <p className="text-sm font-medium text-[#1A1A1A] mb-3">选择导出内容</p>
            <div className="grid grid-cols-2 gap-2">
              {exportItems.map(item => {
                const checked = exportOptions[item.key]
                return (
                  <OptionButton
                    key={item.key}
                    checked={checked}
                    color="#9DC41A"
                    label={item.label}
                    description={item.desc}
                    onClick={() => setExportOptions(current => ({ ...current, [item.key]: !current[item.key] }))}
                  />
                )
              })}
            </div>
            <button
              onClick={handleExport}
              className="mt-3 w-full py-3 rounded-2xl text-sm text-white font-medium active:opacity-85 transition"
              style={{ background: color }}
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
          <span className="text-[#9B9B9B] text-xs">覆盖或合并 →</span>
        </button>
        {pendingImport && (
          <div className="px-4 py-4 border-t border-[#E8E8E2] bg-[#FAFAF7]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-[#1A1A1A]">选择导入内容</p>
                <p className="text-xs text-[#9B9B9B] mt-0.5">{pendingImport.summary}</p>
              </div>
              <button onClick={() => setPendingImport(null)} className="text-xs text-[#9B9B9B]">取消</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {IMPORT_ITEMS.map(item => {
                const available = pendingImport.available[item.key]
                return (
                  <OptionButton
                    key={item.key}
                    checked={pendingImport.options[item.key]}
                    disabled={!available}
                    color="#4A90D9"
                    label={item.label}
                    description={available ? `${pendingImport.counts[item.key]} ${item.unit}` : '备份中没有'}
                    onClick={() => setPendingImport(current => {
                      if (!current || !current.available[item.key]) return current
                      return { ...current, options: { ...current.options, [item.key]: !current.options[item.key] } }
                    })}
                  />
                )
              })}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3" role="group" aria-label="导入方式">
              {([
                { value: 'replace' as const, label: '覆盖', desc: '所选类别以备份为准' },
                { value: 'merge' as const, label: '合并', desc: '同 ID 以备份为准' },
              ]).map(mode => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setPendingImport(current => current ? { ...current, mode: mode.value } : current)}
                  className={`rounded-xl border px-3 py-2 text-left ${pendingImport.mode === mode.value ? 'border-[#4A90D9] bg-[#EEF5FF]' : 'border-[#E8E8E2] bg-white'}`}
                >
                  <p className="text-sm font-medium text-[#1A1A1A]">{mode.label}</p>
                  <p className="text-[11px] text-[#9B9B9B] mt-0.5">{mode.desc}</p>
                </button>
              ))}
            </div>
            <button
              onClick={handleConfirmImport}
              className="mt-3 w-full py-3 rounded-2xl text-sm text-white font-medium active:opacity-85 transition bg-[#4A90D9]"
            >
              导入所选数据
            </button>
          </div>
        )}
        {canRestoreImport && !pendingImport && (
          <button
            onClick={handleRestoreImport}
            className="w-full px-4 py-3 border-t border-[#E8E8E2] text-sm text-[#4A90D9] text-left active:bg-[#F5F5F0]"
          >
            撤销上次导入
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        aria-label="选择 JSON 备份文件"
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportFile}
      />
      <p className="text-xs text-[#9B9B9B] mt-2 px-1">可按需导出训练记录、技巧笔记、运动配置和聊天记录，建议定期备份。</p>
    </section>
  )
}

interface OptionButtonProps {
  checked: boolean
  disabled?: boolean
  color: string
  label: string
  description: string
  onClick: () => void
}

function OptionButton({ checked, disabled, color, label, description, onClick }: OptionButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`text-left rounded-xl border px-3 py-2.5 transition disabled:opacity-40 ${
        checked ? 'bg-white' : 'border-[#E8E8E2] bg-white'
      }`}
      style={checked ? { borderColor: color } : undefined}
    >
      <div className="flex items-center gap-2">
        <span
          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
            checked ? 'text-white' : 'border-[#D1D5DB]'
          }`}
          style={checked ? { backgroundColor: color, borderColor: color } : undefined}
        >
          {checked && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </span>
        <span className="text-sm font-medium text-[#1A1A1A]">{label}</span>
      </div>
      <p className="text-xs text-[#9B9B9B] mt-1 ml-6">{description}</p>
    </button>
  )
}
