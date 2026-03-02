// lib/pptxParser.ts — PPTX extraction and rebuild using JSZip + DOMParser

export interface PptxSlide {
  index: number
  texts: string[]
  xmlPath: string
}

export interface PptxParseResult {
  slides: PptxSlide[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  zip: any // JSZip instance
}

export class PptxParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PptxParseError'
  }
}

/**
 * Parse a PPTX file and extract text from each slide.
 * PPTX is a ZIP archive containing XML files under ppt/slides/.
 */
export async function parsePptx(file: File): Promise<PptxParseResult> {
  const JSZip = (await import('jszip')).default
  const buffer = await file.arrayBuffer()

  let zip
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch {
    throw new PptxParseError('Invalid PPTX file: unable to open as ZIP archive')
  }

  // Validate it's a PPTX (check for [Content_Types].xml and ppt/ directory)
  if (!zip.file('[Content_Types].xml')) {
    throw new PptxParseError('Invalid PPTX file: missing [Content_Types].xml')
  }

  // Collect slide XML paths sorted numerically
  const slidePaths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] ?? '0', 10)
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] ?? '0', 10)
      return numA - numB
    })

  if (slidePaths.length === 0) {
    throw new PptxParseError('No slides found in PPTX file')
  }

  const parser = new DOMParser()
  const slides: PptxSlide[] = []

  for (let i = 0; i < slidePaths.length; i++) {
    const xmlPath = slidePaths[i]
    const xmlContent = await zip.file(xmlPath)!.async('string')
    const doc = parser.parseFromString(xmlContent, 'application/xml')

    // Extract all <a:t> text nodes (PowerPoint text elements)
    const textNodes = doc.getElementsByTagNameNS(
      'http://schemas.openxmlformats.org/drawingml/2006/main',
      't',
    )

    const texts: string[] = []
    for (let j = 0; j < textNodes.length; j++) {
      const text = textNodes[j].textContent ?? ''
      if (text.trim().length > 0) {
        texts.push(text)
      }
    }

    slides.push({ index: i, texts, xmlPath })
  }

  return { slides, zip }
}

/**
 * Extract text chunks from parsed PPTX for translation.
 * Each slide's texts are joined into a single chunk (preserving slide boundaries).
 */
export function extractPptxChunks(parsed: PptxParseResult): string[] {
  return parsed.slides
    .filter((slide) => slide.texts.length > 0)
    .map((slide) => slide.texts.join('\n'))
}

/**
 * Rebuild a PPTX file with translated text.
 * Replaces <a:t> text nodes in each slide XML with translated content.
 */
export async function rebuildPptx(
  original: PptxParseResult,
  translatedSlides: PptxSlide[],
): Promise<Blob> {
  const parser = new DOMParser()
  const serializer = new XMLSerializer()

  for (const translated of translatedSlides) {
    const xmlPath = translated.xmlPath
    const xmlContent = await original.zip.file(xmlPath)!.async('string')
    const doc = parser.parseFromString(xmlContent, 'application/xml')

    const textNodes = doc.getElementsByTagNameNS(
      'http://schemas.openxmlformats.org/drawingml/2006/main',
      't',
    )

    // Map translated texts back to <a:t> nodes (only non-empty ones)
    let translatedIdx = 0
    for (let j = 0; j < textNodes.length; j++) {
      const originalText = textNodes[j].textContent ?? ''
      if (originalText.trim().length > 0 && translatedIdx < translated.texts.length) {
        textNodes[j].textContent = translated.texts[translatedIdx]
        translatedIdx++
      }
    }

    const updatedXml = serializer.serializeToString(doc)
    original.zip.file(xmlPath, updatedXml)
  }

  const blob: Blob = await original.zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  })

  return blob
}

/**
 * Split translated chunk text back into individual slide texts.
 * Each chunk corresponds to one slide, with texts joined by newlines.
 */
export function splitChunkToSlideTexts(chunk: string): string[] {
  return chunk.split('\n').filter((t) => t.trim().length > 0)
}
