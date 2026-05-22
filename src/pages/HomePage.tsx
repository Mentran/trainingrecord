import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getRecords, getCoaches } from '../lib/storage'
import type { TrainingRecord } from '../types'
import TrainingCard, { getCoachColor } from '../components/TrainingCard'
import { useSport } from '../components/SportProvider'

function formatGreeting() {
  const h = new Date().getHours()
  if (h < 12) return '早上好'
  if (h < 18) return '下午好'
  return '晚上好'
}

function formatToday() {
  return new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })
}

function daysSinceLastTraining(records: TrainingRecord[]): number | null {
  if (records.length === 0) return null
  const last = records[0].date
  const today = new Date().toISOString().slice(0, 10)
  const diff = Math.floor((new Date(today).getTime() - new Date(last).getTime()) / 86400000)
  return diff
}

export default function HomePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { sport, sports, switchSport } = useSport()
  const [records, setRecords] = useState<TrainingRecord[]>([])
  const [coaches, setCoaches] = useState<string[]>([])

  useEffect(() => {
    setRecords(getRecords(sport.id))
    setCoaches(getCoaches(sport.id))
  }, [location.key, sport.id])

  const totalSessions = records.length
  const totalHours = Math.round(records.reduce((s, r) => s + (r.duration ?? 0), 0) / 60 * 10) / 10
  const totalCoaches = coaches.length
  const recent = records.slice(0, 3)
  const daysSince = daysSinceLastTraining(records)

  // 根据训练数据调整装饰圆的视觉强度
  const intensity = Math.min(totalSessions / 20, 1) // 20次训练达到最大强度
  const circle1Opacity = 0.08 + intensity * 0.08 // 0.08 - 0.16
  const circle2Opacity = 0.06 + intensity * 0.06 // 0.06 - 0.12

  const headerBg = `linear-gradient(150deg, ${sport.color} 0%, ${sport.color}e0 60%, ${sport.accentColor}55 100%)`

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="px-5 pt-14 pb-8 relative overflow-hidden" style={{ background: headerBg }}>
        {/* 装饰圆 */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full float-circle-1"
          style={{ background: sport.accentColor, opacity: circle1Opacity }} />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full float-circle-2"
          style={{ background: sport.accentColor, opacity: circle2Opacity }} />

        {/* 右上角设置按钮 */}
        <button onClick={() => navigate('/settings')}
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full z-10"
          style={{ background: 'rgba(255,255,255,0.15)' }}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="2.5" stroke="white" strokeWidth="1.5"/>
            <path d="M10 2v1.5M10 16.5V18M2 10h1.5M16.5 10H18M4.1 4.1l1.06 1.06M14.84 14.84l1.06 1.06M4.1 15.9l1.06-1.06M14.84 5.16l1.06-1.06"
              stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>

        {/* 多运动切换 */}
        {sports.length > 1 && (
          <div className="flex gap-2 mb-5 overflow-x-auto scrollbar-none pb-0.5">
            {sports.map(s => (
              <button key={s.id} onClick={() => switchSport(s.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold flex-shrink-0 transition"
                style={s.id === sport.id
                  ? { background: sport.accentColor, color: '#fff' }
                  : { background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)' }
                }>
                <span>{s.icon}</span><span>{s.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* 问候 */}
        <div className="relative mb-7">
          <p className="text-white/50 text-sm font-medium">{formatToday()}</p>
          <h1 className="text-3xl font-bold text-white mt-1 tracking-tight">
            {formatGreeting()} {sport.icon}
          </h1>
          {daysSince !== null && daysSince >= 2 && (
            <div className="mt-3 flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2 w-fit">
              <span className="text-base">⏰</span>
              <span className="text-white/80 text-xs font-medium">
                距上次训练已过 <span className="text-white font-bold">{daysSince}</span> 天，该练了！
              </span>
            </div>
          )}
          {daysSince === 0 && (
            <div className="mt-3 flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2 w-fit">
              <span className="text-base">🔥</span>
              <span className="text-white/80 text-xs font-medium">今天已训练，继续保持！</span>
            </div>
          )}
        </div>

        {/* 统计数字 */}
        <div className="grid grid-cols-3 gap-3 relative">
          {[
            { value: totalSessions, unit: '次', label: '训练' },
            { value: totalHours, unit: 'h', label: '总时长' },
            { value: totalCoaches, unit: '位', label: '教练' },
          ].map(stat => (
            <div key={stat.label} className="rounded-2xl p-3.5 text-center"
              style={{ background: 'rgba(255,255,255,0.12)' }}>
              <div className="flex items-end justify-center gap-0.5 mb-0.5">
                <span className="text-[32px] font-bold text-white leading-none">{stat.value}</span>
                <span className="text-white/60 text-sm mb-1">{stat.unit}</span>
              </div>
              <p className="text-white/40 text-xs">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 内容区 */}
      <div className="px-4 pt-5">
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl"
              style={{ background: sport.accentColor + '18' }}>
              {sport.icon}
            </div>
            <p className="text-[#888] text-sm mt-1">还没有{sport.name}训练记录</p>
            <p className="text-[#ADADAD] text-xs">点击右下角按钮开始记录</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-[#ADADAD] uppercase tracking-widest">最近训练</h2>
              {records.length > 3 && (
                <button onClick={() => navigate('/list')}
                  className="text-xs font-semibold" style={{ color: sport.accentColor }}>
                  全部 {records.length} 条 →
                </button>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {recent.map(r => (
                <TrainingCard key={r.id} date={r.date} coach={r.coach} duration={r.duration}
                  content={r.content} coachColor={getCoachColor(r.coach, coaches)}
                  onClick={() => navigate(`/detail/${r.id}`)} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* 浮动录入按钮 */}
      <button
        onClick={() => navigate('/record')}
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full flex items-center justify-center active:scale-90 transition-transform z-40"
        style={{
          background: `linear-gradient(135deg, ${sport.color} 0%, ${sport.color}cc 100%)`,
          boxShadow: `0 8px 24px ${sport.accentColor}55, 0 2px 8px rgba(0,0,0,0.15)`,
        }}
        aria-label="记录训练"
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M11 4v14M4 11h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  )
}
