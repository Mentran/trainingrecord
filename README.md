# 运动训练记录

一个帮助运动学员记录训练过程、感悟和成长的个人 Web 应用，支持多种运动方式管理。

## 项目背景

跟着教练系统学习网球，需要一个简单的工具来记录每次上课的内容、教练反馈和个人感悟，方便回顾和复盘。后续扩展为支持多种运动方式的统一训练日记。

## 功能规划

### 第一阶段（MVP）✅ 已完成

- **训练录入** — 记录日期、时长、教练、训练内容、个人感悟
- **列表视图** — 按时间倒序展示所有记录，支持按教练筛选
- **日历视图** — 月历热力图，有记录的日期高亮，点击跳转当天记录
- **本地存储** — 数据存储在浏览器 localStorage，无需账号和服务器
- **数据备份** — 支持 JSON 导出 / 导入

### 第二阶段 — AI 功能

- **AI 润色** — 详情页手动触发，对训练内容和感悟生成润色建议，用户选择是否应用；需配置 Claude API Key
- **AI 运动顾问** — 独立对话页，可就运动相关问题提问；对话时可引用用户的历史训练记录作为上下文；对话历史存本地；system prompt 限定只回答运动相关问题

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

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | React + Vite |
| 样式 | Tailwind CSS v4 |
| 路由 | react-router-dom |
| 存储 | localStorage |
| LLM | Claude API（用户自填 API Key） |

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
  id: string           // UUID
  name: string         // 如"网球"
  icon: string         // emoji，如"🎾"
  color: string        // 主题色 hex
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
```

## 本地开发

```bash
npm install
npm run dev
npm run build
```

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

> 日常开发进度见 TODO.md 进度记录，此处只记录版本级别变化。
