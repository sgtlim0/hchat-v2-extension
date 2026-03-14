import { describe, it, expect } from 'vitest'
import { readSSEStream } from '../sse-parser'

function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
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

function openaiExtract(p: unknown): string | undefined {
  const obj = p as { choices?: Array<{ delta?: { content?: string } }> }
  return obj?.choices?.[0]?.delta?.content
}

function geminiExtract(p: unknown): string | undefined {
  const obj = p as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  return obj?.candidates?.[0]?.content?.parts?.[0]?.text
}

async function collectChunks(gen: AsyncGenerator<string, string>): Promise<{ chunks: string[]; result: string }> {
  const chunks: string[] = []
  let res = await gen.next()
  while (!res.done) {
    chunks.push(res.value)
    res = await gen.next()
  }
  return { chunks, result: res.value }
}

describe('readSSEStream', () => {
  describe('normal SSE stream', () => {
    it('yields content from multiple chunks', async () => {
      const body = makeStream([
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      ])
      const { chunks, result } = await collectChunks(readSSEStream(body, openaiExtract))
      expect(chunks).toEqual(['Hello', ' world'])
      expect(result).toBe('Hello world')
    })

    it('yields Gemini-format content correctly', async () => {
      const body = makeStream([
        'data: {"candidates":[{"content":{"parts":[{"text":"Hi"}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":" there"}]}}]}\n\n',
      ])
      const { chunks, result } = await collectChunks(readSSEStream(body, geminiExtract))
      expect(chunks).toEqual(['Hi', ' there'])
      expect(result).toBe('Hi there')
    })

    it('returns full concatenated text', async () => {
      const body = makeStream([
        'data: {"choices":[{"delta":{"content":"a"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"b"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"c"}}]}\n\n',
      ])
      const { result } = await collectChunks(readSSEStream(body, openaiExtract))
      expect(result).toBe('abc')
    })
  })

  describe('partial chunk / split across reads', () => {
    it('handles data split across two reads', async () => {
      const body = makeStream([
        'data: {"choices":[{"delta":{"con',
        'tent":"Hello"}}]}\n\n',
      ])
      const { chunks, result } = await collectChunks(readSSEStream(body, openaiExtract))
      expect(chunks).toEqual(['Hello'])
      expect(result).toBe('Hello')
    })

    it('handles line split at newline boundary', async () => {
      const body = makeStream([
        'data: {"choices":[{"delta":{"content":"A"}}]}\n',
        '\ndata: {"choices":[{"delta":{"content":"B"}}]}\n\n',
      ])
      const { chunks, result } = await collectChunks(readSSEStream(body, openaiExtract))
      expect(chunks).toEqual(['A', 'B'])
      expect(result).toBe('AB')
    })

    it('handles multiple SSE events in a single chunk', async () => {
      const body = makeStream([
        'data: {"choices":[{"delta":{"content":"X"}}]}\n\ndata: {"choices":[{"delta":{"content":"Y"}}]}\n\n',
      ])
      const { chunks, result } = await collectChunks(readSSEStream(body, openaiExtract))
      expect(chunks).toEqual(['X', 'Y'])
      expect(result).toBe('XY')
    })
  })

  describe('[DONE] signal handling', () => {
    it('skips [DONE] when hasDoneSignal is true', async () => {
      const body = makeStream([
        'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
        'data: [DONE]\n\n',
      ])
      const { chunks } = await collectChunks(readSSEStream(body, openaiExtract, { hasDoneSignal: true }))
      expect(chunks).toEqual(['Hi'])
    })

    it('tries to parse [DONE] as JSON when hasDoneSignal is false', async () => {
      const body = makeStream([
        'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
        'data: [DONE]\n\n',
      ])
      // Without hasDoneSignal, [DONE] is NOT skipped — it fails JSON.parse and is silently ignored
      const { chunks } = await collectChunks(readSSEStream(body, openaiExtract))
      expect(chunks).toEqual(['Hi'])
    })

    it('does not skip [DONE] when hasDoneSignal is not set (default)', async () => {
      const body = makeStream([
        'data: [DONE]\n\n',
      ])
      const { chunks, result } = await collectChunks(readSSEStream(body, openaiExtract))
      expect(chunks).toEqual([])
      expect(result).toBe('')
    })
  })

  describe('invalid JSON handling', () => {
    it('skips invalid JSON lines silently', async () => {
      const body = makeStream([
        'data: not-json\n\n',
        'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
      ])
      const { chunks } = await collectChunks(readSSEStream(body, openaiExtract))
      expect(chunks).toEqual(['ok'])
    })

    it('skips truncated JSON', async () => {
      const body = makeStream([
        'data: {"choices":[{"delta":\n\n',
        'data: {"choices":[{"delta":{"content":"valid"}}]}\n\n',
      ])
      const { chunks } = await collectChunks(readSSEStream(body, openaiExtract))
      expect(chunks).toEqual(['valid'])
    })
  })

  describe('empty and edge cases', () => {
    it('handles empty stream', async () => {
      const body = makeStream([])
      const { chunks, result } = await collectChunks(readSSEStream(body, openaiExtract))
      expect(chunks).toEqual([])
      expect(result).toBe('')
    })

    it('skips empty lines', async () => {
      const body = makeStream([
        '\n\n\n',
        'data: {"choices":[{"delta":{"content":"after-empty"}}]}\n\n',
      ])
      const { chunks } = await collectChunks(readSSEStream(body, openaiExtract))
      expect(chunks).toEqual(['after-empty'])
    })

    it('skips lines not starting with data:', async () => {
      const body = makeStream([
        'event: message\n',
        'id: 123\n',
        'data: {"choices":[{"delta":{"content":"content"}}]}\n\n',
      ])
      const { chunks } = await collectChunks(readSSEStream(body, openaiExtract))
      expect(chunks).toEqual(['content'])
    })

    it('skips entries where extractContent returns undefined', async () => {
      const body = makeStream([
        'data: {"choices":[{"delta":{}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"real"}}]}\n\n',
      ])
      const { chunks } = await collectChunks(readSSEStream(body, openaiExtract))
      expect(chunks).toEqual(['real'])
    })

    it('skips entries where extractContent returns empty string', async () => {
      const body = makeStream([
        'data: {"choices":[{"delta":{"content":""}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"data"}}]}\n\n',
      ])
      const { chunks } = await collectChunks(readSSEStream(body, openaiExtract))
      expect(chunks).toEqual(['data'])
    })
  })

  describe('large chunks', () => {
    it('handles large payloads', async () => {
      const bigText = 'x'.repeat(10000)
      const body = makeStream([
        `data: {"choices":[{"delta":{"content":"${bigText}"}}]}\n\n`,
      ])
      const { chunks, result } = await collectChunks(readSSEStream(body, openaiExtract))
      expect(chunks).toEqual([bigText])
      expect(result).toBe(bigText)
    })

    it('handles many small chunks', async () => {
      const events = Array.from({ length: 100 }, (_, i) =>
        `data: {"choices":[{"delta":{"content":"${i}"}}]}\n\n`
      )
      const body = makeStream(events)
      const { chunks, result } = await collectChunks(readSSEStream(body, openaiExtract))
      expect(chunks.length).toBe(100)
      expect(result).toBe(Array.from({ length: 100 }, (_, i) => `${i}`).join(''))
    })
  })

  describe('reader error handling', () => {
    it('releases reader lock on error', async () => {
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.error(new Error('network failure'))
        },
      })

      const gen = readSSEStream(body, openaiExtract)
      await expect(gen.next()).rejects.toThrow('network failure')
      // After error, releaseLock should have been called in finally block.
      // Verify by successfully acquiring a new reader (throws if still locked).
      const reader = body.getReader()
      reader.releaseLock()
    })

    it('releases reader lock on normal completion', async () => {
      const body = makeStream([
        'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
      ])
      await collectChunks(readSSEStream(body, openaiExtract))
      // Should not throw — reader is unlocked
      const reader = body.getReader()
      reader.releaseLock()
    })
  })

  describe('buffer handling with incomplete lines', () => {
    it('buffers incomplete line until next chunk completes it', async () => {
      const body = makeStream([
        'data: {"choices":[{"delta":{"content":"part1"}}]}',
        '\n\ndata: {"choices":[{"delta":{"content":"part2"}}]}\n\n',
      ])
      const { chunks } = await collectChunks(readSSEStream(body, openaiExtract))
      expect(chunks).toEqual(['part1', 'part2'])
    })

    it('discards incomplete trailing buffer at stream end', async () => {
      const body = makeStream([
        'data: {"choices":[{"delta":{"content":"first"}}]}\n\n',
        'data: {"choices":[{"delta":{"con',  // incomplete, never finished
      ])
      const { chunks, result } = await collectChunks(readSSEStream(body, openaiExtract))
      expect(chunks).toEqual(['first'])
      expect(result).toBe('first')
    })

    it('handles data prefix split across chunks', async () => {
      const body = makeStream([
        'dat',
        'a: {"choices":[{"delta":{"content":"split-prefix"}}]}\n\n',
      ])
      const { chunks } = await collectChunks(readSSEStream(body, openaiExtract))
      expect(chunks).toEqual(['split-prefix'])
    })
  })

  describe('custom extractContent', () => {
    it('works with arbitrary extraction logic', async () => {
      const body = makeStream([
        'data: {"result":"custom-value"}\n\n',
      ])
      const extract = (p: unknown) => (p as { result?: string })?.result
      const { chunks } = await collectChunks(readSSEStream(body, extract))
      expect(chunks).toEqual(['custom-value'])
    })

    it('handles extractContent that throws', async () => {
      const body = makeStream([
        'data: {"valid":true}\n\n',
        'data: {"valid":true}\n\n',
      ])
      let callCount = 0
      const extract = (_p: unknown): string | undefined => {
        callCount++
        if (callCount === 1) throw new Error('extract error')
        return 'recovered'
      }
      // The JSON.parse succeeds but extractContent throws — caught in the inner try/catch
      const { chunks } = await collectChunks(readSSEStream(body, extract))
      expect(chunks).toEqual(['recovered'])
    })
  })
})
