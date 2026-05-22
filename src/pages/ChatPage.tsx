import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  hasApiKey, streamChatMessage, getConversations, saveConversation,
  deleteConversation, getActiveConvId, setActiveConvId,
  type ChatMessage, type Conversation,
} from '../lib/ai'
import { getRecords } from '../lib/storage'
import { useSport } from '../components/SportProvider'

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function parseFollowUps(text: string): { clean: string; followUps: string[] } {
  const match = text.match(/\nFOLLOWUP:\s*(.+)$/)
  if (!match) return { clean: text.trim(), followUps: [] }
  const clean = text.slice(0, match.index).trim()
  const followUps = match[1].split('|').map(s => s.trim()).filter(Boolean).slice(0, 3)
  return { clean, followUps }
}

// ── Markdown renderer ────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i}>{part.slice(1, -1)}</em>
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} className="bg-black/8 px-1 py-0.5 rounded text-[11px] font-mono">{part.slice(1, -1)}</code>
    return part
  })
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('### ')) {
      nodes.push(<p key={i} className="font-semibold text-[13px] mt-2 mb-0.5">{renderInline(line.slice(4))}</p>)
    } else if (line.startsWith('## ')) {
      nodes.push(<p key={i} className="font-bold text-[14px] mt-2 mb-0.5">{renderInline(line.slice(3))}</p>)
    } else if (line.startsWith('# ')) {
      nodes.push(<p key={i} className="font-bold text-[15px] mt-2 mb-1">{renderInline(line.slice(2))}</p>)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = []
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        items.push(lines[i].slice(2)); i++
      }
      nodes.push(
        <ul key={`ul-${i}`} className="list-disc list-outside pl-4 space-y-0.5 my-1">
          {items.map((it, j) => <li key={j} className="text-sm leading-relaxed">{renderInline(it)}</li>)}
        </ul>
      )
      continue
    } else if (/^\d+\.\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, '')); i++
      }
      nodes.push(
        <ol key={`ol-${i}`} className="list-decimal list-outside pl-4 space-y-0.5 my-1">
          {items.map((it, j) => <li key={j} className="text-sm leading-relaxed">{renderInline(it)}</li>)}
        </ol>
      )
      continue
    } else if (line.trim() === '') {
      nodes.push(<div key={i} className="h-1.5" />)
    } else {
      nodes.push(<p key={i} className="text-sm leading-relaxed">{renderInline(line)}</p>)
    }
    i++
  }
  return <div className="flex flex-col gap-0.5">{nodes}</div>
}

// ── Suggestion questions ─────────────────────────────────

const SUGGESTIONS = [
  '我最近练了什么？有什么需要注意的？',
  '网球正手击球有哪些常见错误？',
  '训练后如何有效恢复？',
  '如何提高发球速度？',
]

// ── Main component ───────────────────────────────────────

export default function ChatPage() {
  const navigate = useNavigate()
  const { sport } = useSport()

  const [conversations, setConversations] = useState<Conversation[]>(getConversations)
  const [activeConvId, setActiveConvIdState] = useState<string | null>(() => {
    const id = getActiveConvId()
    const convs = getConversations()
    return convs.find(c => c.id === id) ? id : (convs[0]?.id ?? null)
  })
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const id = getActiveConvId()
    const convs = getConversations()
    const active = convs.find(c => c.id === id) ?? convs[0]
    return active?.messages ?? []
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [followUps, setFollowUps] = useState<string[]>([])
  const [showHistory, setShowHistory] = useState(false)

  const streamingRef = useRef('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const activeConv = conversations.find(c => c.id === activeConvId)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText, loading])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 128) + 'px'
  }, [input])

  function switchConversation(id: string) {
    const conv = conversations.find(c => c.id === id)
    if (!conv) return
    setActiveConvIdState(id)
    setActiveConvId(id)
    setMessages(conv.messages)
    setFollowUps([])
    setStreamingText('')
    streamingRef.current = ''
    setShowHistory(false)
  }

  function newConversation() {
    setActiveConvIdState(null)
    setMessages([])
    setFollowUps([])
    setStreamingText('')
    streamingRef.current = ''
    setShowHistory(false)
  }

  function handleDeleteConv(id: string) {
    deleteConversation(id)
    const updated = getConversations()
    setConversations(updated)
    if (id === activeConvId) {
      if (updated.length > 0) switchConversation(updated[0].id)
      else newConversation()
    }
  }

  const send = useCallback(async (text: string) => {
    const content = text.trim()
    if (!content || loading) return

    const userMsg: ChatMessage = { id: generateId(), role: 'user', content, createdAt: new Date().toISOString() }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setFollowUps([])
    setLoading(true)
    streamingRef.current = ''
    setStreamingText('')

    try {
      const records = getRecords()
      await streamChatMessage(content, messages, records, (chunk) => {
        streamingRef.current += chunk
        setStreamingText(streamingRef.current)
      }, sport.name)

      const { clean, followUps: fups } = parseFollowUps(streamingRef.current)
      const assistantMsg: ChatMessage = { id: generateId(), role: 'assistant', content: clean, createdAt: new Date().toISOString() }
      const finalMessages = [...nextMessages, assistantMsg]
      setMessages(finalMessages)
      setFollowUps(fups)

      // Save to conversation
      const now = new Date().toISOString()
      let convId = activeConvId
      if (!convId) {
        convId = `conv-${Date.now()}`
        setActiveConvIdState(convId)
        setActiveConvId(convId)
      }
      const title = content.slice(0, 20)
      const conv: Conversation = {
        id: convId,
        title: activeConv?.title ?? title,
        messages: finalMessages,
        createdAt: activeConv?.createdAt ?? now,
        updatedAt: now,
      }
      saveConversation(conv)
      setConversations(getConversations())
    } catch (e) {
      const errMsg: ChatMessage = {
        id: generateId(), role: 'assistant',
        content: `抱歉，出现了错误：${(e as Error).message}`,
        createdAt: new Date().toISOString(),
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setLoading(false)
      setStreamingText('')
      streamingRef.current = ''
    }
  }, [loading, messages, activeConvId, activeConv])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
  }

  const headerBg = `linear-gradient(135deg, ${sport.color} 0%, ${sport.color}cc 100%)`

  return (
    <div className="flex flex-col" style={{ height: '100svh', paddingBottom: '80px' }}>
      {/* Header */}
      <div className="px-4 pt-12 pb-4 shrink-0" style={{ background: headerBg }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-white truncate">
              {activeConv?.title ?? '运动顾问'}
            </h1>
            <p className="text-white/50 text-xs mt-0.5">只回答运动相关问题</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={newConversation}
              className="px-3 py-1.5 rounded-full bg-white/15 text-white/80 text-xs font-medium"
            >
              新对话
            </button>
            <button
              onClick={() => setShowHistory(true)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/15 text-white"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M2 4h11M2 7.5h11M2 11h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 消息区 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {!hasApiKey() && (
          <div className="bg-white rounded-2xl card-shadow p-4 text-center">
            <p className="text-2xl mb-2">✦</p>
            <p className="text-sm font-medium text-[#1A1A1A] mb-1">需要配置 API Key</p>
            <p className="text-xs text-[#6B7280] mb-3">前往设置页填写 API Key 后即可使用</p>
            <button onClick={() => navigate('/settings')}
              className="px-4 py-2 rounded-xl text-white text-sm font-medium"
              style={{ background: headerBg }}>
              去设置
            </button>
          </div>
        )}

        {hasApiKey() && messages.length === 0 && !loading && (
          <div className="flex flex-col gap-3">
            <div className="text-center py-4">
              <p className="text-3xl mb-2">{sport.icon}</p>
              <p className="text-sm text-[#6B7280]">有什么运动问题想聊？</p>
            </div>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)}
                  className="w-full text-left bg-white rounded-2xl card-shadow px-4 py-3 text-sm text-[#1A1A1A] active:bg-[#F5F5F0] transition">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isLast = idx === messages.length - 1
          return (
            <div key={msg.id}>
              <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-white shrink-0 mr-2 mt-0.5"
                    style={{ background: headerBg }}>✦</div>
                )}
                <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'text-white rounded-br-sm'
                    : 'bg-white card-shadow text-[#1A1A1A] rounded-bl-sm'
                }`} style={msg.role === 'user' ? { background: headerBg } : {}}>
                  {msg.role === 'assistant' ? <MarkdownText text={msg.content} /> : msg.content}
                </div>
              </div>
              {/* Follow-up chips after last assistant message */}
              {msg.role === 'assistant' && isLast && followUps.length > 0 && !loading && (
                <div className="flex flex-wrap gap-2 mt-2 ml-9">
                  {followUps.map(q => (
                    <button key={q} onClick={() => send(q)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium border transition active:scale-95"
                      style={{ borderColor: sport.accentColor + '60', color: sport.accentColor, background: sport.accentColor + '10' }}>
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* 流式输出气泡 */}
        {(loading || streamingText) && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-white shrink-0 mr-2 mt-0.5"
              style={{ background: headerBg }}>✦</div>
            <div className="max-w-[82%] bg-white card-shadow rounded-2xl rounded-bl-sm px-4 py-3">
              {streamingText ? (
                <div className="text-sm leading-relaxed text-[#1A1A1A]">
                  <MarkdownText text={streamingText} />
                  <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 animate-pulse align-middle" />
                </div>
              ) : (
                <div className="flex gap-1 items-center py-0.5">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ backgroundColor: sport.accentColor, animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 输入区 */}
      {hasApiKey() && (
        <div className="shrink-0 px-4 pb-4 pt-2 bg-[#F5F5F0] border-t border-[#E8E8E2]">
          <div className="flex gap-2 items-end bg-white rounded-2xl card-shadow px-3 py-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入问题，Enter 发送…"
              rows={1}
              disabled={loading}
              className="flex-1 resize-none outline-none text-sm text-[#1A1A1A] placeholder:text-[#9B9B9B] bg-transparent py-1 overflow-hidden"
              style={{ minHeight: '24px', maxHeight: '128px' }}
            />
            <button onClick={() => send(input)} disabled={!input.trim() || loading}
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 disabled:opacity-30 transition active:scale-95"
              style={{ background: headerBg }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 12V2M3 6l4-4 4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          <p className="text-[10px] text-[#9B9B9B] text-center mt-1.5">Shift+Enter 换行</p>
        </div>
      )}

      {/* 历史抽屉 */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setShowHistory(false)} />
          <div className="w-72 bg-white flex flex-col shadow-2xl">
            <div className="px-4 pt-12 pb-4 flex items-center justify-between shrink-0"
              style={{ background: headerBg }}>
              <h2 className="text-base font-semibold text-white">历史对话</h2>
              <button onClick={() => setShowHistory(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-white/15 text-white">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {conversations.length === 0 ? (
                <p className="text-sm text-[#9B9B9B] text-center py-8">暂无历史对话</p>
              ) : (
                conversations.map(conv => (
                  <div key={conv.id}
                    className={`flex items-center gap-2 px-4 py-3 cursor-pointer transition ${conv.id === activeConvId ? 'bg-[#F5F5F0]' : 'active:bg-[#F5F5F0]'}`}
                    onClick={() => switchConversation(conv.id)}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1A1A1A] truncate">{conv.title}</p>
                      <p className="text-xs text-[#9B9B9B] mt-0.5">
                        {new Date(conv.updatedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                        · {conv.messages.length} 条
                      </p>
                    </div>
                    {conv.id === activeConvId && (
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: sport.accentColor }} />
                    )}
                    <button onClick={e => { e.stopPropagation(); handleDeleteConv(conv.id) }}
                      className="w-6 h-6 flex items-center justify-center rounded-lg text-[#ADADAD] active:text-red-400 shrink-0">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 3h8M5 3V2.5a.5.5 0 01.5-.5h1a.5.5 0 01.5.5V3M4.5 3l.5 6M7.5 3l-.5 6M2.5 3l.5 6.5a.5.5 0 00.5.5h5a.5.5 0 00.5-.5L9.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="px-4 py-3 border-t border-[#E8E8E2] shrink-0">
              <button onClick={newConversation}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-white"
                style={{ background: headerBg }}>
                + 新对话
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
