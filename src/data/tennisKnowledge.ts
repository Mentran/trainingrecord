import type { TennisLevel, TrainingRecord } from '../types'

export type TennisKnowledgeCategory = '正手' | '反手' | '发球' | '步伐' | '截击' | '战术'
export type TennisVisualType = 'forehand' | 'backhand' | 'serve' | 'footwork' | 'court'

export interface TennisKnowledgeCard {
  id: string
  level: TennisLevel
  category: TennisKnowledgeCategory
  title: string
  fact: string
  why: string
  drill: string
  focus: string
  visualType: TennisVisualType
}

const LEVEL_RANK: Record<TennisLevel, number> = {
  '1.0': 1,
  '1.5': 2,
  '2.0': 3,
  '2.5': 4,
  '3.0': 5,
}

export const TENNIS_KNOWLEDGE_CARDS: TennisKnowledgeCard[] = [
  {
    id: 'forehand-grip-loose-10',
    level: '1.0',
    category: '正手',
    title: '握拍不要捏死',
    fact: '正手刚开始不需要大力，先让手腕和前臂保持放松。',
    why: '握拍太紧会让拍头僵住，转身和送拍都很难做完整。',
    drill: '原地慢挥 20 次，只用 5 分力，感受球拍自然经过身体前方。',
    focus: '今天记录：握拍有没有从始至终保持放松？',
    visualType: 'forehand',
  },
  {
    id: 'forehand-ready-turn-15',
    level: '1.5',
    category: '正手',
    title: '先转身再挥拍',
    fact: '正手稳定的第一步不是挥拍，而是来球后尽早转肩侧身。',
    why: '如果正面等球，最后只能用手臂补救，动作会越来越急。',
    drill: '喂球 20 个，每球只检查一件事：球过网前是否已经转身。',
    focus: '今天记录：有没有提前转肩，而不是等球到了才拉拍？',
    visualType: 'forehand',
  },
  {
    id: 'forehand-contact-front-20',
    level: '2.0',
    category: '正手',
    title: '击球点要在身体前方',
    fact: '正手稳定性差，很多时候不是挥拍问题，而是击球点太晚。',
    why: '击球点晚会让身体被球挤住，只能用手臂硬推，动作容易变形。',
    drill: '慢速喂球 20 个，只关注提前转身，并在身体前方击球。',
    focus: '今天记录：有没有更早判断落点，给身体留出空间？',
    visualType: 'forehand',
  },
  {
    id: 'forehand-complete-chain-20',
    level: '2.0',
    category: '正手',
    title: '动作完整比发力重要',
    fact: '2.0 阶段正手最重要的是稳定完成转身、引拍、击球、收拍链条。',
    why: '动作链条没稳定时发力，只会放大错误，让球速和失误一起增加。',
    drill: '用 50% 力量连续打 20 个正手，目标是动作完整，不追求速度。',
    focus: '今天记录：哪一环最容易断，转身、引拍、击球还是收拍？',
    visualType: 'forehand',
  },
  {
    id: 'forehand-rhythm-25',
    level: '2.5',
    category: '正手',
    title: '慢一点反而更快',
    fact: '回合中动作节奏清楚，比单拍速度更重要。',
    why: '节奏太急会让脚步、引拍、击球点全部乱掉，连续性反而下降。',
    drill: '连续 10 个正手只打 6 分力，每拍都完整收拍后再准备下一球。',
    focus: '今天记录：连续击球时动作有没有越打越急？',
    visualType: 'forehand',
  },
  {
    id: 'backhand-watch-ball-10',
    level: '1.0',
    category: '反手',
    title: '反手先看球',
    fact: '反手初学时，眼睛容易提前看网或看目标，身体就会跟着乱。',
    why: '没看清弹跳和击球点，脚步和挥拍都会变成猜。',
    drill: '反手喂球 15 个，每球默念弹跳位置，再开始挥拍。',
    focus: '今天记录：反手时眼睛有没有跟到球弹起来？',
    visualType: 'backhand',
  },
  {
    id: 'backhand-shoulder-turn-15',
    level: '1.5',
    category: '反手',
    title: '反手提前转肩',
    fact: '反手不是只把拍子拉到身体另一侧，而是先让肩膀转过去。',
    why: '肩膀不转，击球时身体会正面硬顶，发力和稳定性都差。',
    drill: '每次来球先转肩停半拍，再完成击球，连续 15 个。',
    focus: '今天记录：反手准备时肩膀有没有真正转过去？',
    visualType: 'backhand',
  },
  {
    id: 'backhand-stand-stable-20',
    level: '2.0',
    category: '反手',
    title: '先站稳再击球',
    fact: '反手容易慌，常见原因是脚还没停稳就开始挥拍。',
    why: '身体还在漂时，击球点和拍面都会不稳定。',
    drill: '慢速喂球 20 个，要求每球击球前小碎步调整并站稳。',
    focus: '今天记录：反手击球前有没有最后的小碎步调整？',
    visualType: 'backhand',
  },
  {
    id: 'backhand-forward-25',
    level: '2.5',
    category: '反手',
    title: '反手也要向前送',
    fact: '反手稳定后，要避免只横着扫，拍子需要向目标方向送出去。',
    why: '只横扫会让线路短、球质飘，也更难控制深度。',
    drill: '反手连续 10 球，目标是过网后落在发球线后方。',
    focus: '今天记录：反手有没有向前送拍，而不是只横向甩？',
    visualType: 'backhand',
  },
  {
    id: 'serve-toss-simple-10',
    level: '1.0',
    category: '发球',
    title: '发球先稳定抛球',
    fact: '发球最先该练的不是力量，而是每次把球抛到相近位置。',
    why: '抛球不稳定，后面的蹬腿、挥拍和击球点都无法重复。',
    drill: '不击球，只抛球 20 次，让球落在前脚前方一小步附近。',
    focus: '今天记录：抛球位置是否稳定，还是每次都不一样？',
    visualType: 'serve',
  },
  {
    id: 'serve-relax-wrist-15',
    level: '1.5',
    category: '发球',
    title: '发球手臂要松',
    fact: '发球不是用手腕硬砸，而是让肩膀和手臂自然带动球拍。',
    why: '手腕太紧会让动作断掉，也更容易累和受伤。',
    drill: '半速发球 15 个，只关注手臂放松和动作连贯。',
    focus: '今天记录：发球时手腕和前臂有没有紧绷？',
    visualType: 'serve',
  },
  {
    id: 'serve-complete-motion-20',
    level: '2.0',
    category: '发球',
    title: '先连贯再加速',
    fact: '2.0 阶段发球要先把抛球、引拍、击球、随挥连起来。',
    why: '动作不连贯时加速，只会让击球点更飘，稳定性更差。',
    drill: '每次发球前放慢准备动作，连续发 10 个完整动作球。',
    focus: '今天记录：发球动作是不是一段一段断开的？',
    visualType: 'serve',
  },
  {
    id: 'serve-target-30',
    level: '3.0',
    category: '发球',
    title: '发球开始练落点',
    fact: '发球稳定后，落点选择比单纯加力更能制造优势。',
    why: '能发向不同区域，下一拍才更容易主动组织。',
    drill: '每边各发 10 个，目标分别放到外角和身体附近。',
    focus: '今天记录：发球有没有明确目标，还是只想发进？',
    visualType: 'serve',
  },
  {
    id: 'footwork-small-steps-10',
    level: '1.0',
    category: '步伐',
    title: '最后一步用小碎步',
    fact: '很多击球别扭，不是手的问题，而是最后站位没调好。',
    why: '大步跑到位后如果不微调，球会离身体太近或太远。',
    drill: '喂球 15 个，每球跑到位后必须再做两三下小碎步。',
    focus: '今天记录：击球前有没有最后的小碎步？',
    visualType: 'footwork',
  },
  {
    id: 'footwork-recover-15',
    level: '1.5',
    category: '步伐',
    title: '击球后要回位',
    fact: '打完一拍不是结束，回到合适位置才是下一拍的开始。',
    why: '不回位会让下一球永远被动，动作也更容易慌。',
    drill: '一拍击球后立刻回到中间准备位，连续 10 组。',
    focus: '今天记录：击球后有没有看球发呆，没有回位？',
    visualType: 'footwork',
  },
  {
    id: 'footwork-find-contact-20',
    level: '2.0',
    category: '步伐',
    title: '脚步是为了找击球点',
    fact: '脚步练习不是跑得快，而是把身体移动到舒服的击球点。',
    why: '只追球不找点，到了球旁边也打不出完整动作。',
    drill: '喂球 20 个，每球先判断落点，再用小碎步把球放到身体前方。',
    focus: '今天记录：脚步有没有服务于击球点，而不是只追球？',
    visualType: 'footwork',
  },
  {
    id: 'footwork-split-step-25',
    level: '2.5',
    category: '步伐',
    title: '对方击球时做启动步',
    fact: '慢速回合里，启动步能让你更早进入移动状态。',
    why: '站死等球会让第一步变慢，后面只能仓促补救。',
    drill: '对方击球瞬间轻轻垫步，再判断方向启动，连续 10 球。',
    focus: '今天记录：有没有在对方击球时准备启动？',
    visualType: 'footwork',
  },
  {
    id: 'volley-compact-20',
    level: '2.0',
    category: '截击',
    title: '截击动作要短',
    fact: '截击不是完整挥拍，而是用短动作把球挡向目标。',
    why: '动作太大，来球快时拍面会来不及稳定。',
    drill: '网前截击 15 个，拍子只向前短送，不向后大拉。',
    focus: '今天记录：截击有没有后拉太大？',
    visualType: 'court',
  },
  {
    id: 'tactics-crosscourt-25',
    level: '2.5',
    category: '战术',
    title: '先用斜线建立安全感',
    fact: '慢速回合中，斜线通常比直线更安全。',
    why: '斜线距离更长、过网空间更大，也更容易争取回位时间。',
    drill: '正手斜线连续 10 球，目标不是制胜，而是稳定深度。',
    focus: '今天记录：回合中有没有先选择更安全的线路？',
    visualType: 'court',
  },
  {
    id: 'tactics-recovery-30',
    level: '3.0',
    category: '战术',
    title: '打一拍要想下一拍',
    fact: '3.0 阶段开始，击球选择要服务于下一拍站位。',
    why: '只看当前一拍，容易打出漂亮但让自己失位的球。',
    drill: '每个回合只要求一件事：击球后快速回到能覆盖下一球的位置。',
    focus: '今天记录：你的击球有没有给下一拍留下时间和位置？',
    visualType: 'court',
  },
]

function levelDistance(a: TennisLevel, b: TennisLevel): number {
  return Math.abs(LEVEL_RANK[a] - LEVEL_RANK[b])
}

function dateSeed(date = new Date()): number {
  const text = date.toISOString().slice(0, 10)
  return text.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
}

function recordText(records: TrainingRecord[]): string {
  return records.slice(0, 5).map(r => `${r.content} ${r.reflection} ${(r.tags ?? []).join(' ')}`).join(' ')
}

export function getRecommendedTrainingPrompt(
  level: TennisLevel,
  records: TrainingRecord[],
  offset = 0,
): TennisKnowledgeCard {
  const recentText = recordText(records)
  const scored = TENNIS_KNOWLEDGE_CARDS
    .map(card => {
      const distance = levelDistance(card.level, level)
      const categoryHit = recentText.includes(card.category) ? 3 : 0
      const titleHit = recentText.includes(card.title.slice(0, 2)) ? 1 : 0
      return { card, score: categoryHit + titleHit - distance * 2 }
    })
    .sort((a, b) => b.score - a.score || a.card.id.localeCompare(b.card.id))

  const bestScore = scored[0]?.score ?? 0
  const pool = scored.filter(item => item.score >= bestScore - 1).map(item => item.card)
  return pool[(dateSeed() + offset) % pool.length] ?? TENNIS_KNOWLEDGE_CARDS[0]
}
