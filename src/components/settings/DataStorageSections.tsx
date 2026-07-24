import type { LocalFileStoreStatus } from '../../lib/localFileStore'

function formatRelativeDate(iso: string | undefined, now: number): string {
  if (!iso) return '从未导出'
  const days = Math.floor((now - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return '今天'
  if (days === 1) return '昨天'
  return `${days} 天前`
}

function formatLocalPath(value?: string): string | undefined {
  if (!value) return value
  const normalized = value.replaceAll('\\', '/')
  return normalized.match(/(?:^|\/)(data\/.*)$/)?.[1] ?? normalized
}

interface LocalFileSectionProps {
  status: LocalFileStoreStatus
  saving: boolean
  color: string
  onRefresh: () => void
  onSave: () => void
}

export function LocalFileSection({ status, saving, color, onRefresh, onSave }: LocalFileSectionProps) {
  return (
    <section>
      <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-3">本地文件</p>
      <div className="bg-white rounded-2xl card-shadow overflow-hidden px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-base ${
              status.available ? 'bg-[#E8F5C8]' : 'bg-[#FFF1D6]'
            }`}>
              {status.available ? '✓' : 'i'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#1A1A1A]">
                {status.available ? '已启用本地 JSON 存储' : '浏览器本地缓存'}
              </p>
              <p className="text-xs text-[#9B9B9B] mt-1">{status.message}</p>
            </div>
          </div>
          <button onClick={onRefresh} className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-[#E8E8E2] text-[#6B7280]">
            刷新
          </button>
        </div>
        {status.available && (
          <div className="mt-3 flex flex-col gap-2">
            <div className="bg-[#F5F5F0] rounded-xl px-3 py-2">
              <p className="text-xs text-[#9B9B9B] mb-0.5">数据文件</p>
              <p className="text-xs font-mono text-[#6B7280] truncate">{formatLocalPath(status.path)}</p>
            </div>
            <div className="bg-[#F5F5F0] rounded-xl px-3 py-2">
              <p className="text-xs text-[#9B9B9B] mb-0.5">自动备份</p>
              <p className="text-xs font-mono text-[#6B7280] truncate">{formatLocalPath(status.backupsPath)}</p>
            </div>
            <button
              onClick={onSave}
              disabled={saving}
              className="mt-1 w-full py-3 rounded-2xl text-sm text-white font-medium disabled:opacity-40"
              style={{ background: color }}
            >
              {saving ? '保存中…' : '立即保存当前数据'}
            </button>
          </div>
        )}
        {status.error && status.available && <p className="text-xs text-red-500 mt-3">{status.error}</p>}
        {!status.available && (
          <div className="mt-3 bg-[#FFF8E8] rounded-xl px-3 py-2.5 border border-[#F4E3B8]">
            <p className="text-xs font-medium text-[#7A5A16]">线上使用注意</p>
            <p className="text-xs text-[#8A7448] mt-1 leading-relaxed">
              数据只保存在当前浏览器；换设备不会同步，清理浏览器数据可能丢失，建议定期导出 JSON。
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

interface DataOverviewSectionProps {
  records: number
  techniques: number
  conversations: number
  sports: number
  storageMode: string
  storageSize: string
  lastExportedAt?: string
  lastFileSavedAt?: string
  now: number
}

export function DataOverviewSection(props: DataOverviewSectionProps) {
  const items = [
    { label: '训练记录', value: props.records, unit: '条' },
    { label: '技巧笔记', value: props.techniques, unit: '条' },
    { label: '聊天记录', value: props.conversations, unit: '组' },
    { label: '运动项目', value: props.sports, unit: '个' },
  ]

  return (
    <section>
      <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-3">数据概览</p>
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="grid grid-cols-2 border-b border-[#E8E8E2]">
          {items.map((item, index) => (
            <div key={item.label} className={`px-4 py-3.5 ${index % 2 === 0 ? 'border-r border-[#E8E8E2]' : ''} ${index > 1 ? 'border-t border-[#E8E8E2]' : ''}`}>
              <p className="text-xs text-[#9B9B9B]">{item.label}</p>
              <p className="text-lg font-semibold text-[#1A1A1A] mt-0.5">
                {item.value}<span className="text-xs text-[#9B9B9B] ml-1">{item.unit}</span>
              </p>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 flex flex-col gap-2">
          <OverviewRow label="存储模式" value={props.storageMode} />
          <OverviewRow label="估算大小" value={props.storageSize} />
          <OverviewRow label="上次导出" value={formatRelativeDate(props.lastExportedAt, props.now)} />
          {props.lastFileSavedAt && (
            <OverviewRow label="文件保存" value={formatRelativeDate(props.lastFileSavedAt, props.now)} />
          )}
        </div>
      </div>
    </section>
  )
}

function OverviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[#9B9B9B]">{label}</span>
      <span className="text-[#1A1A1A] font-medium">{value}</span>
    </div>
  )
}
