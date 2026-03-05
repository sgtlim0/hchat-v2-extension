import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenAIProvider, OPENAI_MODELS } from '../openai-provider'

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

function sseLines(texts: string[]): string[] {
  const lines: string[] = []
  for (const text of texts) {
    lines.push(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`)
  }
  lines.push('data: [DONE]\n\n')
  return lines
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('OpenAIProvider', () => {
  describe('isConfigured', () => {
    it('returns false when API key is empty', () => {
      const provider = new OpenAIProvider('')
      expect(provider.isConfigured()).toBe(false)
    })

    it('returns true when API key is set', () => {
      const provider = new OpenAIProvider('sk-test-key')
      expect(provider.isConfigured()).toBe(true)
    })
  })

  describe('models', () => {
    it('exposes OPENAI_MODELS', () => {
      const provider = new OpenAIProvider('sk-test')
      expect(provider.models).toBe(OPENAI_MODELS)
      expect(provider.type).toBe('openai')
    })
  })

  describe('stream', () => {
    it('throws when not configured', async () => {
      const provider = new OpenAIProvider('')
      const gen = provider.stream({ model: 'gpt-4o', messages: [{ role: 'user', content: 'Hi' }] })
      await expect(gen.next()).rejects.toThrow('OpenAI API 키가 설정되지 않았습니다')
    })

    it('streams text chunks from SSE response', async () => {
      const provider = new OpenAIProvider('sk-test')
      const body = makeSSEStream(sseLines(['Hello', ' world']))

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        body,
        text: async () => '',
      } as unknown as Response)

      const chunks: string[] = []
      const gen = provider.stream({ model: 'gpt-4o', messages: [{ role: 'user', content: 'Hi' }] })
      let result = await gen.next()
      while (!result.done) {
        chunks.push(result.value)
        result = await gen.next()
      }

      expect(chunks).toEqual(['Hello', ' world'])
      expect(result.value).toBe('Hello world')
    })

    it('throws on HTTP error with parsed error message', async () => {
      const provider = new OpenAIProvider('sk-test')
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: { message: 'Invalid API key' } }),
      } as unknown as Response)

      const gen = provider.stream({ model: 'gpt-4o', messages: [{ role: 'user', content: 'Hi' }] })
      await expect(gen.next()).rejects.toThrow('Invalid API key')
    })

    it('throws on HTTP error with plain text', async () => {
      const provider = new OpenAIProvider('sk-test')
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as unknown as Response)

      const gen = provider.stream({ model: 'gpt-4o', messages: [{ role: 'user', content: 'Hi' }] })
      await expect(gen.next()).rejects.toThrow('Internal Server Error')
    })

    it('throws on HTTP error with empty text', async () => {
      const provider = new OpenAIProvider('sk-test')
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => '',
      } as unknown as Response)

      const gen = provider.stream({ model: 'gpt-4o', messages: [{ role: 'user', content: 'Hi' }] })
      await expect(gen.next()).rejects.toThrow('HTTP 503')
    })

    it('throws when response body is null', async () => {
      const provider = new OpenAIProvider('sk-test')
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        body: null,
        text: async () => '',
      } as unknown as Response)

      const gen = provider.stream({ model: 'gpt-4o', messages: [{ role: 'user', content: 'Hi' }] })
      await expect(gen.next()).rejects.toThrow()
    })

    it('passes system prompt in messages', async () => {
      const provider = new OpenAIProvider('sk-test')
      const body = makeSSEStream(sseLines(['OK']))
      let capturedBody = ''

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedBody = init?.body as string
        return { ok: true, body, text: async () => '' } as unknown as Response
      })

      const gen = provider.stream({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hi' }],
        systemPrompt: 'You are helpful',
      })
      // Consume the generator
      while (!(await gen.next()).done) {}

      const parsed = JSON.parse(capturedBody)
      expect(parsed.messages[0]).toEqual({ role: 'system', content: 'You are helpful' })
    })

    it('handles thinkingDepth fast', async () => {
      const provider = new OpenAIProvider('sk-test')
      const body = makeSSEStream(sseLines(['OK']))
      let capturedBody = ''

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedBody = init?.body as string
        return { ok: true, body, text: async () => '' } as unknown as Response
      })

      const gen = provider.stream({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hi' }],
        thinkingDepth: 'fast',
        maxTokens: 4096,
      })
      while (!(await gen.next()).done) {}

      const parsed = JSON.parse(capturedBody)
      expect(parsed.max_tokens).toBe(1024)
    })

    it('handles thinkingDepth deep', async () => {
      const provider = new OpenAIProvider('sk-test')
      const body = makeSSEStream(sseLines(['OK']))
      let capturedBody = ''

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedBody = init?.body as string
        return { ok: true, body, text: async () => '' } as unknown as Response
      })

      const gen = provider.stream({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hi' }],
        thinkingDepth: 'deep',
      })
      while (!(await gen.next()).done) {}

      const parsed = JSON.parse(capturedBody)
      expect(parsed.reasoning_effort).toBe('high')
    })

    it('handles multimodal content parts', async () => {
      const provider = new OpenAIProvider('sk-test')
      const body = makeSSEStream(sseLines(['OK']))
      let capturedBody = ''

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedBody = init?.body as string
        return { ok: true, body, text: async () => '' } as unknown as Response
      })

      const gen = provider.stream({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'What is this?' },
            { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,abc123' } },
          ],
        }],
      })
      while (!(await gen.next()).done) {}

      const parsed = JSON.parse(capturedBody)
      const userMsg = parsed.messages[0]
      expect(userMsg.content[0]).toEqual({ type: 'text', text: 'What is this?' })
      expect(userMsg.content[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,abc123' } })
    })

    it('skips system role messages from input', async () => {
      const provider = new OpenAIProvider('sk-test')
      const body = makeSSEStream(sseLines(['OK']))
      let capturedBody = ''

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedBody = init?.body as string
        return { ok: true, body, text: async () => '' } as unknown as Response
      })

      const gen = provider.stream({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'ignored' },
          { role: 'user', content: 'Hi' },
        ],
      })
      while (!(await gen.next()).done) {}

      const parsed = JSON.parse(capturedBody)
      expect(parsed.messages.every((m: { role: string }) => m.role !== 'system')).toBe(true)
    })

    it('skips invalid JSON in SSE stream', async () => {
      const provider = new OpenAIProvider('sk-test')
      const body = makeSSEStream([
        `data: ${JSON.stringify({ choices: [{ delta: { content: 'Hello' } }] })}\n\n`,
        'data: {invalid json}\n\n',
        `data: ${JSON.stringify({ choices: [{ delta: { content: ' world' } }] })}\n\n`,
        'data: [DONE]\n\n',
      ])

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        body,
        text: async () => '',
      } as unknown as Response)

      const chunks: string[] = []
      const gen = provider.stream({ model: 'gpt-4o', messages: [{ role: 'user', content: 'Hi' }] })
      let result = await gen.next()
      while (!result.done) {
        chunks.push(result.value)
        result = await gen.next()
      }

      expect(chunks).toEqual(['Hello', ' world'])
    })

    it('skips SSE lines without content delta', async () => {
      const provider = new OpenAIProvider('sk-test')
      const body = makeSSEStream([
        `data: ${JSON.stringify({ choices: [{ delta: {} }] })}\n\n`,
        `data: ${JSON.stringify({ choices: [{ delta: { content: 'Hi' } }] })}\n\n`,
        'data: [DONE]\n\n',
      ])

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        body,
        text: async () => '',
      } as unknown as Response)

      const chunks: string[] = []
      const gen = provider.stream({ model: 'gpt-4o', messages: [{ role: 'user', content: 'test' }] })
      let result = await gen.next()
      while (!result.done) {
        chunks.push(result.value)
        result = await gen.next()
      }

      expect(chunks).toEqual(['Hi'])
    })
  })

  describe('testConnection', () => {
    it('returns false when not configured', async () => {
      const provider = new OpenAIProvider('')
      expect(await provider.testConnection()).toBe(false)
    })

    it('returns true on successful response', async () => {
      const provider = new OpenAIProvider('sk-test')
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response)
      expect(await provider.testConnection()).toBe(true)
    })

    it('returns false on failed response', async () => {
      const provider = new OpenAIProvider('sk-test')
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as Response)
      expect(await provider.testConnection()).toBe(false)
    })

    it('returns false on network error', async () => {
      const provider = new OpenAIProvider('sk-test')
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))
      expect(await provider.testConnection()).toBe(false)
    })
  })
})
