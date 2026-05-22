import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getRecords, getCoaches } from '../lib/storage'
import type { TrainingRecord } from '../types'
import PageHeader from '../components/PageHeader'
import TrainingCard, { getCoachColor } from '../components/TrainingCard'
import { useSport } from '../components/SportProvider'

export default function ListPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { sport } = useSport()
  const [records, setRecords] = useState<TrainingRecord[]>([])
  const [coaches, setCoaches] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')

  useEffect(() => {
    setRecords(getRecords(sport.id))
    setCoaches(getCoaches(sport.id))
  }, [location.key, sport.id])

  const allTags = Array.from(new Set(records.flatMap(r => r.tags ?? [])))
  const filtered = records
    .filter(r => !filter || r.coach === filter)
    .filter(r => !tagFilter || (r.tags ?? []).includes(tagFilter))

  return (
    <div className="pb-8">
      <PageHeader
        title="训练记录"
        subtitle={`共 ${filtered.length} 次训练`}
      />

      <div className="px-4 pt-4">
        {/* 教练筛选 */}
        {coaches.length > 0 && (
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
            <button
              onClick={() => setFilter('')}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                filter === '' ? 'text-white border-transparent' : 'text-[#6B7280] border-[#E8E8E2] bg-white'
              }`}
              style={filter === '' ? { backgroundColor: sport.color } : {}}
            >
              全部
            </button>
            {coaches.map(c => (
              <button
                key={c}
                onClick={() => setFilter(c === filter ? '' : c)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                  filter === c ? 'text-white border-transparent' : 'text-[#6B7280] border-[#E8E8E2] bg-white'
                }`}
                style={filter === c ? { backgroundColor: getCoachColor(c, coaches) } : {}}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {/* 标签筛选 */}
        {allTags.length > 0 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setTagFilter(tag === tagFilter ? '' : tag)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                  tagFilter === tag ? 'text-white border-transparent' : 'text-[#888] border-[#E8E8E2] bg-white'
                }`}
                style={tagFilter === tag ? { backgroundColor: sport.accentColor } : {}}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        {/* 空状态 */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="text-5xl">{sport.icon}</p>
            <p className="text-[#6B7280] text-sm">还没有训练记录</p>
            <button onClick={() => navigate('/record')} className="mt-1 text-sm font-medium" style={{ color: sport.accentColor }}>
              记录第一次训练 →
            </button>
          </div>
        )}

        {/* 记录列表 */}
        <div className="flex flex-col gap-3">
          {filtered.map(record => (
            <TrainingCard
              key={record.id}
              date={record.date}
              coach={record.coach}
              duration={record.duration}
              content={record.content}
              tags={record.tags}
              coachColor={getCoachColor(record.coach, coaches)}
              onClick={() => navigate(`/detail/${record.id}`)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
