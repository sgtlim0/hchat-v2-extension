// lib/deepResearch.ts — Multi-step research orchestration

import type { AIProvider } from './providers/types'
import { tSync, type Locale } from '../i18n'

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
    .map((l) => l.replace(/^\d+[.)]\s*/, '').replace(/^[-*]\s*/, '').trim())
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
  locale: Locale = 'ko',
): Promise<ResearchResult> {
  const t = (key: string, params?: Record<string, string | number>) => tSync(locale, key, params)

  // Step 1: Generate search queries
  onProgress({ step: 'generating_queries', detail: t('deepResearch.generating'), current: 0, total: 3 })

  const queryPrompt = t('deepResearch.queryPrompt', { question })

  const queryText = await collectStreamText(provider, model, queryPrompt, signal)
  const queries = parseQueries(queryText)

  if (queries.length === 0) {
    throw new Error(t('deepResearch.noQueries'))
  }

  // Step 2: Search for each query
  const allSources: SourceRef[] = []

  for (let i = 0; i < queries.length; i++) {
    if (signal?.aborted) throw new Error(t('deepResearch.cancelled'))
    onProgress({
      step: 'searching',
      detail: t('deepResearch.searchingDetail', { query: queries[i], current: i + 1, total: queries.length }),
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
  onProgress({ step: 'writing_report', detail: t('deepResearch.writing'), current: 2, total: 3 })

  const excerptLabel = t('deepResearch.excerpt')
  const sourcesContext = uniqueSources.length > 0
    ? uniqueSources.map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\n${excerptLabel}: ${s.snippet}`).join('\n\n')
    : t('deepResearch.noSearchResults')

  const reportPrompt = t('deepResearch.reportPrompt', { question, sources: sourcesContext })

  const report = await collectStreamText(provider, model, reportPrompt, signal)

  return {
    report,
    sources: uniqueSources,
    queriesUsed: queries,
  }
}
