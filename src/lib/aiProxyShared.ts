export const AI_PROXY_PATH = '/api/ai-proxy'
export const AI_TARGET_HEADER = 'X-AI-Target-Url'

export function isAllowedAiTarget(url: unknown): url is string {
  if (typeof url !== 'string' || !url.trim()) return false
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:') return true
    if (parsed.protocol !== 'http:') return false
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

export function applyAiProxy(
  targetUrl: string,
  headers: Record<string, string>,
  enabled: boolean,
): { url: string; headers: Record<string, string> } {
  if (!enabled) return { url: targetUrl, headers }
  return {
    url: AI_PROXY_PATH,
    headers: { ...headers, [AI_TARGET_HEADER]: targetUrl },
  }
}

export function describeAiNetworkError(url: string): string {
  if (/packyapi|api\.fan/i.test(url)) {
    return `无法连接到 API（${url}）\nPackyAPI 等转接站通常禁止浏览器直接访问。\n请改用支持跨域的官方地址（如 https://api.deepseek.com），或在本机运行 npm run dev，开发服务会自动代理。`
  }
  return `无法连接到 API（${url}）\n可能原因：\n① 转接服务不支持浏览器直接访问（CORS 限制）\n② URL 填写有误\n③ 网络问题`
}
