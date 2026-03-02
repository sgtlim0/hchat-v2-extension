import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runDeepResearch, type ResearchProgress } from '../deepResearch'
import type { AIProvider } from '../providers/types'

// Mock fetch for DuckDuckGo API
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function createMockProvider(responses: string[]): AIProvider {
  let callIndex = 0
  return {
    name: 'test',
    models: [],
    isConfigured: () => true,
    async *stream() {
      const text = responses[callIndex++] ?? ''
      yield text
      return text
    },
  }
}

function duckDuckGoResponse(abstractText = '', relatedTopics: Array<{ FirstURL: string; Text: string }> = []) {
  return {
    ok: true,
    json: () => Promise.resolve({
      AbstractURL: abstractText ? 'https://example.com/abstract' : '',
      AbstractText: abstractText,
      Heading: 'Test Heading',
      RelatedTopics: relatedTopics,
    }),
  }
}

describe('runDeepResearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  it('3단계 진행 상태 콜백 호출', async () => {
    const provider = createMockProvider([
      '["query1", "query2"]',
      '# Report\n\nThis is the report.',
    ])
    mockFetch.mockResolvedValue(duckDuckGoResponse('Abstract text', []))

    const steps: ResearchProgress[] = []
    await runDeepResearch('test question', provider, 'model', (p) => steps.push({ ...p }))

    expect(steps.some((s) => s.step === 'generating_queries')).toBe(true)
    expect(steps.some((s) => s.step === 'searching')).toBe(true)
    expect(steps.some((s) => s.step === 'writing_report')).toBe(true)
  })

  it('리서치 결과 구조 반환', async () => {
    const provider = createMockProvider([
      '["AI trends", "machine learning"]',
      '# Report\n\n## 개요\nAI is advancing.',
    ])
    mockFetch.mockResolvedValue(duckDuckGoResponse('AI overview', []))

    const result = await runDeepResearch('AI trends', provider, 'model', () => {})

    expect(result.report).toContain('Report')
    expect(result.queriesUsed).toEqual(['AI trends', 'machine learning'])
    expect(Array.isArray(result.sources)).toBe(true)
  })

  it('JSON 배열이 아닌 텍스트에서 쿼리 파싱 (fallback)', async () => {
    const provider = createMockProvider([
      '1. What is quantum computing\n2. Quantum computing applications\n3. Quantum vs classical',
      '# Quantum Report',
    ])
    mockFetch.mockResolvedValue(duckDuckGoResponse())

    const result = await runDeepResearch('quantum computing', provider, 'model', () => {})
    expect(result.queriesUsed.length).toBeGreaterThan(0)
    expect(result.queriesUsed[0]).toContain('quantum')
  })

  it('쿼리 생성 실패 시 에러', async () => {
    const provider = createMockProvider([''])

    await expect(
      runDeepResearch('test', provider, 'model', () => {})
    ).rejects.toThrow()
  })

  it('DuckDuckGo 검색 실패 시에도 리포트 생성', async () => {
    const provider = createMockProvider([
      '["query1"]',
      '# Report without sources',
    ])
    mockFetch.mockResolvedValue({ ok: false })

    const result = await runDeepResearch('test', provider, 'model', () => {})
    expect(result.report).toContain('Report')
    expect(result.sources).toHaveLength(0)
  })

  it('소스 URL 중복 제거', async () => {
    const provider = createMockProvider([
      '["query1", "query2"]',
      '# Report',
    ])
    mockFetch.mockResolvedValue(duckDuckGoResponse('Same abstract', [
      { FirstURL: 'https://example.com/1', Text: 'Topic 1' },
      { FirstURL: 'https://example.com/1', Text: 'Topic 1 duplicate' },
    ]))

    const result = await runDeepResearch('test', provider, 'model', () => {})
    const urls = result.sources.map((s) => s.url)
    const uniqueUrls = [...new Set(urls)]
    expect(urls.length).toBe(uniqueUrls.length)
  })

  it('쿼리 최대 5개로 제한', async () => {
    const provider = createMockProvider([
      '["q1", "q2", "q3", "q4", "q5", "q6", "q7"]',
      '# Report',
    ])
    mockFetch.mockResolvedValue(duckDuckGoResponse())

    const result = await runDeepResearch('test', provider, 'model', () => {})
    expect(result.queriesUsed.length).toBeLessThanOrEqual(5)
  })

  it('AbortSignal로 취소', async () => {
    const controller = new AbortController()
    controller.abort()

    const provider = createMockProvider([
      '["query1"]',
      '# Report',
    ])

    await expect(
      runDeepResearch('test', provider, 'model', () => {}, controller.signal)
    ).rejects.toThrow()
  })

  it('검색 단계에서 진행 상황 상세 표시', async () => {
    const provider = createMockProvider([
      '["first query", "second query"]',
      '# Report',
    ])
    mockFetch.mockResolvedValue(duckDuckGoResponse())

    const steps: ResearchProgress[] = []
    await runDeepResearch('test', provider, 'model', (p) => steps.push({ ...p }))

    const searchSteps = steps.filter((s) => s.step === 'searching')
    expect(searchSteps.length).toBe(2)
    expect(searchSteps[0].detail).toContain('first query')
    expect(searchSteps[1].detail).toContain('second query')
  })

  it('영어 locale로 실행', async () => {
    const provider = createMockProvider([
      '["query1"]',
      '# English Report',
    ])
    mockFetch.mockResolvedValue(duckDuckGoResponse('Abstract', []))

    const steps: ResearchProgress[] = []
    const result = await runDeepResearch('test', provider, 'model', (p) => steps.push({ ...p }), undefined, 'en')

    expect(result.report).toContain('English Report')
    // English locale should use English progress messages
    const genStep = steps.find((s) => s.step === 'generating_queries')
    expect(genStep?.detail).toContain('Generating')
  })
})
