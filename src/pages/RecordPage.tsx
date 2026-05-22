import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { saveRecord, updateRecord, getRecords, getCoaches, getActiveSportId } from '../lib/storage'
import { polishText, hasApiKey } from '../lib/ai'
import PageHeader from '../components/PageHeader'
import { useSport } from '../components/SportProvider'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

const DURATION_PRESETS = [30, 45, 60, 90, 120]

interface FormState {
  date: string
  duration: string
  coach: string
  content: string
  reflection: string
  tags: string[]
}

export default function RecordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { sport } = useSport()
  const editId = searchParams.get('edit')
  const dateParam = searchParams.get('date')

  // 使用运动的 categories 作为预设标签，没有则降级到空数组
  const PRESET_TAGS = sport.categories ?? []

  const [form, setForm] = useState<FormState>({
    date: dateParam ?? today(),
    duration: '',
    coach: '',
    content: '',
    reflection: '',
    tags: [],
  })
  const [coaches, setCoaches] = useState<string[]>([])
  const [errors, setErrors] = useState<Partial<FormState>>({})
  const [customDuration, setCustomDuration] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [polishing, setPolishing] = useState(false)

  useEffect(() => {
    setCoaches(getCoaches())
    if (editId) {
      const record = getRecords().find(r => r.id === editId)
      if (record) {
        setForm({
          date: record.date,
          duration: record.duration ? String(record.duration) : '',
          coach: record.coach,
          content: record.content,
          reflection: record.reflection,
          tags: record.tags ?? [],
        })
        if (record.duration && !DURATION_PRESETS.includes(record.duration)) {
          setCustomDuration(true)
        }
      }
    }
  }, [editId])

  function set(field: keyof Omit<FormState, 'tags'>, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  function toggleTag(tag: string) {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag],
    }))
  }

  function addCustomTag() {
    const t = tagInput.trim()
    if (!t || form.tags.includes(t)) { setTagInput(''); return }
    setForm(prev => ({ ...prev, tags: [...prev.tags, t] }))
    setTagInput('')
  }

  async function handlePolish() {
    if (!form.content.trim() || polishing) return
    setPolishing(true)
    try {
      const result = await polishText(form.content, form.reflection)
      setForm(prev => ({ ...prev, content: result.content, reflection: result.reflection }))
    } catch (e) {
      alert((e as Error).message ?? 'AI 润色失败，请重试')
    } finally {
      setPolishing(false)
    }
  }

  function validate(): boolean {
    const next: Partial<FormState> = {}
    if (!form.date) next.date = '请选择日期'
    if (!form.content.trim()) next.content = '请填写训练内容'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    const data = {
      date: form.date,
      duration: form.duration ? parseInt(form.duration, 10) : 0,
      coach: form.coach.trim(),
      content: form.content.trim(),
      contentOriginal: form.content.trim(),
      reflection: form.reflection.trim(),
      reflectionOriginal: form.reflection.trim(),
      polishStatus: 'none' as const,
      sportId: getActiveSportId(),
      tags: form.tags,
    }
    if (editId) {
      updateRecord(editId, data)
    } else {
      saveRecord(data)
    }
    navigate('/list')
  }

  const inputClass = (hasError?: string) =>
    `w-full border rounded-2xl px-4 py-3 text-[#1A1A1A] bg-white outline-none focus:ring-2 focus:ring-[#9DC41A]/40 focus:border-[#9DC41A] transition text-sm ${
      hasError ? 'border-red-400' : 'border-[#E8E8E2]'
    }`

  return (
    <div className="pb-8">
      <PageHeader
        title={editId ? '编辑记录' : '记录训练'}
        onBack={() => navigate(-1)}
      />

      <form onSubmit={handleSubmit} noValidate className="px-4 pt-5 flex flex-col gap-4">

        {/* 日期 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">日期</label>
          <input
            type="date"
            value={form.date}
            onChange={e => set('date', e.target.value)}
            className={inputClass(errors.date)}
          />
          {errors.date && <span className="text-xs text-red-500">{errors.date}</span>}
        </div>

        {/* 时长 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">时长</label>
          {!customDuration ? (
            <div className="flex gap-2 flex-wrap">
              {DURATION_PRESETS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => set('duration', String(d))}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition`}
                  style={form.duration === String(d)
                    ? { backgroundColor: sport.color, color: 'white', borderColor: sport.color }
                    : { backgroundColor: 'white', color: '#6B7280', borderColor: '#E8E8E2' }
                  }
                >
                  {d}min
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setCustomDuration(true); set('duration', '') }}
                className="px-4 py-2 rounded-xl text-sm font-medium border bg-white text-[#6B7280] border-[#E8E8E2] transition"
              >
                自定义
              </button>
            </div>
          ) : (
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min="1"
                max="480"
                placeholder="输入分钟数"
                value={form.duration}
                onChange={e => set('duration', e.target.value)}
                className={`${inputClass()} flex-1`}
                autoFocus
              />
              <button
                type="button"
                onClick={() => { setCustomDuration(false); set('duration', '') }}
                className="text-sm text-[#6B7280] px-2"
              >
                取消
              </button>
            </div>
          )}
        </div>

        {/* 教练 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">教练</label>
          <input
            type="text"
            placeholder="教练姓名"
            value={form.coach}
            onChange={e => set('coach', e.target.value)}
            list="coaches-list"
            className={inputClass()}
          />
          {coaches.length > 0 && (
            <datalist id="coaches-list">
              {coaches.map(c => <option key={c} value={c} />)}
            </datalist>
          )}
        </div>

        {/* 训练内容 */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">
              训练内容 <span className="text-red-400 normal-case">*</span>
            </label>
            {hasApiKey() && (
              <button
                type="button"
                onClick={handlePolish}
                disabled={polishing || !form.content.trim()}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition disabled:opacity-40"
                style={{ borderColor: sport.accentColor + '80', color: sport.accentColor }}
              >
                {polishing ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: sport.accentColor + '40', borderTopColor: sport.accentColor }} />
                    润色中…
                  </>
                ) : '✦ AI 润色'}
              </button>
            )}
          </div>
          <textarea
            rows={5}
            placeholder="今天练了什么？教练重点纠正了哪些动作？"
            value={form.content}
            onChange={e => set('content', e.target.value)}
            className={`${inputClass(errors.content)} resize-none`}
          />
          {errors.content && <span className="text-xs text-red-500">{errors.content}</span>}
        </div>

        {/* 感悟 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">感悟</label>
          <textarea
            rows={3}
            placeholder="有什么收获或者想法？"
            value={form.reflection}
            onChange={e => set('reflection', e.target.value)}
            className={`${inputClass()} resize-none`}
          />
        </div>

        {/* 标签 */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">标签</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_TAGS.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className="px-3 py-1.5 rounded-full text-sm font-medium border transition"
                style={form.tags.includes(tag)
                  ? { backgroundColor: sport.accentColor, color: 'white', borderColor: sport.accentColor }
                  : { backgroundColor: 'white', color: '#6B7280', borderColor: '#E8E8E2' }
                }
              >
                {tag}
              </button>
            ))}
          </div>
          {form.tags.filter(t => !PRESET_TAGS.includes(t)).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {form.tags.filter(t => !PRESET_TAGS.includes(t)).map(tag => (
                <span key={tag} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium"
                  style={{ backgroundColor: sport.accentColor, color: 'white' }}>
                  {tag}
                  <button type="button" onClick={() => toggleTag(tag)} className="opacity-70 leading-none">×</button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="自定义标签，回车添加"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag() } }}
              className={`${inputClass()} flex-1`}
            />
            <button
              type="button"
              onClick={addCustomTag}
              className="px-4 py-2 rounded-xl text-sm font-medium border bg-white text-[#6B7280] border-[#E8E8E2] shrink-0"
            >
              添加
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="mt-2 text-white rounded-2xl py-4 font-semibold text-base active:opacity-80 transition"
          style={{ background: `linear-gradient(135deg, ${sport.color} 0%, ${sport.color}cc 100%)` }}
        >
          {editId ? '保存修改' : '保存记录'}
        </button>

      </form>
    </div>
  )
}
