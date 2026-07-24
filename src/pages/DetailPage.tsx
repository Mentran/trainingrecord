import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { deleteRecord, updateRecord } from '../lib/storage'
import { hasApiKey, polishText } from '../lib/ai'
import { useToast } from '../contexts/ToastContext'
import { getCoachColor } from '../lib/recordPresentation'
import { useSport } from '../contexts/SportContext'
import { getRecommendedTrainingPrompt, getTennisKnowledgeCard, isTennisSport } from '../data/tennisKnowledge'
import { FOCUS_OUTCOME_LABELS, getUnresolvedFocusStreak, isUnresolvedFocusOutcome } from '../lib/trainingFocus'
import type { TrainingFocusOutcome } from '../types'
import { useCoaches, useRecords } from '../hooks/useLocalData'

const FOCUS_OUTCOMES: TrainingFocusOutcome[] = ['improved', 'unchanged', 'worse']

function formatDate(date: string) {
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
}

export default function DetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { showToast } = useToast()
  const { sport } = useSport()

  const records = useRecords()
  const coaches = useCoaches()
  const record = records.find(item => item.id === id)
  const [polishing, setPolishing] = useState(false)
  const [preview, setPreview] = useState<{ content: string; reflection: string } | null>(null)

  if (!record) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-64 gap-3">
        <p className="text-[#6B7280]">记录不存在</p>
        <button onClick={() => navigate('/')} className="text-sm font-medium" style={{ color: sport.accentColor }}>返回列表</button>
      </div>
    )
  }

  const coachColor = getCoachColor(record.coach, coaches)
  const apiConfigured = hasApiKey()
  const justSaved = searchParams.get('saved') === '1'
  const focusStreak = getUnresolvedFocusStreak(
    records.filter(item => item.sportId === record.sportId),
    record,
  )
  const relatedPrompt = justSaved && isTennisSport(sport)
    ? getRecommendedTrainingPrompt(sport.level ?? '2.0', [record], record.focus ? 1 : 0)
    : null

  function handleDelete() {
    if (!confirm('确定删除这条记录？')) return
    deleteRecord(record!.id)
    showToast('已删除')
    navigate('/')
  }

  async function handlePolish() {
    if (!apiConfigured) {
      showToast('请先在设置页配置 API Key', 'error')
      return
    }
    setPolishing(true)
    try {
      const result = await polishText(record!.content, record!.reflection)
      setPreview(result)
    } catch (e) {
      showToast((e as Error).message || 'AI 润色失败，请重试', 'error')
    } finally {
      setPolishing(false)
    }
  }

  function applyPolish() {
    if (!preview) return
    updateRecord(record!.id, {
      content: preview.content,
      reflection: preview.reflection,
      polishStatus: 'applied',
    })
    setPreview(null)
    showToast('已应用润色')
  }

  function handleFocusOutcome(outcome: TrainingFocusOutcome) {
    if (!record!.focus) return
    updateRecord(record!.id, {
      focus: { ...record!.focus, outcome },
    })
    showToast(`已记录：${FOCUS_OUTCOME_LABELS[outcome]}`)
  }

  function navigateWithFocus(text: string, cardId?: string, category?: string) {
    const params = new URLSearchParams({ focus: text })
    if (cardId) params.set('focusCardId', cardId)
    if (category) params.set('tag', category)
    navigate(`/record?${params.toString()}`)
  }

  function handleCarryFocus() {
    if (!record!.focus) return
    const card = getTennisKnowledgeCard(record!.focus.cardId)
    const category = card?.category ?? record!.tags?.find(tag => sport.categories.includes(tag))
    navigateWithFocus(record!.focus.text, record!.focus.cardId, category)
  }

  return (
    <div className="pb-8">
      {/* 深色 Header */}
      <div
        className="px-4 pt-12 pb-6"
        style={{ background: `linear-gradient(135deg, ${sport.color} 0%, ${sport.color}cc 100%)` }}
      >
        <div className="flex items-start justify-between mb-4">
          <button
            onClick={() => navigate(-1)}
            aria-label="返回"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/15 text-white"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/record?edit=${record.id}`)}
              className="px-3 py-1.5 rounded-full bg-white/15 text-white text-sm font-medium"
            >
              编辑
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 rounded-full bg-red-500/30 text-red-200 text-sm font-medium"
            >
              删除
            </button>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">{formatDate(record.date)}</h1>

        <div className="flex gap-2 flex-wrap">
          {record.coach && (
            <span className="px-3 py-1 rounded-full text-sm font-medium text-white" style={{ backgroundColor: coachColor }}>
              {record.coach}
            </span>
          )}
          {record.duration > 0 && (
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-white/15 text-white">
              {record.duration} 分钟
            </span>
          )}
          {record.polishStatus === 'applied' && (
            <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: sport.accentColor + '40', color: sport.accentColor }}>
              ✦ AI 润色
            </span>
          )}
          {record.tags && record.tags.map(tag => (
            <span key={tag} className="px-3 py-1 rounded-full text-sm font-medium bg-white/10 text-white/70">
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* 内容区 */}
      <div className="px-4 pt-5 flex flex-col gap-4">

        {record.focus && (
          <div>
            <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-2">本次训练关注</p>
            <div className="rounded-2xl border p-4" style={{ background: sport.accentColor + '12', borderColor: sport.accentColor + '40' }}>
              <p className="text-sm font-medium leading-relaxed" style={{ color: sport.color }}>🎯 {record.focus.text}</p>
              <div className="grid grid-cols-3 gap-2 mt-3">
                {FOCUS_OUTCOMES.map(outcome => (
                  <button
                    key={outcome}
                    type="button"
                    aria-pressed={record.focus?.outcome === outcome}
                    onClick={() => handleFocusOutcome(outcome)}
                    className="rounded-xl border px-2 py-2 text-xs font-medium transition"
                    style={record.focus?.outcome === outcome
                      ? { background: sport.color, borderColor: sport.color, color: 'white' }
                      : { background: 'white', borderColor: sport.accentColor + '55', color: sport.color }}
                  >
                    {FOCUS_OUTCOME_LABELS[outcome]}
                  </button>
                ))}
              </div>
              {record.focus.note && (
                <p className="mt-3 rounded-xl bg-white/75 px-3 py-2 text-xs leading-relaxed text-[#6B7280]">
                  证据：{record.focus.note}
                </p>
              )}
              {isUnresolvedFocusOutcome(record.focus.outcome) && (
                <button
                  type="button"
                  onClick={handleCarryFocus}
                  className="mt-3 w-full rounded-xl py-2.5 text-xs font-semibold text-white"
                  style={{ background: sport.color }}
                >
                  延续到下次训练
                </button>
              )}
              {focusStreak >= 3 && (
                <p className="mt-3 text-xs leading-relaxed text-amber-700">
                  这个问题已连续 {focusStreak} 次没有改善。下次建议降低练习难度，或请教练只纠正这一件事。
                </p>
              )}
            </div>
          </div>
        )}

        {relatedPrompt && (
          <div className="bg-white rounded-2xl card-shadow overflow-hidden">
            <div className="p-4">
              <p className="text-xs font-semibold mb-2" style={{ color: sport.accentColor }}>保存成功 · 下一步建议</p>
              <p className="text-base font-semibold text-[#1A1A1A]">{relatedPrompt.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-[#6B7280]">{relatedPrompt.drill}</p>
              <div className="mt-3 rounded-xl px-3 py-2" style={{ background: sport.accentColor + '14' }}>
                <p className="text-xs leading-relaxed" style={{ color: sport.color }}>{relatedPrompt.focus}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigateWithFocus(relatedPrompt.focus, relatedPrompt.id, relatedPrompt.category)}
              className="w-full border-t border-[#E8E8E2] py-3 text-sm font-semibold"
              style={{ color: sport.accentColor }}
            >
              设为下次关注
            </button>
          </div>
        )}

        {/* 润色预览对比 */}
        {preview && (
          <div className="bg-white rounded-2xl card-shadow overflow-hidden">
            <div className="px-4 pt-4 pb-2 border-b border-[#E8E8E2]">
              <p className="text-sm font-semibold text-[#1A1A1A]">✦ AI 润色建议</p>
              <p className="text-xs text-[#6B7280] mt-0.5">选择应用或放弃</p>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div>
                <p className="text-xs text-[#6B7280] mb-1">训练内容</p>
                <p className="text-sm text-[#1A1A1A] leading-relaxed whitespace-pre-wrap">{preview.content}</p>
              </div>
              {preview.reflection && (
                <div>
                  <p className="text-xs text-[#6B7280] mb-1">感悟</p>
                  <p className="text-sm text-[#1A1A1A] leading-relaxed whitespace-pre-wrap">{preview.reflection}</p>
                </div>
              )}
            </div>
            <div className="flex border-t border-[#E8E8E2]">
              <button
                onClick={() => setPreview(null)}
                className="flex-1 py-3 text-sm text-[#6B7280] font-medium border-r border-[#E8E8E2]"
              >
                放弃
              </button>
              <button
                onClick={applyPolish}
                className="flex-1 py-3 text-sm font-semibold"
                style={{ color: sport.accentColor }}
              >
                应用润色
              </button>
            </div>
          </div>
        )}

        {/* 训练内容 */}
        <div>
          <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-2">训练内容</p>
          <div className="bg-white rounded-2xl card-shadow p-4">
            <p className="text-[#1A1A1A] text-sm leading-relaxed whitespace-pre-wrap">{record.content}</p>
          </div>
        </div>

        {/* 感悟 */}
        {record.reflection && (
          <div>
            <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-2">感悟</p>
            <div className="rounded-2xl p-4" style={{ backgroundColor: sport.accentColor + '18' }}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: sport.color }}>{record.reflection}</p>
            </div>
          </div>
        )}

        {/* 润色按钮 */}
        {!preview && (
          <button
            onClick={handlePolish}
            disabled={polishing}
            className={`w-full py-3 rounded-2xl text-sm font-medium border transition flex items-center justify-center gap-2 disabled:opacity-50`}
            style={apiConfigured ? { borderColor: sport.accentColor, color: sport.accentColor } : { borderColor: '#E8E8E2', color: '#9B9B9B' }}
          >
            {polishing ? (
              <>
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 6"/>
                </svg>
                润色中…
              </>
            ) : (
              <>✦ {apiConfigured ? 'AI 润色' : 'AI 润色（需配置 API Key）'}</>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
