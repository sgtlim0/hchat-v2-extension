import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runDeepResearch, streamDeepResearch, type ResearchProgress, type ResearchEvent } from '../deepResearch'
import type { AIProvider } from '../providers/types'

// Mock webSearch module
vi.mock('../webSearch', () => ({
  webSearch: vi.fn(),
}))

import { webSearch } from '../webSearch'
const mockWebSearch = vi.mocked(webSearch)

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

function mockSearchResults(results: Array<{ title: string; url: string; snippet: string }> = []) {
  mockWebSearch.mockResolvedValue(results)
}

describe('runDeepResearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWebSearch.mockReset()
  })

  it('3단계 진행 상태 콜백 호출', async () => {
    const provider = createMockProvider([
      '["query1", "query2"]',
      '# Report\n\nThis is the report.',
    ])
    mockSearchResults([{ title: 'Test', url: 'https://example.com', snippet: 'Abstract text' }])

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
    mockSearchResults([{ title: 'AI overview', url: 'https://example.com/ai', snippet: 'AI overview' }])

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
    mockSearchResults([])

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
    mockSearchResults([])

    const result = await runDeepResearch('test', provider, 'model', () => {})
    expect(result.report).toContain('Report')
    expect(result.sources).toHaveLength(0)
  })

  it('소스 URL 중복 제거', async () => {
    const provider = createMockProvider([
      '["query1", "query2"]',
      '# Report',
    ])
    mockSearchResults([
      { title: 'Topic 1', url: 'https://example.com/1', snippet: 'Snippet 1' },
      { title: 'Topic 1 dup', url: 'https://example.com/1', snippet: 'Snippet 1 dup' },
    ])

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
    mockSearchResults([])

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
    mockSearchResults([])

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
    mockSearchResults([{ title: 'Abstract', url: 'https://example.com', snippet: 'Abstract text' }])

    const steps: ResearchProgress[] = []
    const result = await runDeepResearch('test', provider, 'model', (p) => steps.push({ ...p }), undefined, 'en')

    expect(result.report).toContain('English Report')
    // English locale should use English progress messages
    const genStep = steps.find((s) => s.step === 'generating_queries')
    expect(genStep?.detail).toContain('Generating')
  })

  it('소스 최대 15개로 제한', async () => {
    const provider = createMockProvider([
      '["q1", "q2", "q3", "q4", "q5"]',
      '# Report',
    ])
    // 각 쿼리에 4개 결과 = 20개 (중복 제거 후 최대 15개)
    const uniqueResults = Array.from({ length: 4 }, (_, i) => ({
      title: `Result ${i}`,
      url: `https://example.com/${i}`,
      snippet: `Snippet ${i}`,
    }))
    mockWebSearch.mockImplementation(async (opts) => {
      const idx = parseInt(opts.query.replace('q', '')) - 1
      return uniqueResults.map((r) => ({
        ...r,
        url: `${r.url}-${idx}`,
      }))
    })

    const result = await runDeepResearch('test', provider, 'model', () => {})
    expect(result.sources.length).toBeLessThanOrEqual(15)
  })

  it('Google API 키와 엔진 ID를 webSearch에 전달', async () => {
    const provider = createMockProvider([
      '["query1"]',
      '# Report',
    ])
    mockSearchResults([])

    await runDeepResearch('test', provider, 'model', () => {}, undefined, 'ko', 'api-key', 'engine-id')

    expect(mockWebSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        googleApiKey: 'api-key',
        googleEngineId: 'engine-id',
      })
    )
  })
})

describe('streamDeepResearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWebSearch.mockReset()
  })

  it('스트리밍 이벤트를 순서대로 yield', async () => {
    const provider = createMockProvider([
      '["query1"]',
      '# Report',
    ])
    mockSearchResults([{ title: 'Source', url: 'https://example.com', snippet: 'Snippet' }])

    const events: ResearchEvent[] = []
    for await (const event of streamDeepResearch({ question: 'test', provider, model: 'model' })) {
      events.push(event)
    }

    const types = events.map((e) => e.type)
    expect(types).toContain('progress')
    expect(types).toContain('sources_found')
    expect(types).toContain('report_chunk')
    expect(types).toContain('done')
  })

  it('리포트 청크를 스트리밍으로 전달', async () => {
    let callIndex = 0
    const provider: AIProvider = {
      name: 'test',
      models: [],
      isConfigured: () => true,
      async *stream() {
        if (callIndex === 0) {
          callIndex++
          yield '["query1"]'
          return '["query1"]'
        }
        yield 'Part 1 '
        yield 'Part 2'
        return 'Part 1 Part 2'
      },
    }
    mockSearchResults([])

    const chunks: string[] = []
    for await (const event of streamDeepResearch({ question: 'test', provider, model: 'model' })) {
      if (event.type === 'report_chunk') chunks.push(event.chunk)
    }

    expect(chunks).toEqual(['Part 1 ', 'Part 2'])
  })

  it('sources_found 이벤트에 검색 결과 포함', async () => {
    const provider = createMockProvider([
      '["query1", "query2"]',
      '# Report',
    ])
    mockSearchResults([{ title: 'Result', url: 'https://example.com', snippet: 'Text' }])

    const sourcesEvents: ResearchEvent[] = []
    for await (const event of streamDeepResearch({ question: 'test', provider, model: 'model' })) {
      if (event.type === 'sources_found') sourcesEvents.push(event)
    }

    expect(sourcesEvents.length).toBe(2)
    if (sourcesEvents[0].type === 'sources_found') {
      expect(sourcesEvents[0].sources.length).toBeGreaterThan(0)
      expect(sourcesEvents[0].query).toBe('query1')
    }
  })

  it('Google API 키 전달 시 webSearch에 전달', async () => {
    const provider = createMockProvider([
      '["query1"]',
      '# Report',
    ])
    mockSearchResults([])

    const gen = streamDeepResearch({
      question: 'test',
      provider,
      model: 'model',
      googleApiKey: 'test-key',
      googleEngineId: 'test-engine',
    })

    for await (const _event of gen) { /* consume */ }

    expect(mockWebSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        googleApiKey: 'test-key',
        googleEngineId: 'test-engine',
      })
    )
  })

  it('done 이벤트에 최종 결과 포함', async () => {
    const provider = createMockProvider([
      '["query1"]',
      '# Final Report',
    ])
    mockSearchResults([{ title: 'Src', url: 'https://example.com', snippet: 'Snip' }])

    let doneEvent: ResearchEvent | undefined
    for await (const event of streamDeepResearch({ question: 'test', provider, model: 'model' })) {
      if (event.type === 'done') doneEvent = event
    }

    expect(doneEvent).toBeDefined()
    if (doneEvent?.type === 'done') {
      expect(doneEvent.result.report).toContain('Final Report')
      expect(doneEvent.result.queriesUsed).toEqual(['query1'])
      expect(doneEvent.result.sources.length).toBeGreaterThan(0)
    }
  })
})
