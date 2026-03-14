import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenAIProvider } from '../openai-provider'
import { GeminiProvider } from '../gemini-provider'
import { OpenRouterProvider } from '../openrouter-provider'
import { OllamaProvider } from '../ollama-provider'
import { BedrockProvider } from '../bedrock-provider'
import { streamWithRetry } from '../stream-retry'
import type { SendParams, AIProvider } from '../types'

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────

function makeSSEStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let index = 0
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]))
        index++
      } else {
        controller.close()
      }
    },
  })
}

function openaiSSE(texts: string[]): string[] {
  return [
    ...texts.map((t) =>
      `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`
    ),
    'data: [DONE]\n\n',
  ]
}

function geminiSSE(texts: string[]): string[] {
  return texts.map((t) =>
    `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] })}\n\n`
  )
}

function ollamaNDJSON(texts: string[]): string[] {
  return [
    ...texts.map((t) => JSON.stringify({ message: { content: t }, done: false }) + '\n'),
    JSON.stringify({ message: { content: '' }, done: true }) + '\n',
  ]
}

/** Build a mock Bedrock binary event stream frame */
function bedrockFrame(text: string): Uint8Array {
  const inner = JSON.stringify({ type: 'content_block_delta', delta: { text } })
  const b64 = btoa(inner)
  const event = JSON.stringify({ bytes: b64 })
  const payload = new TextEncoder().encode(event)
  const headersLength = 0
  const totalLength = 12 + headersLength + payload.length + 4 // 12 prelude + headers + payload + crc
  const frame = new Uint8Array(totalLength)
  const view = new DataView(frame.buffer)
  view.setUint32(0, totalLength)
  view.setUint32(4, headersLength)
  view.setUint32(8, 0) // prelude CRC
  frame.set(payload, 12 + headersLength)
  return frame
}

function makeBedrockStream(texts: string[]): ReadableStream<Uint8Array> {
  const frames = texts.map(bedrockFrame)
  let index = 0
  return new ReadableStream({
    pull(controller) {
      if (index < frames.length) {
        controller.enqueue(frames[index])
        index++
      } else {
        controller.close()
      }
    },
  })
}

async function collectStream(
  gen: AsyncGenerator<string, string>
): Promise<{ chunks: string[]; result: string }> {
  const chunks: string[] = []
  let r = await gen.next()
  while (!r.done) {
    chunks.push(r.value)
    r = await gen.next()
  }
  return { chunks, result: r.value }
}

function mockFetchOk(body: ReadableStream<Uint8Array>) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    body,
    text: async () => '',
  } as unknown as Response)
}

function mockFetchError(status: number, body: string) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: false,
    status,
    text: async () => body,
  } as unknown as Response)
}

const defaultParams: SendParams = {
  model: 'test-model',
  messages: [{ role: 'user', content: 'Hello' }],
}

// ──────────────────────────────────────────────────
// Mock signRequest for Bedrock
// ──────────────────────────────────────────────────

vi.mock('../../aws-sigv4', () => ({
  signRequest: vi.fn(async ({ headers }: { headers: Record<string, string> }) => ({
    ...headers,
    Authorization: 'AWS4-HMAC-SHA256 ...',
  })),
}))

// ──────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('Provider Integration Tests', () => {
  // ──────────────────────────────────────────
  // 1. Normal streaming flow for each provider
  // ──────────────────────────────────────────

  describe('normal streaming — OpenAI', () => {
    it('streams and accumulates text', async () => {
      const provider = new OpenAIProvider('sk-test')
      mockFetchOk(makeSSEStream(openaiSSE(['Hello', ' world'])))
      const { chunks, result } = await collectStream(
        provider.stream({ ...defaultParams, model: 'gpt-4o' })
      )
      expect(chunks).toEqual(['Hello', ' world'])
      expect(result).toBe('Hello world')
    })

    it('sends correct request body', async () => {
      const provider = new OpenAIProvider('sk-test')
      let capturedBody = ''
      let capturedHeaders: Record<string, string> = {}
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedBody = init?.body as string
        capturedHeaders = init?.headers as Record<string, string>
        return {
          ok: true,
          body: makeSSEStream(openaiSSE(['OK'])),
          text: async () => '',
        } as unknown as Response
      })
      const gen = provider.stream({
        ...defaultParams,
        model: 'gpt-4o',
        systemPrompt: 'Be helpful',
        maxTokens: 1000,
      })
      await collectStream(gen)
      const body = JSON.parse(capturedBody)
      expect(body.model).toBe('gpt-4o')
      expect(body.stream).toBe(true)
      expect(body.max_tokens).toBe(1000)
      expect(body.messages[0]).toEqual({ role: 'system', content: 'Be helpful' })
      expect(capturedHeaders['Authorization']).toBe('Bearer sk-test')
    })
  })

  describe('normal streaming — Gemini', () => {
    it('streams and accumulates text', async () => {
      const provider = new GeminiProvider('gem-key')
      mockFetchOk(makeSSEStream(geminiSSE(['Hi', ' there'])))
      const { chunks, result } = await collectStream(
        provider.stream({ ...defaultParams, model: 'gemini-2.0-flash' })
      )
      expect(chunks).toEqual(['Hi', ' there'])
      expect(result).toBe('Hi there')
    })

    it('sends API key in header, not URL', async () => {
      const provider = new GeminiProvider('secret-key')
      let capturedUrl = ''
      let capturedHeaders: Record<string, string> = {}
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
        capturedUrl = url as string
        capturedHeaders = init?.headers as Record<string, string>
        return {
          ok: true,
          body: makeSSEStream(geminiSSE(['OK'])),
          text: async () => '',
        } as unknown as Response
      })
      const gen = provider.stream({ ...defaultParams, model: 'gemini-2.0-flash' })
      await collectStream(gen)
      expect(capturedUrl).not.toContain('key=')
      expect(capturedHeaders['x-goog-api-key']).toBe('secret-key')
    })
  })

  describe('normal streaming — OpenRouter', () => {
    it('streams and accumulates text', async () => {
      const provider = new OpenRouterProvider({ apiKey: 'or-key' })
      mockFetchOk(makeSSEStream(openaiSSE(['Open', 'Router'])))
      const { chunks, result } = await collectStream(
        provider.stream({ ...defaultParams, model: 'meta-llama/llama-3-70b' })
      )
      expect(chunks).toEqual(['Open', 'Router'])
      expect(result).toBe('OpenRouter')
    })

    it('sends custom site headers when configured', async () => {
      const provider = new OpenRouterProvider({
        apiKey: 'or-key',
        siteUrl: 'https://myapp.com',
        siteName: 'MyApp',
      })
      let capturedHeaders: Record<string, string> = {}
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedHeaders = init?.headers as Record<string, string>
        return {
          ok: true,
          body: makeSSEStream(openaiSSE(['OK'])),
          text: async () => '',
        } as unknown as Response
      })
      const gen = provider.stream({ ...defaultParams, model: 'meta-llama/llama-3-70b' })
      await collectStream(gen)
      expect(capturedHeaders['HTTP-Referer']).toBe('https://myapp.com')
      expect(capturedHeaders['X-Title']).toBe('MyApp')
    })
  })

  describe('normal streaming — Ollama (NDJSON)', () => {
    it('streams NDJSON and accumulates text', async () => {
      const provider = new OllamaProvider({ baseUrl: 'http://localhost:11434' })
      mockFetchOk(makeSSEStream(ollamaNDJSON(['Hello', ' Ollama'])))
      const { chunks, result } = await collectStream(
        provider.stream({ ...defaultParams, model: 'llama3' })
      )
      expect(chunks).toEqual(['Hello', ' Ollama'])
      expect(result).toBe('Hello Ollama')
    })

    it('skips done:true NDJSON lines', async () => {
      const provider = new OllamaProvider({ baseUrl: 'http://localhost:11434' })
      const ndjson = [
        JSON.stringify({ message: { content: 'A' }, done: false }) + '\n',
        JSON.stringify({ message: { content: '' }, done: true }) + '\n',
      ]
      mockFetchOk(makeSSEStream(ndjson))
      const { chunks } = await collectStream(
        provider.stream({ ...defaultParams, model: 'llama3' })
      )
      expect(chunks).toEqual(['A'])
    })
  })

  describe('normal streaming — Bedrock (binary event stream)', () => {
    it('streams and accumulates text from binary frames', async () => {
      const provider = new BedrockProvider({
        accessKeyId: 'AKID',
        secretAccessKey: 'secret',
        region: 'us-east-1',
      })
      mockFetchOk(makeBedrockStream(['Hello', ' Bedrock']))
      const { chunks, result } = await collectStream(
        provider.stream({ ...defaultParams, model: 'us.anthropic.claude-sonnet-4-6' })
      )
      expect(chunks).toEqual(['Hello', ' Bedrock'])
      expect(result).toBe('Hello Bedrock')
    })
  })

  // ──────────────────────────────────────────
  // 2. Error handling
  // ──────────────────────────────────────────

  describe('error handling — HTTP errors', () => {
    it('OpenAI throws parsed JSON error', async () => {
      const provider = new OpenAIProvider('sk-test')
      mockFetchError(400, JSON.stringify({ error: { message: 'Invalid model' } }))
      const gen = provider.stream({ ...defaultParams, model: 'gpt-4o' })
      await expect(gen.next()).rejects.toThrow('Invalid model')
    })

    it('Gemini throws parsed error message', async () => {
      const provider = new GeminiProvider('gem-key')
      mockFetchError(429, JSON.stringify({ error: { message: 'Rate limited' } }))
      const gen = provider.stream({ ...defaultParams, model: 'gemini-2.0-flash' })
      await expect(gen.next()).rejects.toThrow('Rate limited')
    })

    it('OpenRouter throws on server error', async () => {
      const provider = new OpenRouterProvider({ apiKey: 'or-key' })
      mockFetchError(503, 'Service Unavailable')
      const gen = provider.stream({ ...defaultParams, model: 'meta-llama/llama-3-70b' })
      await expect(gen.next()).rejects.toThrow('Service Unavailable')
    })

    it('Ollama throws on HTTP error', async () => {
      const provider = new OllamaProvider({ baseUrl: 'http://localhost:11434' })
      mockFetchError(500, JSON.stringify({ error: { message: 'Model not found' } }))
      const gen = provider.stream({ ...defaultParams, model: 'nonexistent' })
      await expect(gen.next()).rejects.toThrow('Model not found')
    })

    it('Bedrock throws on HTTP error', async () => {
      const provider = new BedrockProvider({
        accessKeyId: 'AKID',
        secretAccessKey: 'secret',
        region: 'us-east-1',
      })
      mockFetchError(403, JSON.stringify({ message: 'Access denied' }))
      const gen = provider.stream({ ...defaultParams, model: 'us.anthropic.claude-sonnet-4-6' })
      await expect(gen.next()).rejects.toThrow('Access denied')
    })
  })

  describe('error handling — not configured', () => {
    it('OpenAI throws when not configured', async () => {
      const gen = new OpenAIProvider('').stream(defaultParams)
      await expect(gen.next()).rejects.toThrow()
    })

    it('Gemini throws when not configured', async () => {
      const gen = new GeminiProvider('').stream(defaultParams)
      await expect(gen.next()).rejects.toThrow()
    })

    it('OpenRouter throws when not configured', async () => {
      const gen = new OpenRouterProvider({ apiKey: '' }).stream(defaultParams)
      await expect(gen.next()).rejects.toThrow()
    })

    it('Ollama throws when not configured', async () => {
      const gen = new OllamaProvider({ baseUrl: '' }).stream(defaultParams)
      await expect(gen.next()).rejects.toThrow()
    })

    it('Bedrock throws when not configured', async () => {
      const gen = new BedrockProvider({
        accessKeyId: '',
        secretAccessKey: '',
        region: 'us-east-1',
      }).stream(defaultParams)
      await expect(gen.next()).rejects.toThrow()
    })
  })

  describe('error handling — null body', () => {
    it('OpenAI throws when body is null', async () => {
      const provider = new OpenAIProvider('sk-test')
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        body: null,
        text: async () => '',
      } as unknown as Response)
      const gen = provider.stream({ ...defaultParams, model: 'gpt-4o' })
      await expect(gen.next()).rejects.toThrow()
    })

    it('Gemini throws when body is null', async () => {
      const provider = new GeminiProvider('gem-key')
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        body: null,
        text: async () => '',
      } as unknown as Response)
      const gen = provider.stream({ ...defaultParams, model: 'gemini-2.0-flash' })
      await expect(gen.next()).rejects.toThrow()
    })
  })

  // ──────────────────────────────────────────
  // 3. stream-retry integration
  // ──────────────────────────────────────────

  describe('stream-retry integration', () => {
    it('retries OpenAI on network error and resumes', async () => {
      let attempt = 0
      const provider: AIProvider = {
        type: 'openai',
        models: [],
        isConfigured: () => true,
        testConnection: async () => true,
        stream: async function* () {
          attempt++
          if (attempt === 1) {
            yield 'Hello'
            throw new Error('failed to fetch')
          }
          yield 'Hello world'
          return 'Hello world'
        },
      }

      const { chunks, result } = await collectStream(
        streamWithRetry(provider, defaultParams, { maxRetries: 2, retryDelayMs: 0 })
      )
      expect(chunks.join('')).toContain('world')
      expect(result).toBe('Hello world')
    })

    it('does not retry on API error (non-network)', async () => {
      const provider: AIProvider = {
        type: 'openai',
        models: [],
        isConfigured: () => true,
        testConnection: async () => true,
        stream: async function* (): AsyncGenerator<string, string> {
          throw new Error('Invalid API key')
        },
      }

      const gen = streamWithRetry(provider, defaultParams, { maxRetries: 2, retryDelayMs: 0 })
      await expect(gen.next()).rejects.toThrow('Invalid API key')
    })

    it('does not retry on AbortError', async () => {
      const provider: AIProvider = {
        type: 'openai',
        models: [],
        isConfigured: () => true,
        testConnection: async () => true,
        stream: async function* (): AsyncGenerator<string, string> {
          throw new DOMException('Aborted', 'AbortError')
        },
      }

      const gen = streamWithRetry(provider, defaultParams, { maxRetries: 2, retryDelayMs: 0 })
      await expect(gen.next()).rejects.toThrow()
    })

    it('exhausts retries and throws', async () => {
      const onRetry = vi.fn()
      const provider: AIProvider = {
        type: 'openai',
        models: [],
        isConfigured: () => true,
        testConnection: async () => true,
        stream: async function* (): AsyncGenerator<string, string> {
          throw new Error('ECONNRESET')
        },
      }

      const gen = streamWithRetry(provider, defaultParams, {
        maxRetries: 1,
        retryDelayMs: 0,
        onRetry,
      })
      await expect(gen.next()).rejects.toThrow('ECONNRESET')
      expect(onRetry).toHaveBeenCalledTimes(1)
    })
  })

  // ──────────────────────────────────────────
  // 4. AbortController / signal handling
  // ──────────────────────────────────────────

  describe('AbortController signal handling', () => {
    it('OpenAI passes signal to fetch', async () => {
      const provider = new OpenAIProvider('sk-test')
      const controller = new AbortController()
      let capturedSignal: AbortSignal | undefined

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedSignal = init?.signal as AbortSignal
        return {
          ok: true,
          body: makeSSEStream(openaiSSE(['OK'])),
          text: async () => '',
        } as unknown as Response
      })

      const gen = provider.stream({
        ...defaultParams,
        model: 'gpt-4o',
        signal: controller.signal,
      })
      await collectStream(gen)
      expect(capturedSignal).toBe(controller.signal)
    })

    it('Gemini passes signal to fetch', async () => {
      const provider = new GeminiProvider('gem-key')
      const controller = new AbortController()
      let capturedSignal: AbortSignal | undefined

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedSignal = init?.signal as AbortSignal
        return {
          ok: true,
          body: makeSSEStream(geminiSSE(['OK'])),
          text: async () => '',
        } as unknown as Response
      })

      const gen = provider.stream({
        ...defaultParams,
        model: 'gemini-2.0-flash',
        signal: controller.signal,
      })
      await collectStream(gen)
      expect(capturedSignal).toBe(controller.signal)
    })

    it('Ollama passes signal to fetch', async () => {
      const provider = new OllamaProvider({ baseUrl: 'http://localhost:11434' })
      const controller = new AbortController()
      let capturedSignal: AbortSignal | undefined

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedSignal = init?.signal as AbortSignal
        return {
          ok: true,
          body: makeSSEStream(ollamaNDJSON(['OK'])),
          text: async () => '',
        } as unknown as Response
      })

      const gen = provider.stream({
        ...defaultParams,
        model: 'llama3',
        signal: controller.signal,
      })
      await collectStream(gen)
      expect(capturedSignal).toBe(controller.signal)
    })

    it('Bedrock passes signal to fetch', async () => {
      const provider = new BedrockProvider({
        accessKeyId: 'AKID',
        secretAccessKey: 'secret',
        region: 'us-east-1',
      })
      const controller = new AbortController()
      let capturedSignal: AbortSignal | undefined

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedSignal = init?.signal as AbortSignal
        return {
          ok: true,
          body: makeBedrockStream(['OK']),
          text: async () => '',
        } as unknown as Response
      })

      const gen = provider.stream({
        ...defaultParams,
        model: 'us.anthropic.claude-sonnet-4-6',
        signal: controller.signal,
      })
      await collectStream(gen)
      expect(capturedSignal).toBe(controller.signal)
    })

    it('stream-retry does not retry when signal is aborted', async () => {
      const controller = new AbortController()
      controller.abort()

      const provider: AIProvider = {
        type: 'openai',
        models: [],
        isConfigured: () => true,
        testConnection: async () => true,
        stream: async function* (): AsyncGenerator<string, string> {
          throw new Error('network error')
        },
      }

      const gen = streamWithRetry(
        provider,
        { ...defaultParams, signal: controller.signal },
        { maxRetries: 3, retryDelayMs: 0 }
      )
      await expect(gen.next()).rejects.toThrow()
    })
  })

  // ──────────────────────────────────────────
  // 5. thinkingDepth parameter handling
  // ──────────────────────────────────────────

  describe('thinkingDepth handling', () => {
    it('OpenAI fast mode caps maxTokens to 1024', async () => {
      const provider = new OpenAIProvider('sk-test')
      let capturedBody = ''
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedBody = init?.body as string
        return {
          ok: true,
          body: makeSSEStream(openaiSSE(['OK'])),
          text: async () => '',
        } as unknown as Response
      })
      const gen = provider.stream({
        ...defaultParams,
        model: 'gpt-4o',
        maxTokens: 4096,
        thinkingDepth: 'fast',
      })
      await collectStream(gen)
      expect(JSON.parse(capturedBody).max_tokens).toBe(1024)
    })

    it('OpenAI deep mode sets reasoning_effort', async () => {
      const provider = new OpenAIProvider('sk-test')
      let capturedBody = ''
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedBody = init?.body as string
        return {
          ok: true,
          body: makeSSEStream(openaiSSE(['OK'])),
          text: async () => '',
        } as unknown as Response
      })
      const gen = provider.stream({
        ...defaultParams,
        model: 'gpt-4o',
        thinkingDepth: 'deep',
      })
      await collectStream(gen)
      expect(JSON.parse(capturedBody).reasoning_effort).toBe('high')
    })

    it('Gemini deep mode sets thinkingConfig', async () => {
      const provider = new GeminiProvider('gem-key')
      let capturedBody = ''
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedBody = init?.body as string
        return {
          ok: true,
          body: makeSSEStream(geminiSSE(['OK'])),
          text: async () => '',
        } as unknown as Response
      })
      const gen = provider.stream({
        ...defaultParams,
        model: 'gemini-2.0-flash',
        thinkingDepth: 'deep',
      })
      await collectStream(gen)
      expect(JSON.parse(capturedBody).generationConfig.thinkingConfig).toEqual({
        thinkingBudget: 10000,
      })
    })

    it('Bedrock deep mode sets thinking enabled', async () => {
      const provider = new BedrockProvider({
        accessKeyId: 'AKID',
        secretAccessKey: 'secret',
        region: 'us-east-1',
      })
      let capturedBody = ''
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedBody = init?.body as string
        return {
          ok: true,
          body: makeBedrockStream(['OK']),
          text: async () => '',
        } as unknown as Response
      })
      const gen = provider.stream({
        ...defaultParams,
        model: 'us.anthropic.claude-sonnet-4-6',
        thinkingDepth: 'deep',
      })
      await collectStream(gen)
      const body = JSON.parse(capturedBody)
      expect(body.thinking).toEqual({ type: 'enabled', budget_tokens: 10000 })
    })
  })

  // ──────────────────────────────────────────
  // 6. testConnection for all providers
  // ──────────────────────────────────────────

  describe('testConnection', () => {
    it('OpenAI returns true on success', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response)
      expect(await new OpenAIProvider('sk-test').testConnection()).toBe(true)
    })

    it('OpenAI returns false on failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as Response)
      expect(await new OpenAIProvider('sk-test').testConnection()).toBe(false)
    })

    it('Gemini returns true on success', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response)
      expect(await new GeminiProvider('gem-key').testConnection()).toBe(true)
    })

    it('OpenRouter returns true on success', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response)
      expect(await new OpenRouterProvider({ apiKey: 'or-key' }).testConnection()).toBe(true)
    })

    it('Ollama returns true on success', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response)
      expect(await new OllamaProvider({ baseUrl: 'http://localhost:11434' }).testConnection()).toBe(true)
    })

    it('Bedrock returns true on success', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response)
      expect(
        await new BedrockProvider({
          accessKeyId: 'AKID',
          secretAccessKey: 'secret',
          region: 'us-east-1',
        }).testConnection()
      ).toBe(true)
    })

    it('all providers return false when not configured', async () => {
      expect(await new OpenAIProvider('').testConnection()).toBe(false)
      expect(await new GeminiProvider('').testConnection()).toBe(false)
      expect(await new OpenRouterProvider({ apiKey: '' }).testConnection()).toBe(false)
      expect(await new BedrockProvider({ accessKeyId: '', secretAccessKey: '', region: '' }).testConnection()).toBe(false)
    })

    it('all providers return false on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network'))
      expect(await new OpenAIProvider('sk-test').testConnection()).toBe(false)
      expect(await new GeminiProvider('gem-key').testConnection()).toBe(false)
      expect(await new OpenRouterProvider({ apiKey: 'or-key' }).testConnection()).toBe(false)
      expect(await new OllamaProvider({ baseUrl: 'http://localhost:11434' }).testConnection()).toBe(false)
      expect(
        await new BedrockProvider({
          accessKeyId: 'AKID',
          secretAccessKey: 'secret',
          region: 'us-east-1',
        }).testConnection()
      ).toBe(false)
    })
  })
})
