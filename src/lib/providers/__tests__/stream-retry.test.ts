import { describe, it, expect, vi } from 'vitest'
import { streamWithRetry } from '../stream-retry'
import type { AIProvider, SendParams } from '../types'

function makeMockProvider(streamFn: (params: SendParams) => AsyncGenerator<string, string>): AIProvider {
  return {
    type: 'openai',
    models: [],
    isConfigured: () => true,
    stream: streamFn,
    testConnection: async () => true,
  }
}

async function collectStream(gen: AsyncGenerator<string, string>): Promise<{ chunks: string[]; result: string }> {
  const chunks: string[] = []
  let r = await gen.next()
  while (!r.done) {
    chunks.push(r.value)
    r = await gen.next()
  }
  return { chunks, result: r.value }
}

const defaultParams: SendParams = { model: 'test', messages: [{ role: 'user', content: 'Hi' }] }

describe('streamWithRetry', () => {
  it('streams successfully without retries', async () => {
    async function* mockStream() {
      yield 'Hello'
      yield ' world'
      return 'Hello world'
    }
    const provider = makeMockProvider(mockStream)
    const { chunks, result } = await collectStream(streamWithRetry(provider, defaultParams))

    expect(chunks).toEqual(['Hello', ' world'])
    expect(result).toBe('Hello world')
  })

  it('retries on network error and continues from where it left off', async () => {
    let attempt = 0
    async function* mockStream(): AsyncGenerator<string, string> {
      attempt++
      if (attempt === 1) {
        yield 'Hello'
        throw new Error('failed to fetch')
      }
      yield 'Hello world'
      return 'Hello world'
    }

    const onRetry = vi.fn()
    const provider = makeMockProvider(mockStream)
    const { chunks, result } = await collectStream(
      streamWithRetry(provider, defaultParams, { maxRetries: 2, retryDelayMs: 0, onRetry })
    )

    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error))
    expect(chunks.join('')).toContain('world')
    expect(result).toBe('Hello world')
  })

  it('does not retry on AbortError', async () => {
    async function* mockStream(): AsyncGenerator<string, string> {
      throw new DOMException('Aborted', 'AbortError')
    }

    const provider = makeMockProvider(mockStream)
    const gen = streamWithRetry(provider, defaultParams, { maxRetries: 2, retryDelayMs: 0 })
    await expect(gen.next()).rejects.toThrow()
  })

  it('does not retry on non-network errors', async () => {
    async function* mockStream(): AsyncGenerator<string, string> {
      throw new Error('Invalid model')
    }

    const provider = makeMockProvider(mockStream)
    const gen = streamWithRetry(provider, defaultParams, { maxRetries: 2, retryDelayMs: 0 })
    await expect(gen.next()).rejects.toThrow('Invalid model')
  })

  it('does not retry when signal is aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    async function* mockStream(): AsyncGenerator<string, string> {
      throw new Error('network error')
    }

    const provider = makeMockProvider(mockStream)
    const gen = streamWithRetry(
      provider,
      { ...defaultParams, signal: controller.signal },
      { maxRetries: 2, retryDelayMs: 0 },
    )
    await expect(gen.next()).rejects.toThrow()
  })

  it('throws after exhausting retries', async () => {
    async function* mockStream(): AsyncGenerator<string, string> {
      throw new Error('failed to fetch')
    }

    const onRetry = vi.fn()
    const provider = makeMockProvider(mockStream)
    const gen = streamWithRetry(provider, defaultParams, { maxRetries: 1, retryDelayMs: 0, onRetry })
    await expect(gen.next()).rejects.toThrow('failed to fetch')
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('recognizes various network error messages', async () => {
    const networkErrors = ['ECONNRESET', 'timeout', 'socket hang up', 'ECONNREFUSED']

    for (const msg of networkErrors) {
      let attempt = 0
      async function* mockStream(): AsyncGenerator<string, string> {
        attempt++
        if (attempt === 1) throw new Error(msg)
        yield 'OK'
        return 'OK'
      }

      const provider = makeMockProvider(mockStream)
      const { result } = await collectStream(
        streamWithRetry(provider, defaultParams, { maxRetries: 1, retryDelayMs: 0 })
      )
      expect(result).toBe('OK')
    }
  })

  it('uses default options when none provided', async () => {
    async function* mockStream(): AsyncGenerator<string, string> {
      yield 'OK'
      return 'OK'
    }

    const provider = makeMockProvider(mockStream)
    const { result } = await collectStream(streamWithRetry(provider, defaultParams))
    expect(result).toBe('OK')
  })
})
