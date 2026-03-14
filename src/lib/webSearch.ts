// lib/webSearch.ts — Web search via DuckDuckGo Instant Answer API + HTML scraping fallback

import { t } from '../i18n'
import { SK } from './storageKeys'

export interface SearchResult {
  title: string
  url: string
  snippet: string
}

export interface SearchOptions {
  query: string
  maxResults?: number
}

const CACHE_KEY_PREFIX = SK.SEARCH_CACHE_PREFIX
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

function hashQuery(query: string): string {
  let h = 0
  for (let i = 0; i < query.length; i++) {
    h = ((h << 5) - h + query.charCodeAt(i)) | 0
  }
  return String(h >>> 0)
}

// DuckDuckGo HTML search (no API key needed)
async function searchDuckDuckGo(query: string, max: number): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HChatBot/2.0)' },
  })

  if (!res.ok) return []

  const html = await res.text()
  const results: SearchResult[] = []

  // Parse DuckDuckGo HTML results
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const links = doc.querySelectorAll('.result__a')
  const snippets = doc.querySelectorAll('.result__snippet')

  for (let i = 0; i < Math.min(links.length, max); i++) {
    const anchor = links[i] as HTMLAnchorElement
    const snippet = snippets[i]
    if (!anchor) continue

    // DuckDuckGo redirects through their URL, extract actual URL
    let href = anchor.href
    const uddgMatch = href.match(/uddg=([^&]+)/)
    if (uddgMatch) {
      href = decodeURIComponent(uddgMatch[1])
    }

    results.push({
      title: anchor.textContent?.trim() ?? '',
      url: href,
      snippet: snippet?.textContent?.trim() ?? '',
    })
  }

  return results
}

// Google Custom Search (requires API key)
async function searchGoogle(query: string, apiKey: string, engineId: string, max: number): Promise<SearchResult[]> {
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=${encodeURIComponent(query)}&num=${max}&hl=ko`

  const res = await fetch(url)
  if (!res.ok) return []

  const data = await res.json()
  return (data.items ?? []).slice(0, max).map((item: { title: string; link: string; snippet: string }) => ({
    title: item.title,
    url: item.link,
    snippet: item.snippet,
  }))
}

export async function webSearch(opts: SearchOptions & { googleApiKey?: string; googleEngineId?: string }): Promise<SearchResult[]> {
  const { query, maxResults = 5, googleApiKey, googleEngineId } = opts
  const cacheKey = CACHE_KEY_PREFIX + hashQuery(query)

  // Check cache
  try {
    const cached = await chrome.storage.local.get(cacheKey)
    const entry = cached[cacheKey]
    if (entry && Date.now() - entry.ts < CACHE_TTL) {
      return entry.results as SearchResult[]
    }
  } catch {
    // cache miss
  }

  let results: SearchResult[]

  // Prefer Google CSE if configured, fall back to DuckDuckGo
  if (googleApiKey && googleEngineId) {
    results = await searchGoogle(query, googleApiKey, googleEngineId, maxResults)
  } else {
    results = await searchDuckDuckGo(query, maxResults)
  }

  // Cache results
  if (results.length > 0) {
    try {
      await chrome.storage.local.set({ [cacheKey]: { results, ts: Date.now() } })
    } catch {
      // storage full — ignore
    }
  }

  return results
}

// Build RAG context from search results for system prompt injection
export function buildSearchContext(results: SearchResult[]): string {
  if (results.length === 0) return ''

  const lines = results.map((r, i) =>
    `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}`
  )

  return [
    t('aiPrompts.searchContext'),
    '',
    ...lines,
  ].join('\n')
}
