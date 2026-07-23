export type AIErrorCode =
  | 'invalid_config'
  | 'cancelled'
  | 'timeout'
  | 'network'
  | 'http'
  | 'response_format'
  | 'empty_response'

export class AIError extends Error {
  readonly code: AIErrorCode
  readonly status?: number

  constructor(code: AIErrorCode, message: string, options?: { cause?: unknown; status?: number }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = code === 'cancelled' ? 'AbortError' : 'AIError'
    this.code = code
    this.status = options?.status
  }
}

export function isAIError(error: unknown): error is AIError {
  return error instanceof AIError
}
