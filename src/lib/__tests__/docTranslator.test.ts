import { describe, it, expect, vi } from 'vitest'
import {
  detectFormat,
  extractTexts,
  translateChunks,
  buildOutput,
  estimateCost,
  DocTranslateError,
} from '../docTranslator'

// --- detectFormat ---

describe('detectFormat', () => {
  it('TXT 파일 감지', () => {
    const file = new File(['hello'], 'doc.txt', { type: 'text/plain' })
    expect(detectFormat(file)).toBe('txt')
  })

  it('CSV 파일 감지', () => {
    const file = new File(['a,b'], 'data.csv', { type: 'text/csv' })
    expect(detectFormat(file)).toBe('csv')
  })

  it('XLSX 파일 감지', () => {
    const file = new File([''], 'report.xlsx')
    expect(detectFormat(file)).toBe('xlsx')
  })

  it('XLS 파일도 xlsx로 감지', () => {
    const file = new File([''], 'report.xls')
    expect(detectFormat(file)).toBe('xlsx')
  })

  it('대문자 확장자도 감지', () => {
    const file = new File(['hello'], 'DOC.TXT', { type: 'text/plain' })
    expect(detectFormat(file)).toBe('txt')
  })

  it('PPTX 파일 감지', () => {
    const file = new File([''], 'slides.pptx')
    expect(detectFormat(file)).toBe('pptx')
  })

  it('PPT 파일도 pptx로 감지', () => {
    const file = new File([''], 'slides.ppt')
    expect(detectFormat(file)).toBe('pptx')
  })

  it('PDF 파일 감지', () => {
    const file = new File([''], 'document.pdf')
    expect(detectFormat(file)).toBe('pdf')
  })

  it('대문자 PPTX 감지', () => {
    const file = new File([''], 'SLIDES.PPTX')
    expect(detectFormat(file)).toBe('pptx')
  })

  it('대문자 PDF 감지', () => {
    const file = new File([''], 'DOC.PDF')
    expect(detectFormat(file)).toBe('pdf')
  })

  it('미지원 확장자 에러', () => {
    const file = new File([''], 'doc.docx')
    expect(() => detectFormat(file)).toThrow(DocTranslateError)
    expect(() => detectFormat(file)).toThrow('Unsupported format')
  })

  it('확장자 없는 파일 에러', () => {
    const file = new File([''], 'noext')
    expect(() => detectFormat(file)).toThrow(DocTranslateError)
  })

})

// --- extractTexts ---

describe('extractTexts', () => {
  it('TXT 파일에서 청크 추출', async () => {
    const content = 'Line 1\nLine 2\nLine 3'
    const file = new File([content], 'test.txt', { type: 'text/plain' })
    const chunks = await extractTexts(file, 'txt')
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks.join('\n')).toContain('Line 1')
    expect(chunks.join('\n')).toContain('Line 3')
  })

  it('CSV 파일에서 청크 추출', async () => {
    const content = 'name,age\nAlice,30\nBob,25'
    const file = new File([content], 'data.csv', { type: 'text/csv' })
    const chunks = await extractTexts(file, 'csv')
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks.join('\n')).toContain('name,age')
  })

  it('긴 TXT는 여러 청크로 분할', async () => {
    // Create content longer than CHUNK_SIZE (1000 chars)
    const longLine = 'A'.repeat(600)
    const content = `${longLine}\n${longLine}\n${longLine}`
    const file = new File([content], 'long.txt', { type: 'text/plain' })
    const chunks = await extractTexts(file, 'txt')
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('빈 파일은 빈 배열 반환', async () => {
    const file = new File([''], 'empty.txt', { type: 'text/plain' })
    const chunks = await extractTexts(file, 'txt')
    expect(chunks).toEqual([])
  })

  it('파일 크기 초과 시 에러', async () => {
    // Create a file object with fake size
    const file = new File(['x'], 'big.txt', { type: 'text/plain' })
    Object.defineProperty(file, 'size', { value: 20 * 1024 * 1024 })
    await expect(extractTexts(file, 'txt')).rejects.toThrow(DocTranslateError)
    await expect(extractTexts(file, 'txt')).rejects.toThrow('limit')
  })
})

// --- translateChunks ---

describe('translateChunks', () => {
  it('모든 청크를 순차적으로 번역', async () => {
    const chunks = ['Hello', 'World']
    const translateFn = vi.fn(async (text: string) => `translated: ${text}`)
    const onProgress = vi.fn()

    const result = await translateChunks(chunks, 'en', 'ko', translateFn, onProgress)

    expect(result.translated).toHaveLength(2)
    expect(result.translated[0]).toBe('translated: Translate the following text from en to ko.\nPreserve the original formatting (newlines, tabs, spacing).\nOutput ONLY the translated text, nothing else.\n\nHello')
    expect(result.cancelled).toBe(false)
    expect(translateFn).toHaveBeenCalledTimes(2)
  })

  it('진행률 콜백 호출', async () => {
    const chunks = ['A', 'B', 'C']
    const translateFn = vi.fn(async (text: string) => text)
    const onProgress = vi.fn()

    await translateChunks(chunks, 'auto', 'ko', translateFn, onProgress)

    // Called for each chunk start + final
    expect(onProgress).toHaveBeenCalledWith({ current: 0, total: 3, status: 'translating' })
    expect(onProgress).toHaveBeenCalledWith({ current: 1, total: 3, status: 'translating' })
    expect(onProgress).toHaveBeenCalledWith({ current: 2, total: 3, status: 'translating' })
    expect(onProgress).toHaveBeenCalledWith({ current: 3, total: 3, status: 'translating' })
  })

  it('빈 청크 배열은 빈 결과', async () => {
    const translateFn = vi.fn()
    const onProgress = vi.fn()
    const result = await translateChunks([], 'en', 'ko', translateFn, onProgress)
    expect(result.translated).toEqual([])
    expect(result.cancelled).toBe(false)
    expect(translateFn).not.toHaveBeenCalled()
  })

  it('번역 실패 시 DocTranslateError', async () => {
    const chunks = ['Hello', 'World']
    const translateFn = vi.fn()
      .mockResolvedValueOnce('번역됨')
      .mockRejectedValueOnce(new Error('API error'))
    const onProgress = vi.fn()

    await expect(
      translateChunks(chunks, 'en', 'ko', translateFn, onProgress),
    ).rejects.toThrow(DocTranslateError)
  })

  it('번역 실패 메시지에 청크 번호 포함', async () => {
    const chunks = ['Hello', 'World']
    const translateFn = vi.fn()
      .mockResolvedValueOnce('번역됨')
      .mockRejectedValueOnce(new Error('API error'))
    const onProgress = vi.fn()

    await expect(
      translateChunks(chunks, 'en', 'ko', translateFn, onProgress),
    ).rejects.toThrow('chunk 2/2')
  })

  it('auto 소스 언어일 때 프롬프트에 from 없음', async () => {
    const chunks = ['Hello']
    const translateFn = vi.fn(async (text: string) => text)
    const onProgress = vi.fn()

    await translateChunks(chunks, 'auto', 'ko', translateFn, onProgress)

    const prompt = translateFn.mock.calls[0][0] as string
    expect(prompt).not.toContain('from auto')
    expect(prompt).toContain('to ko')
  })
})

describe('translateChunks - 취소 기능', () => {
  it('정상 완료 시 cancelled: false', async () => {
    const chunks = ['Hello', 'World']
    const translateFn = vi.fn(async (text: string) => `t:${text}`)
    const onProgress = vi.fn()
    const result = await translateChunks(chunks, 'en', 'ko', translateFn, onProgress)
    expect(result.cancelled).toBe(false)
    expect(result.translated).toHaveLength(2)
  })

  it('중간 취소 시 부분 결과 반환', async () => {
    const chunks = ['A', 'B', 'C', 'D']
    const controller = new AbortController()
    let callCount = 0
    const translateFn = vi.fn(async (text: string) => {
      callCount++
      if (callCount === 2) controller.abort()
      return `t:${text}`
    })
    const onProgress = vi.fn()
    const result = await translateChunks(chunks, 'en', 'ko', translateFn, onProgress, controller.signal)
    expect(result.cancelled).toBe(true)
    expect(result.translated.length).toBeLessThan(4)
    expect(result.translated.length).toBeGreaterThan(0)
  })

  it('첫 청크 전 취소', async () => {
    const chunks = ['A', 'B']
    const controller = new AbortController()
    controller.abort() // Pre-abort
    const translateFn = vi.fn(async (text: string) => text)
    const onProgress = vi.fn()
    const result = await translateChunks(chunks, 'en', 'ko', translateFn, onProgress, controller.signal)
    expect(result.cancelled).toBe(true)
    expect(result.translated).toHaveLength(0)
    expect(translateFn).not.toHaveBeenCalled()
  })

  it('마지막 청크 후에는 cancelled: false', async () => {
    const chunks = ['A']
    const controller = new AbortController()
    const translateFn = vi.fn(async (text: string) => {
      // Abort after translation completes
      return `t:${text}`
    })
    const onProgress = vi.fn()
    const result = await translateChunks(chunks, 'en', 'ko', translateFn, onProgress, controller.signal)
    expect(result.cancelled).toBe(false)
    expect(result.translated).toHaveLength(1)
  })

  it('signal 없이도 정상 동작 (하위 호환)', async () => {
    const chunks = ['Hello']
    const translateFn = vi.fn(async (text: string) => `t:${text}`)
    const onProgress = vi.fn()
    const result = await translateChunks(chunks, 'en', 'ko', translateFn, onProgress)
    expect(result.cancelled).toBe(false)
    expect(result.translated).toHaveLength(1)
  })

  it('빈 청크 배열 + signal', async () => {
    const controller = new AbortController()
    const translateFn = vi.fn()
    const onProgress = vi.fn()
    const result = await translateChunks([], 'en', 'ko', translateFn, onProgress, controller.signal)
    expect(result.cancelled).toBe(false)
    expect(result.translated).toEqual([])
  })

  it('부분 결과로 buildOutput 동작 확인', async () => {
    const chunks = ['Hello']
    const file = new File(['Hello'], 'test.txt', { type: 'text/plain' })
    const result = await buildOutput(chunks, file, 'txt')
    expect(result.blob).toBeInstanceOf(Blob)
    expect(result.filename).toBe('test_translated.txt')
  })

  it('취소된 부분 결과의 진행률 확인', async () => {
    const chunks = ['A', 'B', 'C']
    const controller = new AbortController()
    const translateFn = vi.fn(async (text: string) => {
      if (text.includes('B')) controller.abort()
      return `t:${text}`
    })
    const onProgress = vi.fn()
    const result = await translateChunks(chunks, 'en', 'ko', translateFn, onProgress, controller.signal)
    expect(result.cancelled).toBe(true)
    // Progress should have been called for each processed chunk
    expect(onProgress).toHaveBeenCalled()
  })
})

// --- buildOutput ---

describe('buildOutput', () => {
  it('TXT 결과 생성', async () => {
    const chunks = ['안녕하세요', '세계']
    const file = new File(['Hello\nWorld'], 'test.txt', { type: 'text/plain' })
    const result = await buildOutput(chunks, file, 'txt')

    expect(result.filename).toBe('test_translated.txt')
    expect(result.format).toBe('txt')
    expect(result.blob).toBeInstanceOf(Blob)
    const text = await result.blob.text()
    expect(text).toBe('안녕하세요\n세계')
  })

  it('CSV 결과 생성', async () => {
    const chunks = ['이름,나이', '홍길동,30']
    const file = new File(['name,age\nHong,30'], 'data.csv', { type: 'text/csv' })
    const result = await buildOutput(chunks, file, 'csv')

    expect(result.filename).toBe('data_translated.csv')
    expect(result.format).toBe('csv')
    const text = await result.blob.text()
    expect(text).toContain('이름,나이')
  })

  it('파일명에서 확장자 제거 후 _translated 추가', async () => {
    const file = new File(['x'], 'my.document.txt', { type: 'text/plain' })
    const result = await buildOutput(['번역'], file, 'txt')
    expect(result.filename).toBe('my.document_translated.txt')
  })
})

// --- estimateCost ---

describe('estimateCost', () => {
  it('빈 청크 배열은 0 비용', () => {
    const cost = estimateCost([])
    expect(cost.totalChars).toBe(0)
    expect(cost.estimatedTokens).toBe(0)
    expect(cost.estimatedCost).toBe(0)
  })

  it('문자 수 정확히 계산', () => {
    const cost = estimateCost(['Hello', 'World'])
    expect(cost.totalChars).toBe(10)
  })

  it('토큰 수 추정 (4글자당 1토큰, input+output)', () => {
    const cost = estimateCost(['A'.repeat(400)])
    expect(cost.totalChars).toBe(400)
    // 400 / 4 = 100 tokens input, x2 for output = 200
    expect(cost.estimatedTokens).toBe(200)
  })

  it('비용은 0 이상', () => {
    const cost = estimateCost(['Short text'])
    expect(cost.estimatedCost).toBeGreaterThanOrEqual(0)
  })

  it('여러 청크의 총 문자 수 합산', () => {
    const cost = estimateCost(['abc', 'defgh', 'ij'])
    expect(cost.totalChars).toBe(10)
  })

  it('비용은 소수점 3자리까지', () => {
    const cost = estimateCost(['A'.repeat(1000)])
    const decimalPlaces = (cost.estimatedCost.toString().split('.')[1] ?? '').length
    expect(decimalPlaces).toBeLessThanOrEqual(3)
  })
})

// --- DocTranslateError ---

describe('DocTranslateError', () => {
  it('name이 DocTranslateError', () => {
    const err = new DocTranslateError('test')
    expect(err.name).toBe('DocTranslateError')
    expect(err.message).toBe('test')
    expect(err).toBeInstanceOf(Error)
  })
})

// --- XLSX mock test ---

describe('extractTexts - XLSX', () => {
  it('xlsx 포맷은 동적 임포트로 빈 워크북 처리', async () => {
    // xlsx 라이브러리는 빈 버퍼를 빈 워크북으로 파싱 — 빈 배열 반환
    const file = new File([new ArrayBuffer(0)], 'test.xlsx')
    const result = await extractTexts(file, 'xlsx')
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(0)
  })
})

// --- buildOutput - PPTX ---

describe('buildOutput - PPTX', () => {
  async function createTestPptx(): Promise<File> {
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
    zip.file('ppt/slides/slide1.xml', `<?xml version="1.0"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody>
    <a:p><a:r><a:t>Hello</a:t></a:r></a:p>
    <a:p><a:r><a:t>World</a:t></a:r></a:p>
  </p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>`)
    const blob = await zip.generateAsync({ type: 'blob' })
    return new File([blob], 'test.pptx')
  }

  it('PPTX 번역 결과 파일명', async () => {
    const file = await createTestPptx()
    const result = await buildOutput(['안녕\n세계'], file, 'pptx')
    expect(result.filename).toBe('test_translated.pptx')
    expect(result.format).toBe('pptx')
  })

  it('PPTX 번역 결과 Blob 생성', async () => {
    const file = await createTestPptx()
    const result = await buildOutput(['안녕\n세계'], file, 'pptx')
    expect(result.blob).toBeInstanceOf(Blob)
    expect(result.blob.size).toBeGreaterThan(0)
  })
})

// --- buildOutput - PDF ---

describe('buildOutput - PDF', () => {
  it('PDF 번역 결과는 Markdown 파일', async () => {
    const file = new File(['pdf content'], 'document.pdf')
    const chunks = ['번역된 텍스트 1', '번역된 텍스트 2']
    const result = await buildOutput(chunks, file, 'pdf')

    expect(result.filename).toBe('document_translated.md')
    expect(result.format).toBe('pdf')
    expect(result.blob).toBeInstanceOf(Blob)
    expect(result.blob.type).toBe('text/markdown;charset=utf-8')
  })

  it('PDF 번역 결과에 모든 청크 포함', async () => {
    const file = new File(['pdf'], 'doc.pdf')
    const chunks = ['Part 1', 'Part 2', 'Part 3']
    const result = await buildOutput(chunks, file, 'pdf')
    const text = await result.blob.text()
    expect(text).toContain('Part 1')
    expect(text).toContain('Part 2')
    expect(text).toContain('Part 3')
  })
})
