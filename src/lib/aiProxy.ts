import { applyAiProxy as applyAiProxyPlan } from './aiProxyShared'

export {
  AI_PROXY_PATH,
  AI_TARGET_HEADER,
  describeAiNetworkError,
  isAllowedAiTarget,
} from './aiProxyShared'

export function isAiProxyEnabled(): boolean {
  return import.meta.env.DEV === true && import.meta.env.MODE !== 'test'
}

export function applyAiProxy(
  targetUrl: string,
  headers: Record<string, string>,
): { url: string; headers: Record<string, string> } {
  return applyAiProxyPlan(targetUrl, headers, isAiProxyEnabled())
}
