import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BedrockProvider, BEDROCK_MODELS } from '../bedrock-provider'

vi.mock('../../aws-sigv4', () => ({
  signRequest: vi.fn(async () => ({
    'content-type': 'application/json',
    'authorization': 'AWS4-HMAC-SHA256 ...',
    'x-amz-date': '20240101T000000Z',
  })),
}))

function makeBedrockEvent(text: string): Uint8Array {
  const inner = JSON.stringify({ type: 'content_block_delta', delta: { text } })
  const innerBytes = new TextEncoder().encode(inner)
  const base64 = btoa(String.fromCharCode(...innerBytes))
  const event = JSON.stringify({ bytes: base64 })
  const payload = new TextEncoder().encode(event)

  const headersLength = 0
  const totalLength = 12 + headersLength + payload.length + 4

  const buffer = new ArrayBuffer(totalLength)
  const view = new DataView(buffer)
  view.setUint32(0, totalLength)
  view.setUint32(4, headersLength)
  view.setUint32(8, 0)

  const arr = new Uint8Array(buffer)
  arr.set(payload, 12 + headersLength)

  return arr
}

function makeBedrockStream(events: Uint8Array[]): ReadableStream<Uint8Array> {
  let index = 0
  return new ReadableStream({
    pull(controller) {
      if (index < events.length) {
        controller.enqueue(events[index])
        index++
      } else {
        controller.close()
      }
    },
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('BedrockProvider', () => {
  const creds = { accessKeyId: 'AKIA_TEST', secretAccessKey: 'secret', region: 'us-east-1' }

  describe('isConfigured', () => {
    it('returns false when accessKeyId is empty', () => {
      expect(new BedrockProvider({ ...creds, accessKeyId: '' }).isConfigured()).toBe(false)
    })

    it('returns false when secretAccessKey is empty', () => {
      expect(new BedrockProvider({ ...creds, secretAccessKey: '' }).isConfigured()).toBe(false)
    })

    it('returns true with both keys', () => {
      expect(new BedrockProvider(creds).isConfigured()).toBe(true)
    })
  })

  describe('models', () => {
    it('exposes BEDROCK_MODELS', () => {
      const provider = new BedrockProvider(creds)
      expect(provider.models).toBe(BEDROCK_MODELS)
      expect(provider.type).toBe('bedrock')
    })
  })

  describe('stream', () => {
    it('throws when not configured', async () => {
      const provider = new BedrockProvider({ accessKeyId: '', secretAccessKey: '', region: 'us-east-1' })
      const gen = provider.stream({ model: 'test', messages: [{ role: 'user', content: 'Hi' }] })
      await expect(gen.next()).rejects.toThrow('AWS 자격증명이 설정되지 않았습니다')
    })

    it('streams text from binary event stream', async () => {
      const provider = new BedrockProvider(creds)
      const body = makeBedrockStream([makeBedrockEvent('Hello'), makeBedrockEvent(' world')])

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true, body, text: async () => '',
      } as unknown as Response)

      const chunks: string[] = []
      const gen = provider.stream({
        model: 'us.anthropic.claude-sonnet-4-6',
        messages: [{ role: 'user', content: 'Hi' }],
      })
      let r = await gen.next()
      while (!r.done) { chunks.push(r.value); r = await gen.next() }

      expect(chunks).toEqual(['Hello', ' world'])
      expect(r.value).toBe('Hello world')
    })

    it('throws on HTTP error with JSON message', async () => {
      const provider = new BedrockProvider(creds)
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false, status: 403, text: async () => JSON.stringify({ message: 'Access denied' }),
      } as unknown as Response)

      const gen = provider.stream({ model: 'test', messages: [{ role: 'user', content: 'Hi' }] })
      await expect(gen.next()).rejects.toThrow('Access denied')
    })

    it('throws on HTTP error with Message field', async () => {
      const provider = new BedrockProvider(creds)
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false, status: 403, text: async () => JSON.stringify({ Message: 'Forbidden' }),
      } as unknown as Response)

      const gen = provider.stream({ model: 'test', messages: [{ role: 'user', content: 'Hi' }] })
      await expect(gen.next()).rejects.toThrow('Forbidden')
    })

    it('throws on HTTP error with plain text', async () => {
      const provider = new BedrockProvider(creds)
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false, status: 500, text: async () => 'Server Error',
      } as unknown as Response)

      const gen = provider.stream({ model: 'test', messages: [{ role: 'user', content: 'Hi' }] })
      await expect(gen.next()).rejects.toThrow('Server Error')
    })

    it('throws on HTTP error with empty text', async () => {
      const provider = new BedrockProvider(creds)
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false, status: 503, text: async () => '',
      } as unknown as Response)

      const gen = provider.stream({ model: 'test', messages: [{ role: 'user', content: 'Hi' }] })
      await expect(gen.next()).rejects.toThrow('HTTP 503')
    })

    it('throws when body is null', async () => {
      const provider = new BedrockProvider(creds)
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true, body: null, text: async () => '',
      } as unknown as Response)

      const gen = provider.stream({ model: 'test', messages: [{ role: 'user', content: 'Hi' }] })
      await expect(gen.next()).rejects.toThrow()
    })

    it('sets system prompt in body', async () => {
      const provider = new BedrockProvider(creds)
      const body = makeBedrockStream([makeBedrockEvent('OK')])
      let capturedBody = ''

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedBody = init?.body as string
        return { ok: true, body, text: async () => '' } as unknown as Response
      })

      const gen = provider.stream({
        model: 'test', messages: [{ role: 'user', content: 'Hi' }], systemPrompt: 'Be helpful',
      })
      while (!(await gen.next()).done) {}

      expect(JSON.parse(capturedBody).system).toBe('Be helpful')
    })

    it('handles thinkingDepth fast', async () => {
      const provider = new BedrockProvider(creds)
      const body = makeBedrockStream([makeBedrockEvent('OK')])
      let capturedBody = ''

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedBody = init?.body as string
        return { ok: true, body, text: async () => '' } as unknown as Response
      })

      const gen = provider.stream({
        model: 'test', messages: [{ role: 'user', content: 'Hi' }], thinkingDepth: 'fast', maxTokens: 4096,
      })
      while (!(await gen.next()).done) {}

      expect(JSON.parse(capturedBody).max_tokens).toBe(1024)
    })

    it('handles thinkingDepth deep', async () => {
      const provider = new BedrockProvider(creds)
      const body = makeBedrockStream([makeBedrockEvent('OK')])
      let capturedBody = ''

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedBody = init?.body as string
        return { ok: true, body, text: async () => '' } as unknown as Response
      })

      const gen = provider.stream({
        model: 'test', messages: [{ role: 'user', content: 'Hi' }], thinkingDepth: 'deep',
      })
      while (!(await gen.next()).done) {}

      const parsed = JSON.parse(capturedBody)
      expect(parsed.thinking).toEqual({ type: 'enabled', budget_tokens: 10000 })
    })

    it('handles multimodal content', async () => {
      const provider = new BedrockProvider(creds)
      const body = makeBedrockStream([makeBedrockEvent('OK')])
      let capturedBody = ''

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedBody = init?.body as string
        return { ok: true, body, text: async () => '' } as unknown as Response
      })

      const gen = provider.stream({
        model: 'test',
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
      const msg = parsed.messages[0]
      expect(msg.content[0]).toEqual({ type: 'text', text: 'What is this?' })
      expect(msg.content[1].type).toBe('image')
      expect(msg.content[1].source.data).toBe('abc123')
    })

    it('filters system messages and defaults region', async () => {
      const provider = new BedrockProvider({ ...creds, region: '' })
      const body = makeBedrockStream([makeBedrockEvent('OK')])

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        expect(String(url)).toContain('us-east-1')
        return { ok: true, body, text: async () => '' } as unknown as Response
      })

      const gen = provider.stream({
        model: 'test',
        messages: [
          { role: 'system', content: 'ignored' },
          { role: 'user', content: 'Hi' },
        ],
      })
      while (!(await gen.next()).done) {}
    })
  })

  describe('testConnection', () => {
    it('returns false when not configured', async () => {
      expect(await new BedrockProvider({ accessKeyId: '', secretAccessKey: '', region: '' }).testConnection()).toBe(false)
    })

    it('returns true on success', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response)
      expect(await new BedrockProvider(creds).testConnection()).toBe(true)
    })

    it('returns false on failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as Response)
      expect(await new BedrockProvider(creds).testConnection()).toBe(false)
    })

    it('returns false on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network'))
      expect(await new BedrockProvider(creds).testConnection()).toBe(false)
    })

    it('defaults region to us-east-1', async () => {
      const provider = new BedrockProvider({ ...creds, region: '' })
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        expect(String(url)).toContain('us-east-1')
        return { ok: true } as Response
      })
      await provider.testConnection()
    })
  })
})
