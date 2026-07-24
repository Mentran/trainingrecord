import type { TennisLevel } from '../../types'

const TENNIS_LEVELS: Array<{ value: TennisLevel; title: string; description: string }> = [
  { value: '1.0', title: '新手入门', description: '刚开始学，先建立握拍、准备姿势和完整动作。' },
  { value: '1.5', title: '基础对打', description: '能简单来回，重点是转身、引拍和击球点。' },
  { value: '2.0', title: '基础稳定', description: '能稳定练基础动作，重点是动作链条和节奏。' },
  { value: '2.5', title: '慢速回合', description: '能打慢速回合，开始关注连续性和落点。' },
  { value: '3.0', title: '战术意识', description: '能组织简单回合，开始练线路、站位和变化。' },
]

interface TennisLevelSectionProps {
  value: TennisLevel
  onChange: (level: TennisLevel) => void
}

export default function TennisLevelSection({ value, onChange }: TennisLevelSectionProps) {
  return (
    <section>
      <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-3">网球等级</p>
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="px-4 py-4 border-b border-[#E8E8E2]">
          <p className="text-sm font-medium text-[#1A1A1A]">当前等级：{value}</p>
          <p className="text-xs text-[#9B9B9B] mt-1">用于推荐今日训练提示，先手动选择，后续可根据训练记录辅助判断。</p>
        </div>
        <div className="p-3 flex flex-col gap-2">
          {TENNIS_LEVELS.map(level => {
            const selected = value === level.value
            return (
              <button
                key={level.value}
                type="button"
                onClick={() => onChange(level.value)}
                className={`text-left rounded-xl border px-3 py-2.5 transition ${
                  selected ? 'border-[#9DC41A] bg-[#F8FBEF]' : 'border-[#E8E8E2] bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#1A1A1A]">{level.value} · {level.title}</p>
                  {selected && <span className="text-xs font-medium text-[#6A9400]">当前</span>}
                </div>
                <p className="text-xs text-[#9B9B9B] mt-1 leading-relaxed">{level.description}</p>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
