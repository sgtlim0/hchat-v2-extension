import { describe, it, expect, vi } from 'vitest'

vi.mock('xlsx', () => ({
  read: vi.fn(() => ({
    SheetNames: ['Sheet1'],
    Sheets: { Sheet1: {} },
  })),
  utils: {
    sheet_to_json: vi.fn(() => [['a', 'b'], ['c', 'd']]),
    aoa_to_sheet: vi.fn(() => ({})),
  },
  write: vi.fn(() => new Uint8Array([1, 2, 3])),
}))

vi.mock('../pptxParser', () => ({
  parsePptx: vi.fn(async () => ({
    slides: [{ texts: ['slide text'] }],
    raw: new Uint8Array(),
  })),
  rebuildPptx: vi.fn(async () => new Blob(['pptx'])),
  extractPptxChunks: vi.fn(() => ['slide text']),
  splitChunkToSlideTexts: vi.fn((text: string) => [text]),
}))

vi.mock('../pdfParser', () => ({
  extractPdfText: vi.fn(async () => 'PDF extracted text content'),
}))

import { extractTexts, buildOutput } from '../docTranslator'

function makeFile(name: string, content: string): File {
  return new File([content], name)
}

describe('buildOutput — xlsx', () => {
  it('builds xlsx output with translated chunks', async () => {
    const file = makeFile('sheet.xlsx', 'dummy')
    const result = await buildOutput(['번역A\t번역B', '번역C\t번역D'], file, 'xlsx')

    expect(result.filename).toBe('sheet_translated.xlsx')
    expect(result.format).toBe('xlsx')
    expect(result.blob.type).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
  })

  it('returns blob with content from XLSX.write', async () => {
    const file = makeFile('data.xlsx', 'dummy')
    const result = await buildOutput(['translated'], file, 'xlsx')

    expect(result.blob.size).toBeGreaterThan(0)
  })
})

describe('buildOutput — pptx', () => {
  it('builds pptx output with translated chunks', async () => {
    const file = makeFile('slides.pptx', 'dummy')
    const result = await buildOutput(['translated slide'], file, 'pptx')

    expect(result.filename).toBe('slides_translated.pptx')
    expect(result.format).toBe('pptx')
    expect(result.blob.size).toBeGreaterThan(0)
  })

  it('preserves base name for pptx', async () => {
    const file = makeFile('my-presentation.pptx', 'dummy')
    const result = await buildOutput(['text'], file, 'pptx')

    expect(result.filename).toBe('my-presentation_translated.pptx')
  })
})

describe('extractTexts — xlsx', () => {
  it('extracts text chunks from xlsx file', async () => {
    const file = makeFile('sheet.xlsx', 'dummy')
    const chunks = await extractTexts(file, 'xlsx')

    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0]).toContain('a')
  })
})

describe('extractTexts — pptx', () => {
  it('extracts text chunks from pptx file', async () => {
    const file = makeFile('slides.pptx', 'dummy')
    const chunks = await extractTexts(file, 'pptx')

    expect(chunks).toEqual(['slide text'])
  })
})

describe('extractTexts — pdf', () => {
  it('extracts text chunks from pdf file', async () => {
    const file = makeFile('doc.pdf', 'dummy')
    const chunks = await extractTexts(file, 'pdf')

    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks.join(' ')).toContain('PDF extracted text content')
  })
})
