// lib/deepResearch.ts — Multi-step research orchestration with streaming

import type { AIProvider } from './providers/types'
import { webSearch, type SearchResult } from './webSearch'
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

/** Events yielded by the streaming deep research generator */
export type ResearchEvent =
  | { type: 'progress'; progress: ResearchProgress }
  | { type: 'sources_found'; query: string; sources: SourceRef[] }
  | { type: 'report_chunk'; chunk: string }
  | { type: 'done'; result: ResearchResult }

export interface DeepResearchOptions {
  question: string
  provider: AIProvider
  model: string
  signal?: AbortSignal
  locale?: Locale
  googleApiKey?: string
  googleEngineId?: string
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

function toSourceRef(result: SearchResult): SourceRef {
  return { url: result.url, title: result.title, snippet: result.snippet }
}

/**
 * Run deep research as an async generator that yields streaming events.
 * Supports both DuckDuckGo (default) and Google Custom Search.
 */
export async function* streamDeepResearch(
  opts: DeepResearchOptions,
): AsyncGenerator<ResearchEvent, void> {
  const { question, provider, model, signal, locale = 'ko', googleApiKey, googleEngineId } = opts
  const t = (key: string, params?: Record<string, string | number>) => tSync(locale, key, params)

  // Step 1: Generate search queries
  yield {
    type: 'progress',
    progress: { step: 'generating_queries', detail: t('deepResearch.generating'), current: 0, total: 3 },
  }

  const queryPrompt = t('deepResearch.queryPrompt', { question })
  const queryText = await collectStreamText(provider, model, queryPrompt, signal)
  const queries = parseQueries(queryText)

  if (queries.length === 0) {
    throw new Error(t('deepResearch.noQueries'))
  }

  // Step 2: Search for each query (with intermediate results)
  const allSources: SourceRef[] = []
  const searchEngine = googleApiKey && googleEngineId
    ? t('deepResearch.engineGoogle')
    : t('deepResearch.engineDuckDuckGo')

  for (let i = 0; i < queries.length; i++) {
    if (signal?.aborted) throw new Error(t('deepResearch.cancelled'))

    yield {
      type: 'progress',
      progress: {
        step: 'searching',
        detail: t('deepResearch.searchingDetail', { query: queries[i], current: i + 1, total: queries.length, engine: searchEngine }),
        current: 1,
        total: 3,
      },
    }

    const results = await webSearch({
      query: queries[i],
      maxResults: 5,
      googleApiKey: googleApiKey || undefined,
      googleEngineId: googleEngineId || undefined,
    })

    const sources = results.map(toSourceRef)
    allSources.push(...sources)

    // Yield intermediate search results as they come in
    if (sources.length > 0) {
      yield { type: 'sources_found', query: queries[i], sources }
    }
  }

  // Deduplicate sources by URL
  const uniqueSources = allSources.reduce<SourceRef[]>((acc, src) => {
    if (!acc.some((s) => s.url === src.url)) acc.push(src)
    return acc
  }, []).slice(0, 15)

  // Step 3: Generate report (streaming)
  yield {
    type: 'progress',
    progress: { step: 'writing_report', detail: t('deepResearch.writing'), current: 2, total: 3 },
  }

  const excerptLabel = t('deepResearch.excerpt')
  const sourcesContext = uniqueSources.length > 0
    ? uniqueSources.map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\n${excerptLabel}: ${s.snippet}`).join('\n\n')
    : t('deepResearch.noSearchResults')

  const reportPrompt = t('deepResearch.reportPrompt', { question, sources: sourcesContext })

  let fullReport = ''
  const gen = provider.stream({
    model,
    messages: [{ role: 'user', content: reportPrompt }],
    signal,
  })

  for await (const chunk of gen) {
    fullReport += chunk
    yield { type: 'report_chunk', chunk }
  }

  yield {
    type: 'done',
    result: { report: fullReport, sources: uniqueSources, queriesUsed: queries },
  }
}

/**
 * Legacy non-streaming API — wraps streamDeepResearch for backward compatibility.
 */
export async function runDeepResearch(
  question: string,
  provider: AIProvider,
  model: string,
  onProgress: (progress: ResearchProgress) => void,
  signal?: AbortSignal,
  locale: Locale = 'ko',
  googleApiKey?: string,
  googleEngineId?: string,
): Promise<ResearchResult> {
  const gen = streamDeepResearch({ question, provider, model, signal, locale, googleApiKey, googleEngineId })

  let result: ResearchResult | undefined

  for await (const event of gen) {
    switch (event.type) {
      case 'progress':
        onProgress(event.progress)
        break
      case 'done':
        result = event.result
        break
    }
  }

  if (!result) {
    throw new Error(tSync(locale, 'deepResearch.failed', { error: 'No result' }))
  }

  return result
}
