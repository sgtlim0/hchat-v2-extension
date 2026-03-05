import { describe, it, expect, vi } from 'vitest'
import { detectFormat, translateChunks, estimateCost, DocTranslateError } from '../docTranslator'
import type { TranslationProgress } from '../docTranslator'

function makeFile(name: string, content = 'test', size?: number): File {
  const file = new File([content], name)
  if (size !== undefined) {
    Object.defineProperty(file, 'size', { value: size })
  }
  return file
}

describe('detectFormat', () => {
  it('detects txt', () => expect(detectFormat(makeFile('doc.txt'))).toBe('txt'))
  it('detects csv', () => expect(detectFormat(makeFile('data.csv'))).toBe('csv'))
  it('detects xlsx', () => expect(detectFormat(makeFile('sheet.xlsx'))).toBe('xlsx'))
  it('detects xls', () => expect(detectFormat(makeFile('old.xls'))).toBe('xlsx'))
  it('detects pptx', () => expect(detectFormat(makeFile('slides.pptx'))).toBe('pptx'))
  it('detects ppt', () => expect(detectFormat(makeFile('old.ppt'))).toBe('pptx'))
  it('detects pdf', () => expect(detectFormat(makeFile('doc.pdf'))).toBe('pdf'))

  it('throws for unsupported format', () => {
    expect(() => detectFormat(makeFile('doc.docx'))).toThrow('Unsupported format: .docx')
  })

  it('throws for no extension', () => {
    expect(() => detectFormat(makeFile('noext'))).toThrow('Unsupported format')
  })
})

describe('translateChunks', () => {
  it('translates all chunks sequentially', async () => {
    const translateFn = vi.fn(async (text: string) => `translated: ${text}`)
    const onProgress = vi.fn()
    const chunks = ['hello', 'world']

    const result = await translateChunks(chunks, 'en', 'ko', translateFn, onProgress)

    expect(result.cancelled).toBe(false)
    expect(result.translated).toHaveLength(2)
    expect(result.translated[0]).toContain('translated')
    expect(translateFn).toHaveBeenCalledTimes(2)
    // Progress called for each chunk + final
    expect(onProgress).toHaveBeenCalledTimes(3)
  })

  it('stops and returns partial results when signal is aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    const translateFn = vi.fn(async (text: string) => text)
    const onProgress = vi.fn()

    const result = await translateChunks(['a', 'b'], 'en', 'ko', translateFn, onProgress, controller.signal)

    expect(result.cancelled).toBe(true)
    expect(result.translated).toHaveLength(0)
    expect(translateFn).not.toHaveBeenCalled()
  })

  it('aborts mid-translation', async () => {
    const controller = new AbortController()
    let callCount = 0
    const translateFn = vi.fn(async (text: string) => {
      callCount++
      if (callCount === 1) controller.abort()
      return text
    })
    const onProgress = vi.fn()

    const result = await translateChunks(['a', 'b', 'c'], 'en', 'ko', translateFn, onProgress, controller.signal)

    expect(result.cancelled).toBe(true)
    expect(result.translated).toHaveLength(1)
  })

  it('throws DocTranslateError on translation failure', async () => {
    const translateFn = vi.fn(async () => { throw new Error('API error') })
    const onProgress = vi.fn()

    await expect(
      translateChunks(['chunk1'], 'en', 'ko', translateFn, onProgress)
    ).rejects.toThrow('Failed to translate chunk 1/1')
  })

  it('builds correct prompt with auto source lang', async () => {
    let capturedPrompt = ''
    const translateFn = vi.fn(async (text: string) => { capturedPrompt = text; return 'done' })
    const onProgress = vi.fn()

    await translateChunks(['hello'], 'auto', 'ko', translateFn, onProgress)

    expect(capturedPrompt).toContain('to ko')
    expect(capturedPrompt).not.toContain('from auto')
  })

  it('includes source lang in prompt when specified', async () => {
    let capturedPrompt = ''
    const translateFn = vi.fn(async (text: string) => { capturedPrompt = text; return 'done' })
    const onProgress = vi.fn()

    await translateChunks(['hello'], 'en', 'ko', translateFn, onProgress)

    expect(capturedPrompt).toContain('from en')
    expect(capturedPrompt).toContain('to ko')
  })
})

describe('estimateCost', () => {
  it('calculates cost for empty chunks', () => {
    const result = estimateCost([])
    expect(result.totalChars).toBe(0)
    expect(result.estimatedTokens).toBe(0)
    expect(result.estimatedCost).toBe(0)
  })

  it('calculates cost for text chunks', () => {
    const result = estimateCost(['hello world', 'foo bar baz'])
    expect(result.totalChars).toBe(22)
    expect(result.estimatedTokens).toBeGreaterThan(0)
    expect(result.estimatedCost).toBeGreaterThanOrEqual(0)
  })

  it('rounds cost to 3 decimal places', () => {
    const result = estimateCost(['a'.repeat(1000)])
    expect(String(result.estimatedCost).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(3)
  })
})

describe('DocTranslateError', () => {
  it('has correct name and message', () => {
    const err = new DocTranslateError('test error')
    expect(err.name).toBe('DocTranslateError')
    expect(err.message).toBe('test error')
    expect(err).toBeInstanceOf(Error)
  })
})
