import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getOcrPrompt, processBatchOcr, exportOcrResults, type OcrResult, type OcrMode } from '../batchOcr'

// Mock i18n module
vi.mock('../../i18n', () => {
  let locale = 'ko'
  return {
    getGlobalLocale: () => locale,
    setGlobalLocale: (l: string) => { locale = l },
  }
})

import { setGlobalLocale } from '../../i18n'

function makeImage(id: string, fileName?: string) {
  return { id, fileName: fileName ?? `${id}.png`, base64: `data:image/png;base64,${id}` }
}

function makeDoneResult(id: string, overrides?: Partial<OcrResult>): OcrResult {
  return {
    id,
    fileName: `${id}.png`,
    imageBase64: `data:image/png;base64,${id}`,
    text: `text for ${id}`,
    mode: 'general',
    status: 'done',
    ...overrides,
  }
}

describe('getOcrPrompt', () => {
  beforeEach(() => {
    setGlobalLocale('ko' as 'ko')
  })

  it('general 모드 한국어 프롬프트 반환', () => {
    const prompt = getOcrPrompt('general')
    expect(prompt).toContain('텍스트를 정확히 추출')
  })

  it('general 모드 영어 프롬프트 반환', () => {
    setGlobalLocale('en' as 'ko')
    const prompt = getOcrPrompt('general')
    expect(prompt).toContain('Extract all text')
  })

  it('businessCard 모드 한국어 프롬프트 반환', () => {
    const prompt = getOcrPrompt('businessCard')
    expect(prompt).toContain('명함 정보를 JSON')
  })

  it('businessCard 모드 영어 프롬프트 반환', () => {
    setGlobalLocale('en' as 'ko')
    const prompt = getOcrPrompt('businessCard')
    expect(prompt).toContain('business card info as JSON')
  })

  it('receipt 모드 한국어 프롬프트 반환', () => {
    const prompt = getOcrPrompt('receipt')
    expect(prompt).toContain('영수증 정보를 JSON')
  })

  it('receipt 모드 영어 프롬프트 반환', () => {
    setGlobalLocale('en' as 'ko')
    const prompt = getOcrPrompt('receipt')
    expect(prompt).toContain('receipt info as JSON')
  })

  it('screenshot 모드 한국어 프롬프트 반환', () => {
    const prompt = getOcrPrompt('screenshot')
    expect(prompt).toContain('스크린샷의 UI 텍스트')
  })

  it('screenshot 모드 영어 프롬프트 반환', () => {
    setGlobalLocale('en' as 'ko')
    const prompt = getOcrPrompt('screenshot')
    expect(prompt).toContain('UI text from this screenshot')
  })

  it('ja 로케일은 en 프롬프트로 폴백', () => {
    setGlobalLocale('ja' as 'ko')
    const prompt = getOcrPrompt('general')
    expect(prompt).toContain('Extract all text')
  })
})

describe('processBatchOcr', () => {
  beforeEach(() => {
    setGlobalLocale('ko' as 'ko')
  })

  it('단일 이미지 처리', async () => {
    const visionFn = vi.fn().mockResolvedValue('Hello World')
    const onProgress = vi.fn()

    const results = await processBatchOcr([makeImage('a')], 'general', visionFn, onProgress)

    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('done')
    expect(results[0].text).toBe('Hello World')
    expect(visionFn).toHaveBeenCalledTimes(1)
  })

  it('3개 이미지를 하나의 배치로 병렬 처리', async () => {
    const callOrder: string[] = []
    const visionFn = vi.fn().mockImplementation(async (base64: string) => {
      callOrder.push(base64)
      return `result-${base64}`
    })
    const onProgress = vi.fn()

    const images = [makeImage('a'), makeImage('b'), makeImage('c')]
    const results = await processBatchOcr(images, 'general', visionFn, onProgress)

    expect(results).toHaveLength(3)
    expect(visionFn).toHaveBeenCalledTimes(3)
    expect(results.every(r => r.status === 'done')).toBe(true)
  })

  it('4개 이미지를 2개 배치로 처리 (3+1)', async () => {
    let batchCount = 0
    let concurrentCalls = 0
    let maxConcurrent = 0

    const visionFn = vi.fn().mockImplementation(async () => {
      concurrentCalls++
      maxConcurrent = Math.max(maxConcurrent, concurrentCalls)
      await new Promise(r => setTimeout(r, 10))
      concurrentCalls--
      batchCount++
      return 'text'
    })
    const onProgress = vi.fn()

    const images = [makeImage('a'), makeImage('b'), makeImage('c'), makeImage('d')]
    const results = await processBatchOcr(images, 'general', visionFn, onProgress)

    expect(results).toHaveLength(4)
    expect(visionFn).toHaveBeenCalledTimes(4)
    // Max concurrent should be 3 (first batch)
    expect(maxConcurrent).toBeLessThanOrEqual(3)
  })

  it('에러가 발생해도 다른 이미지는 정상 처리 (Promise.allSettled)', async () => {
    const visionFn = vi.fn()
      .mockResolvedValueOnce('ok text')
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValueOnce('ok text 2')
    const onProgress = vi.fn()

    const images = [makeImage('a'), makeImage('b'), makeImage('c')]
    const results = await processBatchOcr(images, 'general', visionFn, onProgress)

    expect(results).toHaveLength(3)
    expect(results[0].status).toBe('done')
    expect(results[1].status).toBe('error')
    expect(results[1].error).toContain('API error')
    expect(results[2].status).toBe('done')
  })

  it('onProgress가 processing과 done 상태에서 호출됨', async () => {
    const visionFn = vi.fn().mockResolvedValue('text')
    const onProgress = vi.fn()

    await processBatchOcr([makeImage('a')], 'general', visionFn, onProgress)

    // processing + done = 2 calls
    expect(onProgress).toHaveBeenCalledTimes(2)
    expect(onProgress.mock.calls[0][0].status).toBe('processing')
    expect(onProgress.mock.calls[1][0].status).toBe('done')
  })

  it('businessCard 모드에서 JSON 구조화 데이터 파싱', async () => {
    const json = '{"name": "John", "company": "Acme", "title": "CEO", "phone": "123", "email": "j@a.com", "address": "Seoul"}'
    const visionFn = vi.fn().mockResolvedValue(`Here is the result:\n${json}`)
    const onProgress = vi.fn()

    const results = await processBatchOcr([makeImage('a')], 'businessCard', visionFn, onProgress)

    expect(results[0].structured).toBeDefined()
    expect(results[0].structured?.name).toBe('John')
    expect(results[0].structured?.company).toBe('Acme')
  })

  it('receipt 모드에서 JSON 구조화 데이터 파싱', async () => {
    const json = '{"store": "Mart", "date": "2024-01-01", "items": [{"name": "Apple", "price": "1000"}], "total": "1000"}'
    const visionFn = vi.fn().mockResolvedValue(json)
    const onProgress = vi.fn()

    const results = await processBatchOcr([makeImage('a')], 'receipt', visionFn, onProgress)

    expect(results[0].structured).toBeDefined()
    expect(results[0].structured?.store).toBe('Mart')
    expect(results[0].structured?.total).toBe('1000')
  })

  it('general 모드에서는 구조화 데이터 파싱하지 않음', async () => {
    const visionFn = vi.fn().mockResolvedValue('{"name": "test"}')
    const onProgress = vi.fn()

    const results = await processBatchOcr([makeImage('a')], 'general', visionFn, onProgress)

    expect(results[0].structured).toBeUndefined()
  })

  it('screenshot 모드에서는 구조화 데이터 파싱하지 않음', async () => {
    const visionFn = vi.fn().mockResolvedValue('{"name": "test"}')
    const onProgress = vi.fn()

    const results = await processBatchOcr([makeImage('a')], 'screenshot', visionFn, onProgress)

    expect(results[0].structured).toBeUndefined()
  })

  it('잘못된 JSON은 structured가 undefined', async () => {
    const visionFn = vi.fn().mockResolvedValue('Not a valid JSON {broken')
    const onProgress = vi.fn()

    const results = await processBatchOcr([makeImage('a')], 'businessCard', visionFn, onProgress)

    expect(results[0].status).toBe('done')
    expect(results[0].structured).toBeUndefined()
  })

  it('빈 이미지 배열은 빈 결과 반환', async () => {
    const visionFn = vi.fn()
    const onProgress = vi.fn()

    const results = await processBatchOcr([], 'general', visionFn, onProgress)

    expect(results).toHaveLength(0)
    expect(visionFn).not.toHaveBeenCalled()
    expect(onProgress).not.toHaveBeenCalled()
  })

  it('결과에 올바른 fileName과 id 포함', async () => {
    const visionFn = vi.fn().mockResolvedValue('text')
    const onProgress = vi.fn()

    const results = await processBatchOcr([makeImage('img1', 'photo.jpg')], 'general', visionFn, onProgress)

    expect(results[0].id).toBe('img1')
    expect(results[0].fileName).toBe('photo.jpg')
  })

  it('결과에 올바른 mode 포함', async () => {
    const visionFn = vi.fn().mockResolvedValue('text')
    const onProgress = vi.fn()

    const modes: OcrMode[] = ['general', 'businessCard', 'receipt', 'screenshot']
    for (const mode of modes) {
      const results = await processBatchOcr([makeImage('a')], mode, visionFn, onProgress)
      expect(results[0].mode).toBe(mode)
    }
  })
})

describe('exportOcrResults', () => {
  it('TXT 포맷으로 내보내기', () => {
    const results: OcrResult[] = [
      makeDoneResult('a', { fileName: 'img1.png', text: 'Hello' }),
      makeDoneResult('b', { fileName: 'img2.png', text: 'World' }),
    ]
    const output = exportOcrResults(results, 'txt')
    expect(output).toBe('=== img1.png ===\nHello\n\n=== img2.png ===\nWorld')
  })

  it('JSON 포맷으로 내보내기', () => {
    const results: OcrResult[] = [
      makeDoneResult('a', { fileName: 'img1.png', text: 'Hello', structured: { name: 'test' } }),
    ]
    const output = exportOcrResults(results, 'json')
    const parsed = JSON.parse(output)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].fileName).toBe('img1.png')
    expect(parsed[0].text).toBe('Hello')
    expect(parsed[0].structured.name).toBe('test')
  })

  it('에러 결과는 필터링됨 (TXT)', () => {
    const results: OcrResult[] = [
      makeDoneResult('a', { text: 'Good' }),
      { ...makeDoneResult('b'), status: 'error', error: 'fail' },
    ]
    const output = exportOcrResults(results, 'txt')
    expect(output).toContain('Good')
    expect(output).not.toContain('fail')
  })

  it('에러 결과는 필터링됨 (JSON)', () => {
    const results: OcrResult[] = [
      makeDoneResult('a', { text: 'Good' }),
      { ...makeDoneResult('b'), status: 'error', error: 'fail' },
    ]
    const output = exportOcrResults(results, 'json')
    const parsed = JSON.parse(output)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].text).toBe('Good')
  })

  it('processing 결과도 필터링됨', () => {
    const results: OcrResult[] = [
      { ...makeDoneResult('a'), status: 'processing' },
      makeDoneResult('b', { text: 'Done' }),
    ]
    const output = exportOcrResults(results, 'txt')
    expect(output).not.toContain('text for a')
    expect(output).toContain('Done')
  })

  it('빈 결과 배열은 빈 문자열 반환 (TXT)', () => {
    const output = exportOcrResults([], 'txt')
    expect(output).toBe('')
  })

  it('빈 결과 배열은 빈 JSON 배열 반환', () => {
    const output = exportOcrResults([], 'json')
    expect(output).toBe('[]')
  })

  it('JSON 내보내기에 mode 포함', () => {
    const results: OcrResult[] = [
      makeDoneResult('a', { mode: 'businessCard' }),
    ]
    const output = exportOcrResults(results, 'json')
    const parsed = JSON.parse(output)
    expect(parsed[0].mode).toBe('businessCard')
  })

  it('structured가 없으면 JSON에 undefined로 포함', () => {
    const results: OcrResult[] = [
      makeDoneResult('a'),
    ]
    const output = exportOcrResults(results, 'json')
    const parsed = JSON.parse(output)
    expect(parsed[0].structured).toBeUndefined()
  })
})
