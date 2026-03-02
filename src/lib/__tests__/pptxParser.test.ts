import { describe, it, expect, vi } from 'vitest'
import {
  parsePptx,
  extractPptxChunks,
  rebuildPptx,
  splitChunkToSlideTexts,
  PptxParseError,
} from '../pptxParser'

// --- Helper: create a minimal PPTX file using JSZip ---

async function createMinimalPptx(slides: string[][] = [['Hello', 'World']]): Promise<File> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()

  // [Content_Types].xml
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
</Types>`)

  // Create slide XMLs
  for (let i = 0; i < slides.length; i++) {
    const texts = slides[i].map((t) => `<a:r><a:t>${t}</a:t></a:r>`).join('')
    zip.file(`ppt/slides/slide${i + 1}.xml`, `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody><a:p>${texts}</a:p></p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>`)
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  return new File([blob], 'test.pptx', {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  })
}

// --- parsePptx ---

describe('parsePptx', () => {
  it('유효한 PPTX에서 슬라이드 파싱', async () => {
    const file = await createMinimalPptx([['Hello', 'World']])
    const result = await parsePptx(file)

    expect(result.slides).toHaveLength(1)
    expect(result.slides[0].index).toBe(0)
    expect(result.slides[0].texts).toEqual(['Hello', 'World'])
    expect(result.slides[0].xmlPath).toBe('ppt/slides/slide1.xml')
    expect(result.zip).toBeTruthy()
  })

  it('여러 슬라이드 파싱', async () => {
    const file = await createMinimalPptx([
      ['Slide 1 Title', 'Slide 1 Body'],
      ['Slide 2 Title'],
      ['Slide 3 Title', 'Slide 3 A', 'Slide 3 B'],
    ])
    const result = await parsePptx(file)

    expect(result.slides).toHaveLength(3)
    expect(result.slides[0].texts).toEqual(['Slide 1 Title', 'Slide 1 Body'])
    expect(result.slides[1].texts).toEqual(['Slide 2 Title'])
    expect(result.slides[2].texts).toEqual(['Slide 3 Title', 'Slide 3 A', 'Slide 3 B'])
  })

  it('슬라이드 인덱스 순서 정렬', async () => {
    const file = await createMinimalPptx([['A'], ['B'], ['C']])
    const result = await parsePptx(file)

    expect(result.slides.map((s) => s.index)).toEqual([0, 1, 2])
  })

  it('빈 텍스트는 제외', async () => {
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
    zip.file('ppt/slides/slide1.xml', `<?xml version="1.0"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody>
    <a:p><a:r><a:t>Hello</a:t></a:r></a:p>
    <a:p><a:r><a:t>  </a:t></a:r></a:p>
    <a:p><a:r><a:t></a:t></a:r></a:p>
    <a:p><a:r><a:t>World</a:t></a:r></a:p>
  </p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>`)
    const blob = await zip.generateAsync({ type: 'blob' })
    const file = new File([blob], 'test.pptx')

    const result = await parsePptx(file)
    expect(result.slides[0].texts).toEqual(['Hello', 'World'])
  })

  it('잘못된 ZIP 파일 에러', async () => {
    const file = new File(['not a zip'], 'bad.pptx')
    await expect(parsePptx(file)).rejects.toThrow(PptxParseError)
    await expect(parsePptx(file)).rejects.toThrow('unable to open as ZIP archive')
  })

  it('[Content_Types].xml 없으면 에러', async () => {
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    zip.file('ppt/slides/slide1.xml', '<p:sld/>')
    const blob = await zip.generateAsync({ type: 'blob' })
    const file = new File([blob], 'bad.pptx')

    await expect(parsePptx(file)).rejects.toThrow(PptxParseError)
    await expect(parsePptx(file)).rejects.toThrow('[Content_Types].xml')
  })

  it('슬라이드 없으면 에러', async () => {
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
    zip.file('ppt/other.xml', '<data/>')
    const blob = await zip.generateAsync({ type: 'blob' })
    const file = new File([blob], 'noslides.pptx')

    await expect(parsePptx(file)).rejects.toThrow(PptxParseError)
    await expect(parsePptx(file)).rejects.toThrow('No slides found')
  })

  it('PptxParseError 인스턴스 검증', () => {
    const err = new PptxParseError('test error')
    expect(err.name).toBe('PptxParseError')
    expect(err.message).toBe('test error')
    expect(err).toBeInstanceOf(Error)
  })
})

// --- extractPptxChunks ---

describe('extractPptxChunks', () => {
  it('슬라이드 텍스트를 청크로 변환', async () => {
    const file = await createMinimalPptx([
      ['Hello', 'World'],
      ['Slide 2'],
    ])
    const parsed = await parsePptx(file)
    const chunks = extractPptxChunks(parsed)

    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toBe('Hello\nWorld')
    expect(chunks[1]).toBe('Slide 2')
  })

  it('빈 슬라이드는 제외', async () => {
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
    zip.file('ppt/slides/slide1.xml', `<?xml version="1.0"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Has text</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>`)
    zip.file('ppt/slides/slide2.xml', `<?xml version="1.0"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree></p:spTree></p:cSld>
</p:sld>`)
    const blob = await zip.generateAsync({ type: 'blob' })
    const file = new File([blob], 'test.pptx')

    const parsed = await parsePptx(file)
    const chunks = extractPptxChunks(parsed)

    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toBe('Has text')
  })

  it('텍스트 없는 PPTX는 빈 배열', async () => {
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
    zip.file('ppt/slides/slide1.xml', `<?xml version="1.0"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree></p:spTree></p:cSld>
</p:sld>`)
    const blob = await zip.generateAsync({ type: 'blob' })
    const file = new File([blob], 'empty.pptx')

    const parsed = await parsePptx(file)
    const chunks = extractPptxChunks(parsed)
    expect(chunks).toEqual([])
  })
})

// --- rebuildPptx ---

describe('rebuildPptx', () => {
  it('번역된 텍스트로 PPTX 재조립', async () => {
    const file = await createMinimalPptx([['Hello', 'World']])
    const parsed = await parsePptx(file)

    const translatedSlides = [{
      ...parsed.slides[0],
      texts: ['안녕하세요', '세계'],
    }]

    const blob = await rebuildPptx(parsed, translatedSlides)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)

    // Verify by re-parsing
    const rebuiltFile = new File([blob], 'rebuilt.pptx')
    const reparsed = await parsePptx(rebuiltFile)
    expect(reparsed.slides[0].texts).toEqual(['안녕하세요', '세계'])
  })

  it('여러 슬라이드 재조립', async () => {
    const file = await createMinimalPptx([['A', 'B'], ['C']])
    const parsed = await parsePptx(file)

    const translatedSlides = [
      { ...parsed.slides[0], texts: ['가', '나'] },
      { ...parsed.slides[1], texts: ['다'] },
    ]

    const blob = await rebuildPptx(parsed, translatedSlides)
    const rebuiltFile = new File([blob], 'rebuilt.pptx')
    const reparsed = await parsePptx(rebuiltFile)

    expect(reparsed.slides[0].texts).toEqual(['가', '나'])
    expect(reparsed.slides[1].texts).toEqual(['다'])
  })

  it('번역 텍스트가 부족하면 원본 유지', async () => {
    const file = await createMinimalPptx([['Hello', 'World', 'Extra']])
    const parsed = await parsePptx(file)

    // Only provide 1 translated text (original has 3)
    const translatedSlides = [{
      ...parsed.slides[0],
      texts: ['안녕'],
    }]

    const blob = await rebuildPptx(parsed, translatedSlides)
    const rebuiltFile = new File([blob], 'rebuilt.pptx')
    const reparsed = await parsePptx(rebuiltFile)

    // First text replaced, rest keep original
    expect(reparsed.slides[0].texts[0]).toBe('안녕')
    expect(reparsed.slides[0].texts[1]).toBe('World')
    expect(reparsed.slides[0].texts[2]).toBe('Extra')
  })

  it('Blob의 MIME 타입 확인', async () => {
    const file = await createMinimalPptx([['Test']])
    const parsed = await parsePptx(file)
    const translatedSlides = [{ ...parsed.slides[0], texts: ['테스트'] }]
    const blob = await rebuildPptx(parsed, translatedSlides)

    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation')
  })
})

// --- splitChunkToSlideTexts ---

describe('splitChunkToSlideTexts', () => {
  it('줄바꿈으로 분할', () => {
    expect(splitChunkToSlideTexts('Hello\nWorld')).toEqual(['Hello', 'World'])
  })

  it('빈 줄 제외', () => {
    expect(splitChunkToSlideTexts('Hello\n\n\nWorld')).toEqual(['Hello', 'World'])
  })

  it('공백만 있는 줄 제외', () => {
    expect(splitChunkToSlideTexts('Hello\n   \nWorld')).toEqual(['Hello', 'World'])
  })

  it('단일 텍스트', () => {
    expect(splitChunkToSlideTexts('Hello')).toEqual(['Hello'])
  })

  it('빈 문자열은 빈 배열', () => {
    expect(splitChunkToSlideTexts('')).toEqual([])
  })
})
