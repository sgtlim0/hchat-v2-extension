// providers/__tests__/openrouter-provider.test.ts — OpenRouter provider tests (TDD)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OpenRouterProvider, OPENROUTER_MODELS } from '../openrouter-provider'
import type { SendParams } from '../types'

function createMockSSEStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

function makeSendParams(overrides?: Partial<SendParams>): SendParams {
  return {
    model: 'meta-llama/llama-3-70b',
    messages: [{ role: 'user', content: 'Hello' }],
    ...overrides,
  }
}

describe('OpenRouterProvider', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  // 1. isConfigured: apiKey 있음
  it('isConfigured returns true when apiKey is set', () => {
    const provider = new OpenRouterProvider({ apiKey: 'sk-or-test-key' })
    expect(provider.isConfigured()).toBe(true)
  })

  // 2. isConfigured: apiKey 없음
  it('isConfigured returns false when apiKey is empty', () => {
    const provider = new OpenRouterProvider({ apiKey: '' })
    expect(provider.isConfigured()).toBe(false)
  })

  // 3. models: 프리셋 모델 리스트
  it('has preset model list with at least 5 models', () => {
    const provider = new OpenRouterProvider({ apiKey: 'sk-or-test' })
    expect(provider.models.length).toBeGreaterThanOrEqual(5)
    expect(provider.models.every((m) => m.provider === ('openrouter' as never))).toBe(true)
  })

  // 4. models: 각 모델에 비용 정보 포함
  it('each model has inputCostPer1M and outputCostPer1M via cost field', () => {
    for (const model of OPENROUTER_MODELS) {
      expect(model.cost.input).toBeGreaterThan(0)
      expect(model.cost.output).toBeGreaterThan(0)
    }
  })

  // 5. type은 'openrouter'
  it('has type openrouter', () => {
    const provider = new OpenRouterProvider({ apiKey: 'sk-or-test' })
    expect(provider.type).toBe('openrouter')
  })

  // 6. stream: SSE 파싱, delta.content 추출
  it('stream yields delta content chunks from SSE', async () => {
    const sseData = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: [DONE]\n\n',
    ]

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(createMockSSEStream(sseData), { status: 200 }),
    )

    const provider = new OpenRouterProvider({ apiKey: 'sk-or-test' })
    const gen = provider.stream(makeSendParams())

    const chunks: string[] = []
    let result: IteratorResult<string, string>
    do {
      result = await gen.next()
      if (!result.done) chunks.push(result.value)
    } while (!result.done)

    expect(chunks).toEqual(['Hello', ' world'])
    expect(result.value).toBe('Hello world')
  })

  // 7. stream 완료: [DONE] 처리
  it('stream completes on [DONE] and returns full text', async () => {
    const sseData = [
      'data: {"choices":[{"delta":{"content":"OK"}}]}\n\n',
      'data: [DONE]\n\n',
    ]

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(createMockSSEStream(sseData), { status: 200 }),
    )

    const provider = new OpenRouterProvider({ apiKey: 'sk-or-test' })
    const gen = provider.stream(makeSendParams())

    let result: IteratorResult<string, string>
    do {
      result = await gen.next()
    } while (!result.done)

    expect(result.value).toBe('OK')
  })

  // 8. 에러: apiKey 미설정 시 throw
  it('stream throws when not configured', async () => {
    const provider = new OpenRouterProvider({ apiKey: '' })
    const gen = provider.stream(makeSendParams())

    await expect(gen.next()).rejects.toThrow('OpenRouter API 키가 설정되지 않았습니다')
  })

  // 9. 에러: 401 인증 실패
  it('stream throws on 401 unauthorized', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), { status: 401 }),
    )

    const provider = new OpenRouterProvider({ apiKey: 'bad-key' })
    const gen = provider.stream(makeSendParams())

    await expect(gen.next()).rejects.toThrow('Invalid API key')
  })

  // 10. 에러: 429 rate limit
  it('stream throws on 429 rate limit', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'Rate limit exceeded' } }), { status: 429 }),
    )

    const provider = new OpenRouterProvider({ apiKey: 'sk-or-test' })
    const gen = provider.stream(makeSendParams())

    await expect(gen.next()).rejects.toThrow('Rate limit exceeded')
  })

  // 11. 에러: 네트워크 에러
  it('stream throws on network error', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error('Network error'))

    const provider = new OpenRouterProvider({ apiKey: 'sk-or-test' })
    const gen = provider.stream(makeSendParams())

    await expect(gen.next()).rejects.toThrow('Network error')
  })

  // 12. 헤더: Authorization, HTTP-Referer, X-Title
  it('sends correct headers including Authorization, HTTP-Referer, X-Title', async () => {
    const sseData = ['data: {"choices":[{"delta":{"content":"hi"}}]}\n\ndata: [DONE]\n\n']

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(createMockSSEStream(sseData), { status: 200 }),
    )

    const provider = new OpenRouterProvider({
      apiKey: 'sk-or-test',
      siteUrl: 'https://example.com',
      siteName: 'H Chat',
    })

    const gen = provider.stream(makeSendParams())
    // Consume the generator
    let result: IteratorResult<string, string>
    do {
      result = await gen.next()
    } while (!result.done)

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]
    const [url, options] = fetchCall as [string, RequestInit]

    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer sk-or-test')
    expect((options.headers as Record<string, string>)['HTTP-Referer']).toBe('https://example.com')
    expect((options.headers as Record<string, string>)['X-Title']).toBe('H Chat')
  })

  // 13. 헤더: siteUrl/siteName 미설정 시 해당 헤더 제외
  it('omits HTTP-Referer and X-Title when not configured', async () => {
    const sseData = ['data: {"choices":[{"delta":{"content":"hi"}}]}\n\ndata: [DONE]\n\n']

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(createMockSSEStream(sseData), { status: 200 }),
    )

    const provider = new OpenRouterProvider({ apiKey: 'sk-or-test' })

    const gen = provider.stream(makeSendParams())
    let result: IteratorResult<string, string>
    do {
      result = await gen.next()
    } while (!result.done)

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]
    const [, options] = fetchCall as [string, RequestInit]
    const headers = options.headers as Record<string, string>

    expect(headers['HTTP-Referer']).toBeUndefined()
    expect(headers['X-Title']).toBeUndefined()
  })

  // 14. testConnection 성공
  it('testConnection returns true on successful response', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response('{}', { status: 200 }))

    const provider = new OpenRouterProvider({ apiKey: 'sk-or-test' })
    const result = await provider.testConnection()

    expect(result).toBe(true)
  })

  // 15. testConnection 실패
  it('testConnection returns false when not configured', async () => {
    const provider = new OpenRouterProvider({ apiKey: '' })
    const result = await provider.testConnection()

    expect(result).toBe(false)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
