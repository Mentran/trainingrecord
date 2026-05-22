import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getRecords, getCoaches } from '../lib/storage'
import type { TrainingRecord } from '../types'
import TrainingCard, { getCoachColor } from '../components/TrainingCard'
import { useSport } from '../components/SportProvider'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const COACH_COLORS = ['#E8A838', '#4A90D9', '#E85D5D', '#9B59B6', '#1ABC9C']

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}
function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
function buildHeatColors(accentColor: string): string[] {
  const [r, g, b] = hexToRgb(accentColor)
  return [
    `rgba(${r},${g},${b},0.15)`,
    `rgba(${r},${g},${b},0.38)`,
    `rgba(${r},${g},${b},0.65)`,
    `rgba(${r},${g},${b},1)`,
  ]
}

function longestStreak(records: TrainingRecord[]): number {
  if (records.length === 0) return 0
  const dates = new Set(records.map(r => r.date))
  let max = 0, cur = 0
  const d = new Date()
  for (let i = 0; i < 365; i++) {
    const s = d.toISOString().slice(0, 10)
    if (dates.has(s)) { cur++; max = Math.max(max, cur) } else { cur = 0 }
    d.setDate(d.getDate() - 1)
  }
  return max
}

interface DayCell { date: string; minutes: number; isFuture: boolean }

function buildYearGrid(): DayCell[][] {
  const today = new Date()
  const start = new Date(today)
  start.setDate(start.getDate() - 52 * 7 + 1)
  start.setDate(start.getDate() - start.getDay())
  const weeks: DayCell[][] = []
  const cur = new Date(start)
  for (let w = 0; w < 53; w++) {
    const week: DayCell[] = []
    for (let d = 0; d < 7; d++) {
      week.push({ date: cur.toISOString().slice(0, 10), minutes: 0, isFuture: cur > today })
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

function buildMonthLabels(weeks: DayCell[][]): { label: string; col: number }[] {
  const labels: { label: string; col: number }[] = []
  let last = -1
  weeks.forEach((week, col) => {
    const m = new Date(week[0].date + 'T00:00:00').getMonth()
    if (m !== last) {
      labels.push({ label: new Date(week[0].date + 'T00:00:00').toLocaleDateString('zh-CN', { month: 'short' }), col })
      last = m
    }
  })
  return labels
}

function buildWeeklyData(records: TrainingRecord[]): { label: string; value: number }[] {
  const today = new Date()
  const result: { label: string; value: number }[] = []
  for (let w = 7; w >= 0; w--) {
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay() - w * 7)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 7)
    const count = records.filter(r => {
      const d = new Date(r.date + 'T00:00:00')
      return d >= weekStart && d < weekEnd
    }).length
    result.push({ label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`, value: count })
  }
  return result
}

function buildMonthlyData(records: TrainingRecord[]): { label: string; value: number }[] {
  const today = new Date()
  const result: { label: string; value: number }[] = []
  for (let m = 5; m >= 0; m--) {
    const d = new Date(today.getFullYear(), today.getMonth() - m, 1)
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const mins = records.filter(r => r.date.startsWith(prefix)).reduce((s, r) => s + (r.duration ?? 0), 0)
    result.push({ label: `${d.getMonth() + 1}月`, value: Math.round(mins / 60 * 10) / 10 })
  }
  return result
}

function buildCoachData(records: TrainingRecord[], coaches: string[]): { coach: string; count: number; pct: number }[] {
  const total = records.length
  if (total === 0) return []
  return coaches
    .map(coach => ({ coach, count: records.filter(r => r.coach === coach).length }))
    .filter(d => d.count > 0)
    .sort((a, b) => b.count - a.count)
    .map(d => ({ ...d, pct: Math.round(d.count / total * 100) }))
}

function BarChart({ data, accentColor, unit = '' }: {
  data: { label: string; value: number }[]
  accentColor: string
  unit?: string
}) {
  const maxVal = Math.max(...data.map(d => d.value), 1)
  const W = 280, H = 110
  const BOTTOM = 18, TOP = 18
  const chartH = H - BOTTOM - TOP
  const n = data.length
  const gap = 5
  const barW = (W - gap * (n - 1)) / n

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {data.map((d, i) => {
        const barH = d.value === 0 ? 2 : Math.max(4, (d.value / maxVal) * chartH)
        const x = i * (barW + gap)
        const y = TOP + chartH - barH
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx={3}
              fill={d.value === 0 ? '#EBEBEB' : accentColor}
              opacity={d.value === 0 ? 1 : 0.82}
            />
            {d.value > 0 && (
              <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={8} fill={accentColor} fontWeight="600">
                {d.value}{unit}
              </text>
            )}
            <text x={x + barW / 2} y={H - 2} textAnchor="middle" fontSize={9} fill="#ADADAD">
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function CoachBreakdown({ data }: { data: { coach: string; count: number; pct: number }[] }) {
  if (data.length === 0) return <p className="text-sm text-[#ADADAD] text-center py-4">暂无数据</p>
  return (
    <div className="flex flex-col gap-3.5">
      {data.map((d, i) => (
        <div key={d.coach}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: COACH_COLORS[i % COACH_COLORS.length] }} />
              <span className="text-sm font-medium text-[#1A1A1A]">{d.coach}</span>
            </div>
            <span className="text-xs text-[#888]">{d.count} 次 · {d.pct}%</span>
          </div>
          <div className="h-2 bg-[#F0F0EC] rounded-full overflow-hidden">
            <div className="h-full rounded-full"
              style={{ width: `${d.pct}%`, backgroundColor: COACH_COLORS[i % COACH_COLORS.length] }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function CalendarPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { sport } = useSport()
  const now = new Date()
  const [view, setView] = useState<'month' | 'year' | 'stats'>('month')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [records, setRecords] = useState<TrainingRecord[]>([])
  const [coaches, setCoaches] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    setRecords(getRecords(sport.id))
    setCoaches(getCoaches(sport.id))
  }, [location.key, sport.id])

  const heatColors = buildHeatColors(sport.accentColor)
  function heatColor(minutes: number): string {
    if (minutes === 0) return 'transparent'
    if (minutes < 30) return heatColors[0]
    if (minutes < 60) return heatColors[1]
    if (minutes < 90) return heatColors[2]
    return heatColors[3]
  }

  const recordsByDate = records.reduce<Record<string, TrainingRecord[]>>((acc, r) => {
    if (!acc[r.date]) acc[r.date] = []
    acc[r.date].push(r)
    return acc
  }, {})

  const durationByDate = records.reduce<Record<string, number>>((acc, r) => {
    if (!acc[r.date]) acc[r.date] = 0
    acc[r.date] += r.duration ?? 0
    return acc
  }, {})

  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthRecords = records.filter(r => r.date.startsWith(monthPrefix))
  const monthSessions = monthRecords.length
  const monthMinutes = monthRecords.reduce((s, r) => s + (r.duration ?? 0), 0)

  const totalSessions = records.length
  const totalHours = Math.round(records.reduce((s, r) => s + (r.duration ?? 0), 0) / 60 * 10) / 10
  const streak = longestStreak(records)

  const yearGrid = buildYearGrid().map(week =>
    week.map(cell => ({ ...cell, minutes: durationByDate[cell.date] ?? 0 }))
  )
  const monthLabels = buildMonthLabels(yearGrid)

  const todayStr = now.toISOString().slice(0, 10)
  const selectedRecords = selected ? (recordsByDate[selected] ?? []) : []

  const headerBg = `linear-gradient(135deg, ${sport.color} 0%, ${sport.color}cc 100%)`

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="px-4 pt-12 pb-5" style={{ background: headerBg }}>
        <div className="flex items-center justify-between mb-4">
          {view === 'month' ? (
            <>
              <button onClick={() => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1); setSelected(null) }}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-white/15 text-white">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <h1 className="text-lg font-semibold text-white">{year} 年 {month + 1} 月</h1>
              <button onClick={() => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1); setSelected(null) }}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-white/15 text-white">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </>
          ) : (
            <h1 className="text-lg font-semibold text-white flex-1">
              {view === 'year' ? '过去一年' : '训练统计'}
            </h1>
          )}
        </div>

        {/* 视图切换 */}
        <div className="flex gap-1 bg-white/10 rounded-xl p-1 mb-4">
          {(['month', 'year', 'stats'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition ${view === v ? 'bg-white text-[#1A1A1A]' : 'text-white/70'}`}>
              {v === 'month' ? '月' : v === 'year' ? '年' : '统计'}
            </button>
          ))}
        </div>

        {/* 统计数字 */}
        {view === 'month' ? (
          <div className="flex gap-4 justify-center">
            <div className="text-center">
              <span className="text-2xl font-bold text-white">{monthSessions}</span>
              <p className="text-white/50 text-xs mt-0.5">次训练</p>
            </div>
            <div className="w-px bg-white/20" />
            <div className="text-center">
              <span className="text-2xl font-bold text-white">{Math.round(monthMinutes / 60 * 10) / 10}</span>
              <p className="text-white/50 text-xs mt-0.5">小时</p>
            </div>
          </div>
        ) : (
          <div className="flex gap-3 justify-center">
            {[
              { v: totalSessions, u: '次', l: '总训练' },
              { v: totalHours, u: 'h', l: '总时长' },
              { v: streak, u: '天', l: '最长连续' },
            ].map(s => (
              <div key={s.l} className="flex-1 bg-white/10 rounded-xl p-2.5 text-center">
                <div className="flex items-end justify-center gap-0.5">
                  <span className="text-2xl font-bold text-white leading-none">{s.v}</span>
                  <span className="text-white/60 text-xs mb-0.5">{s.u}</span>
                </div>
                <p className="text-white/40 text-xs mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pt-4">
        {view === 'month' && (
          <>
            {/* 星期头 */}
            <div className="grid grid-cols-7 mb-2">
              {WEEKDAYS.map(d => <div key={d} className="text-center text-xs text-[#6B7280] py-1">{d}</div>)}
            </div>
            {/* 日期格子 */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOfMonth(year, month) }).map((_, i) => <div key={`e-${i}`} />)}
              {Array.from({ length: daysInMonth(year, month) }).map((_, i) => {
                const day = i + 1
                const dateStr = toDateStr(year, month, day)
                const minutes = durationByDate[dateStr] ?? 0
                const isToday = dateStr === todayStr
                const isSelected = dateStr === selected
                return (
                  <button key={day} onClick={() => setSelected(isSelected ? null : dateStr)}
                    className={`relative flex items-center justify-center h-10 rounded-xl text-sm transition ${isToday ? 'font-bold' : ''}`}
                    style={{
                      backgroundColor: minutes > 0 ? heatColor(minutes) : undefined,
                      boxShadow: isSelected ? `0 0 0 2px ${sport.accentColor}` : undefined,
                    }}>
                    <span style={{ color: minutes > 0 ? sport.color : isToday ? sport.accentColor : '#1A1A1A' }}>{day}</span>
                  </button>
                )
              })}
            </div>
            {/* 图例 */}
            <div className="flex items-center gap-1.5 justify-end mt-3 mb-4">
              <span className="text-xs text-[#9B9B9B]">少</span>
              {heatColors.map((c, i) => <div key={i} className="w-4 h-4 rounded" style={{ backgroundColor: c }} />)}
              <span className="text-xs text-[#9B9B9B]">多</span>
            </div>
          </>
        )}

        {view === 'year' && (
          <div className="mb-4">
            <div className="overflow-x-auto pb-2 -mx-4 px-4">
              <div style={{ width: `${53 * 14}px` }}>
                {/* 月份标签 */}
                <div className="relative h-5 mb-1">
                  {monthLabels.map(({ label, col }) => (
                    <span key={col} className="absolute text-xs text-[#9B9B9B]"
                      style={{ left: `${col * 14}px` }}>{label}</span>
                  ))}
                </div>
                {/* 格子 */}
                <div className="flex gap-[3px]">
                  {yearGrid.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-[3px]">
                      {week.map((cell, di) => (
                        <button
                          key={di}
                          onClick={() => !cell.isFuture && setSelected(selected === cell.date ? null : cell.date)}
                          className="rounded-sm transition-transform active:scale-90"
                          style={{
                            width: 11, height: 11,
                            backgroundColor: cell.isFuture ? '#E8E8E2' : cell.minutes > 0 ? heatColor(cell.minutes) : '#EBEBEB',
                            boxShadow: selected === cell.date ? `0 0 0 1.5px ${sport.accentColor}` : undefined,
                          }}
                          title={cell.date}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* 图例 */}
            <div className="flex items-center gap-1.5 justify-end mt-2">
              <span className="text-xs text-[#9B9B9B]">少</span>
              {heatColors.map((c, i) => <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />)}
              <span className="text-xs text-[#9B9B9B]">多</span>
            </div>
          </div>
        )}

        {view === 'stats' && (
          <div className="flex flex-col gap-4 pb-4">
            {/* 每周训练次数 */}
            <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)' }}>
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="text-sm font-semibold text-[#1A1A1A]">每周训练次数</h3>
                <span className="text-xs text-[#ADADAD]">近 8 周</span>
              </div>
              <BarChart data={buildWeeklyData(records)} accentColor={sport.accentColor} unit="次" />
            </div>

            {/* 每月训练时长 */}
            <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)' }}>
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="text-sm font-semibold text-[#1A1A1A]">每月训练时长</h3>
                <span className="text-xs text-[#ADADAD]">近 6 个月</span>
              </div>
              <BarChart data={buildMonthlyData(records)} accentColor={sport.accentColor} unit="h" />
            </div>

            {/* 教练分布 */}
            {coaches.length > 0 && (
              <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)' }}>
                <div className="flex items-baseline justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[#1A1A1A]">教练分布</h3>
                  <span className="text-xs text-[#ADADAD]">全部记录</span>
                </div>
                <CoachBreakdown data={buildCoachData(records, coaches)} />
              </div>
            )}

            {records.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                  style={{ background: sport.accentColor + '18' }}>
                  {sport.icon}
                </div>
                <p className="text-sm text-[#888]">还没有训练记录</p>
              </div>
            )}
          </div>
        )}

        {/* 选中日期的记录（月/年视图） */}
        {selected && view !== 'stats' && (
          <div>
            <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-3">
              {new Date(selected + 'T00:00:00').toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}
            </p>
            {selectedRecords.length === 0 ? (
              <div className="bg-white rounded-2xl card-shadow p-5 text-center">
                <p className="text-sm text-[#6B7280]">当天没有训练记录</p>
                <button onClick={() => navigate(`/record?date=${selected}`)}
                  className="mt-2 text-sm font-medium" style={{ color: sport.accentColor }}>
                  添加记录 →
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {selectedRecords.map(r => (
                  <TrainingCard key={r.id} date={r.date} coach={r.coach} duration={r.duration}
                    content={r.content} coachColor={getCoachColor(r.coach, coaches)}
                    onClick={() => navigate(`/detail/${r.id}`)} compact />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
