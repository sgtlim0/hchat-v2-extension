import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GeminiProvider, GEMINI_MODELS } from '../gemini-provider'

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

function geminiSSE(texts: string[]): string[] {
  return texts.map((text) =>
    `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('GeminiProvider', () => {
  describe('isConfigured', () => {
    it('returns false when API key is empty', () => {
      expect(new GeminiProvider('').isConfigured()).toBe(false)
    })

    it('returns true when API key is set', () => {
      expect(new GeminiProvider('test-key').isConfigured()).toBe(true)
    })
  })

  describe('models', () => {
    it('exposes GEMINI_MODELS', () => {
      const provider = new GeminiProvider('key')
      expect(provider.models).toBe(GEMINI_MODELS)
      expect(provider.type).toBe('gemini')
    })
  })

  describe('stream', () => {
    it('throws when not configured', async () => {
      const gen = new GeminiProvider('').stream({ model: 'gemini-2.0-flash', messages: [{ role: 'user', content: 'Hi' }] })
      await expect(gen.next()).rejects.toThrow('Gemini API 키가 설정되지 않았습니다')
    })

    it('streams text chunks', async () => {
      const provider = new GeminiProvider('key')
      const body = makeSSEStream(geminiSSE(['Hello', ' world']))

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true, body, text: async () => '',
      } as unknown as Response)

      const chunks: string[] = []
      const gen = provider.stream({ model: 'gemini-2.0-flash', messages: [{ role: 'user', content: 'Hi' }] })
      let r = await gen.next()
      while (!r.done) { chunks.push(r.value); r = await gen.next() }

      expect(chunks).toEqual(['Hello', ' world'])
      expect(r.value).toBe('Hello world')
    })

    it('throws on HTTP error with JSON message', async () => {
      const provider = new GeminiProvider('key')
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false, status: 400, text: async () => JSON.stringify({ error: { message: 'Bad request' } }),
      } as unknown as Response)

      const gen = provider.stream({ model: 'gemini-2.0-flash', messages: [{ role: 'user', content: 'Hi' }] })
      await expect(gen.next()).rejects.toThrow('Bad request')
    })

    it('throws on HTTP error with plain text', async () => {
      const provider = new GeminiProvider('key')
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false, status: 500, text: async () => 'Server Error',
      } as unknown as Response)

      const gen = provider.stream({ model: 'gemini-2.0-flash', messages: [{ role: 'user', content: 'Hi' }] })
      await expect(gen.next()).rejects.toThrow('Server Error')
    })

    it('throws on HTTP error with empty body', async () => {
      const provider = new GeminiProvider('key')
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false, status: 503, text: async () => '',
      } as unknown as Response)

      const gen = provider.stream({ model: 'gemini-2.0-flash', messages: [{ role: 'user', content: 'Hi' }] })
      await expect(gen.next()).rejects.toThrow('HTTP 503')
    })

    it('throws when body is null', async () => {
      const provider = new GeminiProvider('key')
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true, body: null, text: async () => '',
      } as unknown as Response)

      const gen = provider.stream({ model: 'gemini-2.0-flash', messages: [{ role: 'user', content: 'Hi' }] })
      await expect(gen.next()).rejects.toThrow()
    })

    it('sends systemInstruction when systemPrompt provided', async () => {
      const provider = new GeminiProvider('key')
      const body = makeSSEStream(geminiSSE(['OK']))
      let capturedBody = ''

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedBody = init?.body as string
        return { ok: true, body, text: async () => '' } as unknown as Response
      })

      const gen = provider.stream({
        model: 'gemini-2.0-flash',
        messages: [{ role: 'user', content: 'Hi' }],
        systemPrompt: 'Be helpful',
      })
      while (!(await gen.next()).done) {}

      const parsed = JSON.parse(capturedBody)
      expect(parsed.systemInstruction).toEqual({ parts: [{ text: 'Be helpful' }] })
    })

    it('does not send systemInstruction when no systemPrompt', async () => {
      const provider = new GeminiProvider('key')
      const body = makeSSEStream(geminiSSE(['OK']))
      let capturedBody = ''

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedBody = init?.body as string
        return { ok: true, body, text: async () => '' } as unknown as Response
      })

      const gen = provider.stream({
        model: 'gemini-2.0-flash',
        messages: [{ role: 'user', content: 'Hi' }],
      })
      while (!(await gen.next()).done) {}

      const parsed = JSON.parse(capturedBody)
      expect(parsed.systemInstruction).toBeUndefined()
    })

    it('handles thinkingDepth fast', async () => {
      const provider = new GeminiProvider('key')
      const body = makeSSEStream(geminiSSE(['OK']))
      let capturedBody = ''

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedBody = init?.body as string
        return { ok: true, body, text: async () => '' } as unknown as Response
      })

      const gen = provider.stream({
        model: 'gemini-2.0-flash',
        messages: [{ role: 'user', content: 'Hi' }],
        thinkingDepth: 'fast',
        maxTokens: 4096,
      })
      while (!(await gen.next()).done) {}

      const parsed = JSON.parse(capturedBody)
      expect(parsed.generationConfig.maxOutputTokens).toBe(1024)
    })

    it('handles thinkingDepth deep', async () => {
      const provider = new GeminiProvider('key')
      const body = makeSSEStream(geminiSSE(['OK']))
      let capturedBody = ''

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedBody = init?.body as string
        return { ok: true, body, text: async () => '' } as unknown as Response
      })

      const gen = provider.stream({
        model: 'gemini-2.0-flash',
        messages: [{ role: 'user', content: 'Hi' }],
        thinkingDepth: 'deep',
      })
      while (!(await gen.next()).done) {}

      const parsed = JSON.parse(capturedBody)
      expect(parsed.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 10000 })
    })

    it('converts assistant role to model', async () => {
      const provider = new GeminiProvider('key')
      const body = makeSSEStream(geminiSSE(['OK']))
      let capturedBody = ''

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedBody = init?.body as string
        return { ok: true, body, text: async () => '' } as unknown as Response
      })

      const gen = provider.stream({
        model: 'gemini-2.0-flash',
        messages: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello' },
          { role: 'user', content: 'How are you?' },
        ],
      })
      while (!(await gen.next()).done) {}

      const parsed = JSON.parse(capturedBody)
      expect(parsed.contents[1].role).toBe('model')
    })

    it('handles multimodal content with base64 image', async () => {
      const provider = new GeminiProvider('key')
      const body = makeSSEStream(geminiSSE(['OK']))
      let capturedBody = ''

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedBody = init?.body as string
        return { ok: true, body, text: async () => '' } as unknown as Response
      })

      const gen = provider.stream({
        model: 'gemini-2.0-flash',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'What is this?' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
          ],
        }],
      })
      while (!(await gen.next()).done) {}

      const parsed = JSON.parse(capturedBody)
      expect(parsed.contents[0].parts[1]).toEqual({
        inline_data: { mime_type: 'image/png', data: 'abc123' },
      })
    })

    it('handles non-base64 image URL as text fallback', async () => {
      const provider = new GeminiProvider('key')
      const body = makeSSEStream(geminiSSE(['OK']))
      let capturedBody = ''

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedBody = init?.body as string
        return { ok: true, body, text: async () => '' } as unknown as Response
      })

      const gen = provider.stream({
        model: 'gemini-2.0-flash',
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: 'https://example.com/image.png' } },
          ],
        }],
      })
      while (!(await gen.next()).done) {}

      const parsed = JSON.parse(capturedBody)
      expect(parsed.contents[0].parts[0]).toEqual({ text: '[이미지]' })
    })

    it('skips system role messages', async () => {
      const provider = new GeminiProvider('key')
      const body = makeSSEStream(geminiSSE(['OK']))
      let capturedBody = ''

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedBody = init?.body as string
        return { ok: true, body, text: async () => '' } as unknown as Response
      })

      const gen = provider.stream({
        model: 'gemini-2.0-flash',
        messages: [
          { role: 'system', content: 'ignored' },
          { role: 'user', content: 'Hi' },
        ],
      })
      while (!(await gen.next()).done) {}

      const parsed = JSON.parse(capturedBody)
      expect(parsed.contents).toHaveLength(1)
      expect(parsed.contents[0].role).toBe('user')
    })

    it('sends API key in header, not in URL', async () => {
      const provider = new GeminiProvider('secret-key-123')
      const body = makeSSEStream(geminiSSE(['OK']))
      let capturedUrl = ''
      let capturedHeaders: Record<string, string> = {}

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
        capturedUrl = url as string
        capturedHeaders = (init?.headers ?? {}) as Record<string, string>
        return { ok: true, body, text: async () => '' } as unknown as Response
      })

      const gen = provider.stream({
        model: 'gemini-2.0-flash',
        messages: [{ role: 'user', content: 'Hi' }],
      })
      while (!(await gen.next()).done) {}

      expect(capturedUrl).not.toContain('key=')
      expect(capturedUrl).not.toContain('secret-key-123')
      expect(capturedHeaders['x-goog-api-key']).toBe('secret-key-123')
    })

    it('handles invalid JSON in SSE stream', async () => {
      const provider = new GeminiProvider('key')
      const body = makeSSEStream([
        ...geminiSSE(['Hello']),
        'data: {bad json}\n\n',
        ...geminiSSE([' world']),
      ])

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true, body, text: async () => '',
      } as unknown as Response)

      const chunks: string[] = []
      const gen = provider.stream({ model: 'gemini-2.0-flash', messages: [{ role: 'user', content: 'Hi' }] })
      let r = await gen.next()
      while (!r.done) { chunks.push(r.value); r = await gen.next() }

      expect(chunks).toEqual(['Hello', ' world'])
    })
  })

  describe('testConnection', () => {
    it('returns false when not configured', async () => {
      expect(await new GeminiProvider('').testConnection()).toBe(false)
    })

    it('returns true on success', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response)
      expect(await new GeminiProvider('key').testConnection()).toBe(true)
    })

    it('returns false on failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as Response)
      expect(await new GeminiProvider('key').testConnection()).toBe(false)
    })

    it('returns false on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network'))
      expect(await new GeminiProvider('key').testConnection()).toBe(false)
    })
  })
})
