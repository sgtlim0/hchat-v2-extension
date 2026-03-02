// lib/deepResearch.ts — Multi-step research orchestration

import type { AIProvider } from './providers/types'

export interface ResearchProgress {
  step: 'generating_queries' | 'searching' | 'writing_report'
  detail: string
  current: number
  total: number
}

export interface SourceRef {
  url: string
  title: string
  snippet: string
}

export interface ResearchResult {
  report: string
  sources: SourceRef[]
  queriesUsed: string[]
}

async function collectStreamText(
  provider: AIProvider,
  model: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<string> {
  let text = ''
  const gen = provider.stream({
    model,
    messages: [{ role: 'user', content: prompt }],
    signal,
  })
  for await (const chunk of gen) {
    text += chunk
  }
  return text
}

function parseQueries(text: string): string[] {
  // Try JSON array first
  try {
    const match = text.match(/\[[\s\S]*?\]/)
    if (match) {
      const arr = JSON.parse(match[0])
      if (Array.isArray(arr) && arr.length > 0) return arr.map(String).slice(0, 5)
    }
  } catch { /* fallback */ }

  // Fallback: extract numbered lines
  const lines = text.split('\n')
    .map((l) => l.replace(/^\d+[\.\)]\s*/, '').replace(/^[-*]\s*/, '').trim())
    .filter((l) => l.length > 5 && l.length < 200)

  return lines.slice(0, 5)
}

async function searchDuckDuckGo(query: string): Promise<SourceRef[]> {
  try {
    const encoded = encodeURIComponent(query)
    const res = await fetch(`https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`)
    if (!res.ok) return []
    const data = await res.json()

    const results: SourceRef[] = []

    if (data.AbstractURL && data.AbstractText) {
      results.push({ url: data.AbstractURL, title: data.Heading || query, snippet: data.AbstractText })
    }

    for (const topic of data.RelatedTopics ?? []) {
      if (topic.FirstURL && topic.Text) {
        results.push({ url: topic.FirstURL, title: topic.Text.slice(0, 80), snippet: topic.Text })
      }
      // Nested topics
      for (const sub of topic.Topics ?? []) {
        if (sub.FirstURL && sub.Text) {
          results.push({ url: sub.FirstURL, title: sub.Text.slice(0, 80), snippet: sub.Text })
        }
      }
    }

    return results.slice(0, 5)
  } catch {
    return []
  }
}

export async function runDeepResearch(
  question: string,
  provider: AIProvider,
  model: string,
  onProgress: (progress: ResearchProgress) => void,
  signal?: AbortSignal,
): Promise<ResearchResult> {
  // Step 1: Generate search queries
  onProgress({ step: 'generating_queries', detail: '검색 쿼리 생성 중...', current: 0, total: 3 })

  const queryPrompt = `다음 질문을 조사하기 위한 효과적인 검색 쿼리를 3-5개 생성해줘.
JSON 배열 형태로 반환해줘 (예: ["query1", "query2", "query3"]).
질문에 대해 다양한 관점과 측면을 커버하는 쿼리를 만들어줘.

질문: ${question}`

  const queryText = await collectStreamText(provider, model, queryPrompt, signal)
  const queries = parseQueries(queryText)

  if (queries.length === 0) {
    throw new Error('검색 쿼리를 생성할 수 없습니다')
  }

  // Step 2: Search for each query
  const allSources: SourceRef[] = []

  for (let i = 0; i < queries.length; i++) {
    if (signal?.aborted) throw new Error('취소됨')
    onProgress({
      step: 'searching',
      detail: `검색 중: "${queries[i]}" (${i + 1}/${queries.length})`,
      current: 1,
      total: 3,
    })
    const results = await searchDuckDuckGo(queries[i])
    allSources.push(...results)
  }

  // Deduplicate sources by URL
  const uniqueSources = allSources.reduce<SourceRef[]>((acc, src) => {
    if (!acc.some((s) => s.url === src.url)) acc.push(src)
    return acc
  }, []).slice(0, 15)

  // Step 3: Generate report
  onProgress({ step: 'writing_report', detail: '리포트 작성 중...', current: 2, total: 3 })

  const sourcesContext = uniqueSources.length > 0
    ? uniqueSources.map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\n발췌: ${s.snippet}`).join('\n\n')
    : '검색 결과가 충분하지 않습니다. 일반 지식을 기반으로 답변합니다.'

  const reportPrompt = `다음 질문에 대해 구조화된 리서치 리포트를 작성해줘.

질문: ${question}

참고 자료:
${sourcesContext}

리포트 형식:
1. ## 개요 — 질문에 대한 핵심 답변 (2-3문장)
2. ## 주요 발견사항 — 핵심 내용을 항목별로 정리
3. ## 상세 분석 — 각 발견사항에 대한 심층 설명
4. ## 결론 및 시사점 — 종합 결론과 실행 가능한 시사점
5. ## 출처 — 참고한 자료의 URL과 제목

Markdown 형식으로 작성하고, 출처를 인용할 때 [1], [2] 형태로 번호를 매겨줘.`

  const report = await collectStreamText(provider, model, reportPrompt, signal)

  return {
    report,
    sources: uniqueSources,
    queriesUsed: queries,
  }
}
