import { useState } from 'react'
import type { AIConfig } from '../../lib/ai'

interface AISettingsSectionProps {
  config: AIConfig
  onSave: (config: AIConfig) => void
}

export default function AISettingsSection({ config, onSave }: AISettingsSectionProps) {
  const [editing, setEditing] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [draft, setDraft] = useState(config)
  const maskedKey = config.apiKey
    ? config.apiKey.slice(0, 8) + '••••••••' + config.apiKey.slice(-4)
    : ''

  function startEditing() {
    setDraft(config)
    setEditing(true)
  }

  function save() {
    onSave(draft)
    setEditing(false)
  }

  return (
    <section>
      <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-3">AI 功能</p>
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#F0F7E0] flex items-center justify-center text-base">✦</div>
              <div>
                <p className="text-sm font-medium text-[#1A1A1A]">AI 接口配置</p>
                <p className="text-xs text-[#9B9B9B] mt-0.5">润色和运动顾问共用</p>
              </div>
            </div>
            {!editing && (
              <button onClick={startEditing} className="text-xs text-[#9DC41A] font-medium">
                {config.apiKey ? '修改' : '配置'}
              </button>
            )}
          </div>

          {editing ? (
            <div className="flex flex-col gap-2.5">
              <div>
                <p className="text-xs text-[#9B9B9B] mb-1">接口格式</p>
                <div className="flex gap-2">
                  {(['anthropic', 'openai'] as const).map(format => (
                    <button
                      key={format}
                      type="button"
                      onClick={() => setDraft(current => ({ ...current, format }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium border transition ${
                        draft.format === format
                          ? 'bg-[#1A2E1A] text-white border-[#1A2E1A]'
                          : 'bg-white text-[#6B7280] border-[#E8E8E2]'
                      }`}
                    >
                      {format === 'anthropic' ? 'Anthropic' : 'OpenAI 兼容'}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="block text-xs text-[#9B9B9B] mb-1">API 地址</span>
                <input
                  type="text"
                  value={draft.apiUrl}
                  onChange={event => setDraft(current => ({ ...current, apiUrl: event.target.value }))}
                  placeholder={draft.format === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com'}
                  className="w-full border border-[#E8E8E2] rounded-xl px-3 py-2.5 text-sm text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#9DC41A]/40 focus:border-[#9DC41A] font-mono"
                />
                <span className="block text-xs text-[#ADADAD] mt-1">填写 base URL 即可，路径自动补全。PackyAPI 的 OpenAI 兼容地址请填控制台 Endpoint（通常为 https://cf.api.fan/v1），不要填官网域名；在线版还需接口支持浏览器跨域。</span>
              </label>
              <label className="block">
                <span className="block text-xs text-[#9B9B9B] mb-1">API Key</span>
                <input
                  type="text"
                  value={draft.apiKey}
                  onChange={event => setDraft(current => ({ ...current, apiKey: event.target.value }))}
                  placeholder="sk-ant-..."
                  autoFocus
                  className="w-full border border-[#E8E8E2] rounded-xl px-3 py-2.5 text-sm text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#9DC41A]/40 focus:border-[#9DC41A] font-mono"
                />
              </label>
              <label className="block">
                <span className="block text-xs text-[#9B9B9B] mb-1">模型</span>
                <input
                  type="text"
                  value={draft.model}
                  onChange={event => setDraft(current => ({ ...current, model: event.target.value }))}
                  placeholder="claude-sonnet-4-6"
                  className="w-full border border-[#E8E8E2] rounded-xl px-3 py-2.5 text-sm text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#9DC41A]/40 focus:border-[#9DC41A] font-mono"
                />
              </label>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 py-2 rounded-xl border border-[#E8E8E2] text-sm text-[#6B7280]"
                >
                  取消
                </button>
                <button onClick={save} className="flex-1 py-2 rounded-xl bg-[#1A2E1A] text-sm text-white font-medium">
                  保存
                </button>
              </div>
            </div>
          ) : config.apiKey ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 bg-[#F5F5F0] rounded-xl px-3 py-2">
                <span className="text-xs text-[#9B9B9B] w-10 shrink-0">Key</span>
                <span className="text-xs font-mono text-[#6B7280] flex-1 truncate">
                  {showKey ? config.apiKey : maskedKey}
                </span>
                <button onClick={() => setShowKey(value => !value)} className="text-xs text-[#9B9B9B] shrink-0">
                  {showKey ? '隐藏' : '显示'}
                </button>
              </div>
              <div className="flex items-center gap-2 bg-[#F5F5F0] rounded-xl px-3 py-2">
                <span className="text-xs text-[#9B9B9B] w-10 shrink-0">模型</span>
                <span className="text-xs font-mono text-[#6B7280] flex-1 truncate">{config.model}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#9B9B9B]">未配置，AI 功能不可用</p>
          )}
        </div>
        <div className="px-4 pb-3">
          <p className="text-xs text-[#9B9B9B]">配置仅存储在本设备浏览器中，不会上传到任何服务器。</p>
        </div>
      </div>
    </section>
  )
}
