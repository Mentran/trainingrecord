import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'
import { isAllowedAiTarget } from './src/lib/aiProxyShared'
import { readRequestBody, RequestBodyTooLargeError } from './localFileServer'

export const MAX_AI_PROXY_BYTES = 1024 * 1024

const FORWARD_HEADERS = [
  'content-type',
  'authorization',
  'x-api-key',
  'anthropic-version',
  'anthropic-dangerous-direct-browser-access',
] as const

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  if (res.headersSent || res.writableEnded) return
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(data))
}

export function pickForwardHeaders(headers: IncomingHttpHeaders): Record<string, string> {
  const forwarded: Record<string, string> = {}
  for (const name of FORWARD_HEADERS) {
    const value = headers[name]
    if (typeof value === 'string' && value.trim()) forwarded[name] = value
  }
  if (!forwarded['content-type']) forwarded['content-type'] = 'application/json'
  return forwarded
}

export async function handleAiProxy(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  const target = req.headers['x-ai-target-url']
  if (!isAllowedAiTarget(target)) {
    sendJson(res, 400, { error: '无效的目标 API 地址' })
    return
  }

  let body: string
  try {
    body = await readRequestBody(req, MAX_AI_PROXY_BYTES)
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      sendJson(res, 413, { error: error.message })
      return
    }
    throw error
  }

  const controller = new AbortController()
  const onClose = () => controller.abort()
  req.on('close', onClose)

  try {
    const upstream = await fetch(target, {
      method: 'POST',
      headers: pickForwardHeaders(req.headers),
      body,
      signal: controller.signal,
    })
    res.statusCode = upstream.status
    const contentType = upstream.headers.get('content-type')
    if (contentType) res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'no-store')

    if (!upstream.body) {
      res.end()
      return
    }

    const reader = upstream.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!res.write(Buffer.from(value))) {
        await new Promise<void>(resolve => res.once('drain', resolve))
      }
    }
    res.end()
  } catch (error) {
    if (controller.signal.aborted || res.writableEnded || res.headersSent) return
    sendJson(res, 502, {
      error: `无法连接到上游 API（${target}）`,
      message: error instanceof Error ? error.message : String(error),
    })
  } finally {
    req.off('close', onClose)
  }
}
