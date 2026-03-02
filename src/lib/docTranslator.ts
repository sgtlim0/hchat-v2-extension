// lib/docTranslator.ts — Document translation pipeline orchestrator

export type SupportedFormat = 'txt' | 'xlsx' | 'csv' | 'pptx' | 'pdf'

export interface TranslationProgress {
  current: number
  total: number
  status: 'parsing' | 'translating' | 'building' | 'done' | 'error'
}

export interface TranslationResult {
  blob: Blob
  filename: string
  format: SupportedFormat
}

export class DocTranslateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DocTranslateError'
  }
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const CHUNK_SIZE = 1000 // characters per chunk for TXT/CSV
const COST_PER_1K_TOKENS = 0.003 // rough estimate

export function detectFormat(file: File): SupportedFormat {
  const ext = file.name.toLowerCase().split('.').pop()
  if (ext === 'txt') return 'txt'
  if (ext === 'csv') return 'csv'
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx'
  if (ext === 'pptx' || ext === 'ppt') return 'pptx'
  if (ext === 'pdf') return 'pdf'
  throw new DocTranslateError(`Unsupported format: .${ext ?? ''}`)
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new DocTranslateError('Failed to read file'))
    reader.readAsText(file)
  })
}

function splitTextIntoChunks(text: string, chunkSize: number): string[] {
  const lines = text.split(/\r?\n/)
  const chunks: string[] = []
  let current = ''

  for (const line of lines) {
    if (current.length + line.length + 1 > chunkSize && current.length > 0) {
      chunks.push(current)
      current = line
    } else {
      current = current ? `${current}\n${line}` : line
    }
  }

  if (current.length > 0) {
    chunks.push(current)
  }

  return chunks
}

async function extractTextChunks(file: File): Promise<string[]> {
  const text = await readFileAsText(file)
  return splitTextIntoChunks(text, CHUNK_SIZE)
}

async function extractXlsxChunks(file: File): Promise<string[]> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })

  const chunks: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue

    const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })

    for (const row of jsonData) {
      if (!Array.isArray(row)) continue
      const cellTexts = row
        .map((cell) => String(cell ?? ''))
        .filter((s) => s.trim().length > 0)

      if (cellTexts.length > 0) {
        chunks.push(cellTexts.join('\t'))
      }
    }
  }

  return chunks
}

async function extractPptxChunksFromFile(file: File): Promise<string[]> {
  const { parsePptx, extractPptxChunks } = await import('./pptxParser')
  const parsed = await parsePptx(file)
  return extractPptxChunks(parsed)
}

async function extractPdfChunks(file: File): Promise<string[]> {
  const { extractPdfText } = await import('./pdfParser')
  const text = await extractPdfText(file)
  return splitTextIntoChunks(text, CHUNK_SIZE)
}

export async function extractTexts(
  file: File,
  format: SupportedFormat,
): Promise<string[]> {
  if (file.size > MAX_FILE_SIZE) {
    throw new DocTranslateError(`File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`)
  }

  switch (format) {
    case 'txt':
    case 'csv':
      return extractTextChunks(file)
    case 'xlsx':
      return extractXlsxChunks(file)
    case 'pptx':
      return extractPptxChunksFromFile(file)
    case 'pdf':
      return extractPdfChunks(file)
  }
}

export async function translateChunks(
  chunks: string[],
  sourceLang: string,
  targetLang: string,
  translateFn: (text: string) => Promise<string>,
  onProgress: (p: TranslationProgress) => void,
): Promise<string[]> {
  const total = chunks.length
  const results: string[] = []

  for (let i = 0; i < chunks.length; i++) {
    onProgress({ current: i, total, status: 'translating' })

    try {
      const prompt = buildTranslatePrompt(chunks[i], sourceLang, targetLang)
      const translated = await translateFn(prompt)
      results.push(translated)
    } catch (err) {
      throw new DocTranslateError(
        `Failed to translate chunk ${i + 1}/${total}: ${String(err)}`,
      )
    }
  }

  onProgress({ current: total, total, status: 'translating' })
  return results
}

function buildTranslatePrompt(
  text: string,
  sourceLang: string,
  targetLang: string,
): string {
  const sourceHint = sourceLang === 'auto'
    ? ''
    : ` from ${sourceLang}`
  return [
    `Translate the following text${sourceHint} to ${targetLang}.`,
    'Preserve the original formatting (newlines, tabs, spacing).',
    'Output ONLY the translated text, nothing else.',
    '',
    text,
  ].join('\n')
}

function buildTextOutput(translatedChunks: string[]): Blob {
  return new Blob(
    [translatedChunks.join('\n')],
    { type: 'text/plain;charset=utf-8' },
  )
}

function buildCsvOutput(translatedChunks: string[]): Blob {
  return new Blob(
    [translatedChunks.join('\n')],
    { type: 'text/csv;charset=utf-8' },
  )
}

async function buildPptxOutput(
  translatedChunks: string[],
  originalFile: File,
): Promise<Blob> {
  const { parsePptx, rebuildPptx, splitChunkToSlideTexts } = await import('./pptxParser')
  const parsed = await parsePptx(originalFile)

  // Map translated chunks back to slides (only slides with text)
  const slidesWithText = parsed.slides.filter((s) => s.texts.length > 0)
  const translatedSlides = slidesWithText.map((slide, i) => ({
    ...slide,
    texts: i < translatedChunks.length
      ? splitChunkToSlideTexts(translatedChunks[i])
      : slide.texts,
  }))

  return rebuildPptx(parsed, translatedSlides)
}

function buildPdfMarkdownOutput(translatedChunks: string[]): Blob {
  return new Blob(
    [translatedChunks.join('\n\n')],
    { type: 'text/markdown;charset=utf-8' },
  )
}

async function buildXlsxOutput(
  translatedChunks: string[],
  originalFile: File,
): Promise<Blob> {
  const XLSX = await import('xlsx')
  const buffer = await originalFile.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })

  let chunkIdx = 0

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue

    const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })

    const translatedRows: string[][] = []
    for (const row of jsonData) {
      if (!Array.isArray(row)) {
        translatedRows.push([])
        continue
      }

      const cellTexts = row
        .map((cell) => String(cell ?? ''))
        .filter((s) => s.trim().length > 0)

      if (cellTexts.length > 0 && chunkIdx < translatedChunks.length) {
        const translated = translatedChunks[chunkIdx].split('\t')
        const newRow = row.map((_, colIdx) =>
          colIdx < translated.length ? translated[colIdx] : String(row[colIdx] ?? ''),
        )
        translatedRows.push(newRow)
        chunkIdx++
      } else {
        translatedRows.push(row.map((cell) => String(cell ?? '')))
      }
    }

    const newSheet = XLSX.utils.aoa_to_sheet(translatedRows)
    workbook.Sheets[sheetName] = newSheet
  }

  const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  return new Blob([output], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export async function buildOutput(
  translatedChunks: string[],
  originalFile: File,
  format: SupportedFormat,
): Promise<TranslationResult> {
  const baseName = originalFile.name.replace(/\.[^.]+$/, '')

  let blob: Blob
  let ext: string
  switch (format) {
    case 'txt':
      blob = buildTextOutput(translatedChunks)
      ext = 'txt'
      break
    case 'csv':
      blob = buildCsvOutput(translatedChunks)
      ext = 'csv'
      break
    case 'xlsx':
      blob = await buildXlsxOutput(translatedChunks, originalFile)
      ext = 'xlsx'
      break
    case 'pptx':
      blob = await buildPptxOutput(translatedChunks, originalFile)
      ext = 'pptx'
      break
    case 'pdf':
      // PDF → Markdown output (layout cannot be preserved)
      blob = buildPdfMarkdownOutput(translatedChunks)
      ext = 'md'
      break
  }

  return {
    blob,
    filename: `${baseName}_translated.${ext}`,
    format,
  }
}

export function estimateCost(chunks: string[]): {
  totalChars: number
  estimatedTokens: number
  estimatedCost: number
} {
  const totalChars = chunks.reduce((sum, c) => sum + c.length, 0)
  // Rough estimate: ~4 chars per token, input + output
  const estimatedTokens = Math.ceil(totalChars / 4) * 2
  const estimatedCost = (estimatedTokens / 1000) * COST_PER_1K_TOKENS

  return {
    totalChars,
    estimatedTokens,
    estimatedCost: Math.round(estimatedCost * 1000) / 1000,
  }
}
