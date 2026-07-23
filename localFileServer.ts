export const MAX_LOCAL_FILE_BYTES = 5 * 1024 * 1024

export class RequestBodyTooLargeError extends Error {
  constructor() {
    super(`请求体超过 ${MAX_LOCAL_FILE_BYTES / 1024 / 1024}MB 限制`)
    this.name = 'RequestBodyTooLargeError'
  }
}

export async function readRequestBody(
  req: NodeJS.ReadableStream & AsyncIterable<unknown>,
  limit = MAX_LOCAL_FILE_BYTES,
): Promise<string> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
    total += buffer.byteLength
    if (total > limit) throw new RequestBodyTooLargeError()
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}
