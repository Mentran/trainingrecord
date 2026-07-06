# 运动训练记录

一个帮助运动学员记录训练过程、感悟和成长的个人 Web 应用，支持多种运动方式管理。

## 项目背景

跟着教练系统学习网球，需要一个简单的工具来记录每次上课的内容、教练反馈和个人感悟，方便回顾和复盘。后续扩展为支持多种运动方式的统一训练日记。

## 功能规划

### 第一阶段（MVP）✅ 已完成

- **训练录入** — 记录日期、时长、教练、训练内容、个人感悟
- **列表视图** — 按时间倒序展示所有记录，支持按教练筛选
- **日历视图** — 月历热力图，有记录的日期高亮，点击跳转当天记录
- **本地存储** — 浏览器 localStorage 作为缓存；开发服务运行时可同步到项目目录 JSON 文件
- **数据备份** — 支持 JSON 导出 / 导入，可选择训练记录、技巧笔记、运动配置、聊天记录

### 第二阶段 — AI 功能

- **AI 润色** — 详情页手动触发，对训练内容和感悟生成润色建议，用户选择是否应用；需配置 Claude API Key
- **AI 运动顾问** — 独立对话页，可就运动相关问题提问；对话时可引用用户的历史训练记录作为上下文；对话历史存本地；system prompt 限定只回答运动相关问题
- **技巧笔记** — 可从训练记录或粘贴文本中沉淀技巧，支持分类、标签、实用性投票和 AI 辅助整理

### 第三阶段 — 多运动管理

- **运动项目管理** — 用户可创建多个运动项目（网球、游泳、跑步等），每个项目有独立颜色主题和图标
- **数据隔离** — 训练记录、教练列表按运动项目隔离
- **首页切换** — 首页顶部可切换当前运动，统计数字和最近记录随之切换
- **跨运动统计** — 设置页可查看所有运动的汇总数据

### 后续迭代（待规划）

- 训练类型标签体系
- PDF 导出
- 训练统计图表（频率、时长趋势）
- 云端同步

## 产品方向：训练提示系统

后续功能不做泛泛的“网球知识百科”，而是围绕训练闭环做“训练提示系统”：

```txt
记录训练 → 发现问题 → 推荐一个小知识/练习 → 下次训练验证 → 再记录
```

核心目标是让知识点进入实际训练，而不是只提供随机科普。

### 今日训练提示

首页展示一张轻量卡片，形式接近“你知道吗？”，但内容更偏训练处方：

- 适合等级：如 `1.0 / 1.5 / 2.0 / 2.5 / 3.0`
- 技术主题：正手、反手、发球、步伐、截击、战术
- 今日知识：一句关键认知
- 为什么重要：解释该知识点和常见错误的关系
- 今天练什么：一个可执行的小练习
- 记录时关注：下次训练记录要观察的问题

示例：

```txt
今日训练提示
等级：2.0
主题：正手

你知道吗？
正手稳定性差，很多时候不是挥拍问题，而是击球点太晚。

为什么重要？
击球点晚会让身体被球挤住，只能用手臂补救。

今天练什么？
慢速喂球 20 个，只关注提前转身和在身体前方击球。

记录时关注：
今天有没有更早判断落点？
```

### 等级化推荐

先让用户在设置页自选网球等级，后续再根据训练记录和技巧标签辅助判断当前阶段：

- `1.0` 新手入门：握拍、准备姿势、看球、完整动作
- `1.5` 基础对打：转身、引拍、击球点、收拍
- `2.0` 稳定练习：动作链条、节奏、小碎步、稳定性
- `2.5` 慢速回合：连续性、落点、节奏变化
- `3.0` 战术意识：线路、站位、变化、主动组织

推荐内容优先结合用户近期记录中反复出现的问题，而不是完全随机。

### 图解 / 漫画风格

视觉方向不是装饰性漫画，而是低成本训练图解：

- 球场位置
- 人物站位
- 来球方向
- 击球点
- 挥拍路径
- 错误 vs 正确对比

先用简单 SVG / CSS 图解实现，保持加载快、风格统一。AI 生成插图可以作为后续增强，不作为 MVP 依赖。

### 内容策略

第一版不依赖实时大模型生成，先内置 20-50 条高质量本地知识卡片。卡片数据结构可放在 `src/data/tennisKnowledge.ts`：

```typescript
interface TennisKnowledgeCard {
  id: string
  level: '1.0' | '1.5' | '2.0' | '2.5' | '3.0'
  category: '正手' | '反手' | '发球' | '步伐' | '截击' | '战术'
  title: string
  fact: string
  why: string
  drill: string
  focus: string
  visualType: 'forehand' | 'backhand' | 'serve' | 'footwork' | 'court'
}
```

后续可逐步支持：换一条、收藏到技巧笔记、设为下次训练关注点、基于近期记录自动推荐。

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | React + Vite |
| 样式 | Tailwind CSS v4 |
| 路由 | react-router-dom |
| 存储 | localStorage + 本地 JSON 文件（开发服务） |
| LLM | Claude API（用户自填 API Key） |

## 近期问题修复

- **Safari 高内存 / 高 CPU**：定位到 Safari 的 `localhost:5173` WebKit 页面进程异常占用；原因与开发环境无条件注册 Service Worker、页面缓存残留有关。已改为仅生产环境注册 Service Worker，开发环境自动注销已有注册并清理缓存。
- **开发环境缓存干扰**：避免 dev server 关闭后，Safari 仍通过 Service Worker 跑旧页面。
- **聊天流式渲染压力**：AI 顾问流式输出从“每个 chunk 触发一次 React 渲染”改为 80ms 批量刷新，并在组件卸载时清理定时器。
- **底部导航重绘成本**：移除底部导航 `backdrop-filter: blur(...)`，保留接近视觉效果，减少持续合成开销。
- **首页动态效果**：恢复 Header 装饰圆浮动动画，并增加 `prefers-reduced-motion: reduce` 保护。

## 设计风格

轻量笔记风，移动端优先。

- 底色：米白 `#FAFAF8`，卡片白 `#FFFFFF`
- 主色：网球黄绿 `#8DB600`（点缀）
- 文字：深灰 `#1A1A1A` 主文，`#6B7280` 次要信息
- 字体：PingFang SC / 系统字体栈

## 数据结构

```typescript
// 运动项目（第三阶段引入，第二阶段数据层预埋）
interface Sport {
  id: string
  name: string
  icon: string
  color: string
  accentColor: string
  categories: string[]
  createdAt: string
}

interface TrainingRecord {
  id: string
  sportId: string              // 关联运动项目（第二阶段数据层预埋，UI 第三阶段开放）
  date: string                 // YYYY-MM-DD
  duration: number             // 分钟
  coach: string
  content: string              // 训练内容（最终保留版本）
  contentOriginal: string      // 训练内容原文
  reflection: string           // 感悟（最终保留版本）
  reflectionOriginal: string   // 感悟原文
  tags?: string[]
  polishStatus?: 'none' | 'partial' | 'applied' | 'failed'
  createdAt: string
  updatedAt: string
}

// AI 对话消息（第二阶段引入）
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

interface TechniqueNote {
  id: string
  sportId: string
  title: string
  content: string
  source: 'ai' | 'user'
  category?: string
  tags?: string[]
  votes: number
  createdAt: string
  updatedAt: string
}

interface AppBackup {
  version: 2
  exportedAt: string
  records?: TrainingRecord[]
  techniques?: TechniqueNote[]
  sports?: Sport[]
  conversations?: Conversation[]
}
```

## 本地开发

```bash
npm install
npm run dev
npm run build
```

## 本地文件存储

为降低浏览器缓存被清理导致的数据丢失风险，开发服务内置了一个轻量本地文件存储接口：

```txt
data/app-data.json
data/backups/
```

- 启动页面时，如果存在 `data/app-data.json`，会先从文件恢复训练记录、技巧笔记、运动配置和聊天记录。
- 每次新增、编辑、删除或导入核心数据后，会自动写入 `data/app-data.json`。
- 设置页「本地文件」区可手动点击「立即保存当前数据」，把当前浏览器数据马上落盘。
- 覆盖写入前会把上一版保存到 `data/backups/`；备份最多 1 分钟生成 1 份，最多保留最近 20 份。
- `data/app-data.json` 和备份目录已被 Git 忽略，避免把个人训练数据提交到仓库。
- AI API Key 仍只保存在浏览器本地，不写入 JSON 文件。
- 设置页会展示当前存储模式、数据量、估算大小和上次导出时间；线上静态模式会提示定期导出 JSON。
- 当训练记录从上次导出后新增 5 条，或距离上次导出超过 14 天，会提示更新备份。

注意：该能力只在本地开发服务中启用。部署到 Netlify / Vercel 等静态托管平台时，页面会自动降级为浏览器本地缓存，不会请求 `/api/local-store`，设置页也不会显示文件写入错误。线上多人长期使用需要另接账号系统和云数据库。

## 设置

LLM 润色为可选功能。首次使用前可在「设置」页填入 Claude API Key，Key 仅存储在本地浏览器中，不会上传到任何服务器。

注意：浏览器本地保存 API Key 只适合个人自用场景，仍可能被浏览器插件、调试工具或 XSS 风险读取。MVP 中应保证不配置 Key 也能正常记录、编辑、查看和导出数据。

---

## 更新日志

| 日期 | 版本 | 内容 |
|------|------|------|
| 2026-05-21 | v0.1 | 项目立项，完成需求规划和任务拆分 |
| 2026-05-21 | v0.2 | 调整 MVP 范围：LLM 改为可选增强，提前加入 JSON 备份，补充数据结构演进字段 |
| 2026-05-21 | v0.3 | 完成项目初始化：Vite + React + TypeScript + Tailwind CSS v4 + react-router-dom，四页骨架和底部导航就位 |
| 2026-05-21 | v0.4 | UI 全面重设计：仪表盘首页、深色 Header、热力图日历、教练彩色竖条、SVG 导航图标、时长快捷按钮 |
| 2026-05-21 | v0.5 | 需求扩展：新增第二阶段（AI 润色 + AI 运动顾问）和第三阶段（多运动管理）规划，更新数据结构设计 |
| 2026-05-21 | v0.6 | 完成第二阶段：AI 润色（详情页对比选择）、AI 运动顾问（对话页，训练记录上下文，历史持久化） |
| 2026-05-29 | v0.7 | 完善数据备份：导出 / 导入均支持按类别选择，新增聊天记录备份；导入旧格式训练记录保持兼容 |
| 2026-05-29 | v0.8 | 修复 Safari 开发环境高内存问题：开发环境自动注销 Service Worker 并清理缓存；优化聊天流式渲染和底部导航重绘成本 |
| 2026-05-29 | v0.9 | 恢复首页装饰圆动态效果，并加入 `prefers-reduced-motion` 保护 |
| 2026-06-23 | v1.0 | 新增本地 JSON 文件存储：启动时可从 `data/app-data.json` 恢复，数据变更自动写文件并保留备份 |

> 日常开发进度见 TODO.md 进度记录，此处只记录版本级别变化。
