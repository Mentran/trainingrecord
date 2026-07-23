import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import {
  MAX_LOCAL_FILE_BYTES,
  readRequestBody,
  RequestBodyTooLargeError,
} from './localFileServer'

describe('local file server body limit', () => {
  it('读取限制以内的请求体', async () => {
    await expect(readRequestBody(Readable.from(['abc', '123']), 6)).resolves.toBe('abc123')
  })

  it('请求体超过限制时立即拒绝', async () => {
    await expect(readRequestBody(Readable.from(['1234']), 3))
      .rejects.toBeInstanceOf(RequestBodyTooLargeError)
    expect(MAX_LOCAL_FILE_BYTES).toBe(5 * 1024 * 1024)
  })
})
