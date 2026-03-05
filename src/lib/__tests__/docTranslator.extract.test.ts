import { describe, it, expect } from 'vitest'
import { extractTexts, buildOutput, DocTranslateError } from '../docTranslator'
import type { SupportedFormat } from '../docTranslator'

function makeFile(name: string, content: string, size?: number): File {
  const file = new File([content], name)
  if (size !== undefined) {
    Object.defineProperty(file, 'size', { value: size })
  }
  return file
}

describe('extractTexts', () => {
  it('extracts chunks from txt file', async () => {
    const file = makeFile('test.txt', 'Hello\nWorld\nFoo\nBar')
    const chunks = await extractTexts(file, 'txt')
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks.join('\n')).toContain('Hello')
  })

  it('extracts chunks from csv file', async () => {
    const file = makeFile('test.csv', 'Name,Value\nAlice,10\nBob,20')
    const chunks = await extractTexts(file, 'csv')
    expect(chunks.length).toBeGreaterThan(0)
  })

  it('throws for oversized file', async () => {
    const file = makeFile('big.txt', 'x', 11 * 1024 * 1024)
    await expect(extractTexts(file, 'txt')).rejects.toThrow('10MB')
  })

  it('splits long text into multiple chunks', async () => {
    const longText = Array.from({ length: 100 }, (_, i) => `Line ${i}: ${'x'.repeat(50)}`).join('\n')
    const file = makeFile('long.txt', longText)
    const chunks = await extractTexts(file, 'txt')
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('handles single-line text', async () => {
    const file = makeFile('single.txt', 'Just one line')
    const chunks = await extractTexts(file, 'txt')
    expect(chunks).toEqual(['Just one line'])
  })

  it('handles empty lines', async () => {
    const file = makeFile('empty.txt', '\n\n\nHello\n\nWorld\n\n')
    const chunks = await extractTexts(file, 'txt')
    expect(chunks.join('')).toContain('Hello')
  })
})

describe('buildOutput', () => {
  it('builds txt output', async () => {
    const file = makeFile('doc.txt', 'original')
    const result = await buildOutput(['translated line 1', 'translated line 2'], file, 'txt')
    expect(result.filename).toBe('doc_translated.txt')
    expect(result.format).toBe('txt')
    expect(result.blob.type).toContain('text/plain')
  })

  it('builds csv output', async () => {
    const file = makeFile('data.csv', 'a,b\n1,2')
    const result = await buildOutput(['번역1', '번역2'], file, 'csv')
    expect(result.filename).toBe('data_translated.csv')
    expect(result.format).toBe('csv')
    expect(result.blob.type).toContain('text/csv')
  })

  it('builds pdf markdown output', async () => {
    const file = makeFile('doc.pdf', 'pdf content')
    const result = await buildOutput(['translated'], file, 'pdf')
    expect(result.filename).toBe('doc_translated.md')
    expect(result.format).toBe('pdf')
    expect(result.blob.type).toContain('text/markdown')
  })

  it('preserves base name from original file', async () => {
    const file = makeFile('my-document.txt', 'test')
    const result = await buildOutput(['translated'], file, 'txt')
    expect(result.filename).toBe('my-document_translated.txt')
  })
})
