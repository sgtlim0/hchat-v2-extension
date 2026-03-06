import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OllamaProvider } from '../ollama-provider'
import type { ModelDef } from '../types'

function makeNDJSONStream(objects: Record<string, unknown>[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let index = 0
  return new ReadableStream({
    pull(controller) {
      if (index < objects.length) {
        controller.enqueue(encoder.encode(JSON.stringify(objects[index]) + '\n'))
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

describe('OllamaProvider', () => {
  describe('isConfigured', () => {
    it('returns true with default baseUrl', () => {
      const provider = new OllamaProvider({})
      expect(provider.isConfigured()).toBe(true)
    })

    it('returns true with custom baseUrl', () => {
      const provider = new OllamaProvider({ baseUrl: 'http://192.168.1.10:11434' })
      expect(provider.isConfigured()).toBe(true)
    })

    it('returns false with empty baseUrl', () => {
      const provider = new OllamaProvider({ baseUrl: '' })
      expect(provider.isConfigured()).toBe(false)
    })
  })

  describe('type', () => {
    it('has type ollama', () => {
      const provider = new OllamaProvider({})
      expect(provider.type).toBe('ollama')
    })
  })

  describe('loadModels', () => {
    it('fetches models from /api/tags', async () => {
      const provider = new OllamaProvider({})
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            { name: 'llama3:latest', size: 4_000_000_000 },
            { name: 'mistral:latest', size: 3_000_000_000 },
          ],
        }),
      } as unknown as Response)

      const models = await provider.loadModels()
      expect(models).toHaveLength(2)
      expect(models[0].id).toBe('llama3:latest')
      expect(models[0].provider).toBe('ollama')
      expect(models[0].cost).toEqual({ input: 0, output: 0 })
      expect(models[1].id).toBe('mistral:latest')
    })

    it('returns empty array on empty response', async () => {
      const provider = new OllamaProvider({})
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] }),
      } as unknown as Response)

      const models = await provider.loadModels()
      expect(models).toEqual([])
    })

    it('returns empty array on fetch error', async () => {
      const provider = new OllamaProvider({})
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Connection refused'))

      const models = await provider.loadModels()
      expect(models).toEqual([])
    })

    it('applies modelFilter', async () => {
      const provider = new OllamaProvider({ modelFilter: ['llama3'] })
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            { name: 'llama3:latest', size: 4_000_000_000 },
            { name: 'mistral:latest', size: 3_000_000_000 },
            { name: 'llama3:8b', size: 4_500_000_000 },
          ],
        }),
      } as unknown as Response)

      const models = await provider.loadModels()
      expect(models).toHaveLength(2)
      expect(models.every((m: ModelDef) => m.id.includes('llama3'))).toBe(true)
    })

    it('returns all models when modelFilter is empty', async () => {
      const provider = new OllamaProvider({ modelFilter: [] })
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            { name: 'llama3:latest', size: 4_000_000_000 },
            { name: 'mistral:latest', size: 3_000_000_000 },
          ],
        }),
      } as unknown as Response)

      const models = await provider.loadModels()
      expect(models).toHaveLength(2)
    })
  })

  describe('stream', () => {
    it('streams text chunks from NDJSON response', async () => {
      const provider = new OllamaProvider({})
      const body = makeNDJSONStream([
        { message: { content: 'Hello' }, done: false },
        { message: { content: ' world' }, done: false },
        { message: { content: '' }, done: true },
      ])

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        body,
        text: async () => '',
      } as unknown as Response)

      const chunks: string[] = []
      const gen = provider.stream({
        model: 'llama3:latest',
        messages: [{ role: 'user', content: 'Hi' }],
      })
      let result = await gen.next()
      while (!result.done) {
        chunks.push(result.value)
        result = await gen.next()
      }

      expect(chunks).toEqual(['Hello', ' world'])
      expect(result.value).toBe('Hello world')
    })

    it('throws when not configured', async () => {
      const provider = new OllamaProvider({ baseUrl: '' })
      const gen = provider.stream({
        model: 'llama3:latest',
        messages: [{ role: 'user', content: 'Hi' }],
      })
      await expect(gen.next()).rejects.toThrow('Ollama 서버 URL이 설정되지 않았습니다')
    })

    it('throws on HTTP error', async () => {
      const provider = new OllamaProvider({})
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'model not found',
      } as unknown as Response)

      const gen = provider.stream({
        model: 'nonexistent',
        messages: [{ role: 'user', content: 'Hi' }],
      })
      await expect(gen.next()).rejects.toThrow('model not found')
    })

    it('throws on network error', async () => {
      const provider = new OllamaProvider({})
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Connection refused'))

      const gen = provider.stream({
        model: 'llama3:latest',
        messages: [{ role: 'user', content: 'Hi' }],
      })
      await expect(gen.next()).rejects.toThrow('Connection refused')
    })

    it('passes system prompt and messages correctly', async () => {
      const provider = new OllamaProvider({})
      const body = makeNDJSONStream([
        { message: { content: 'OK' }, done: false },
        { message: { content: '' }, done: true },
      ])
      let capturedBody = ''

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedBody = init?.body as string
        return { ok: true, body, text: async () => '' } as unknown as Response
      })

      const gen = provider.stream({
        model: 'llama3:latest',
        messages: [{ role: 'user', content: 'Hi' }],
        systemPrompt: 'You are helpful',
      })
      while (!(await gen.next()).done) {}

      const parsed = JSON.parse(capturedBody)
      expect(parsed.messages[0]).toEqual({ role: 'system', content: 'You are helpful' })
      expect(parsed.messages[1]).toEqual({ role: 'user', content: 'Hi' })
      expect(parsed.stream).toBe(true)
    })

    it('throws when response body is null', async () => {
      const provider = new OllamaProvider({})
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        body: null,
        text: async () => '',
      } as unknown as Response)

      const gen = provider.stream({
        model: 'llama3:latest',
        messages: [{ role: 'user', content: 'Hi' }],
      })
      await expect(gen.next()).rejects.toThrow('응답 스트림이 없습니다')
    })
  })

  describe('testConnection', () => {
    it('returns true on successful response', async () => {
      const provider = new OllamaProvider({})
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] }),
      } as unknown as Response)
      expect(await provider.testConnection()).toBe(true)
    })

    it('returns false on network error', async () => {
      const provider = new OllamaProvider({})
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Connection refused'))
      expect(await provider.testConnection()).toBe(false)
    })

    it('returns false when not configured', async () => {
      const provider = new OllamaProvider({ baseUrl: '' })
      expect(await provider.testConnection()).toBe(false)
    })
  })
})
