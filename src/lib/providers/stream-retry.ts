// providers/stream-retry.ts — Retry wrapper for streaming with network error recovery

import type { AIProvider, SendParams } from './types'

interface RetryOptions {
  maxRetries?: number
  retryDelayMs?: number
  onRetry?: (attempt: number, error: Error) => void
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return false
  const msg = String(err).toLowerCase()
  return (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('timeout') ||
    msg.includes('socket hang up') ||
    msg.includes('aborted') && !msg.includes('aborterror')
  )
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Wraps provider.stream() with automatic retry on network errors.
 * Yields chunks as normal; on retry, skips already-yielded content.
 */
export async function* streamWithRetry(
  provider: AIProvider,
  params: SendParams,
  opts: RetryOptions = {},
): AsyncGenerator<string, string> {
  const { maxRetries = 2, retryDelayMs = 1000, onRetry } = opts
  let accumulated = ''
  let attempt = 0

  while (attempt <= maxRetries) {
    try {
      const gen = provider.stream(params)
      let fullText = ''

      for await (const chunk of gen) {
        fullText += chunk
        // On retry, skip chunks we've already yielded
        if (fullText.length > accumulated.length) {
          const newPart = fullText.slice(accumulated.length)
          accumulated = fullText
          yield newPart
        }
      }

      // Generator returned successfully
      return accumulated
    } catch (err) {
      // Don't retry user-initiated aborts or non-network errors
      if (params.signal?.aborted) throw err
      if (!isNetworkError(err) || attempt >= maxRetries) throw err

      attempt++
      onRetry?.(attempt, err instanceof Error ? err : new Error(String(err)))
      await delay(retryDelayMs * attempt) // Linear backoff
    }
  }

  return accumulated
}
