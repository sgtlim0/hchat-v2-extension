/** Prompt cache module — BM25-based similarity caching for AI responses */

import { Storage } from './storage'
import { buildBM25Index, scoreBM25 } from './bm25'
import { SK } from './storageKeys'

// ── Constants ──

export const STORAGE_KEY = SK.PROMPT_CACHE
export const DEFAULT_TTL = 24 * 60 * 60 * 1000 // 24 hours
export const MAX_ENTRIES = 100
const TOKENS_PER_CHAR = 0.25 // rough estimate for token counting

// ── Types ──

export interface CachedEntry {
  prompt: string
  response: string
  modelId: string
  createdAt: number
  ttl: number
  hitCount: number
}

export interface CacheStats {
  totalEntries: number
  totalHits: number
  totalMisses: number
  hitRate: number
  estimatedTokensSaved: number
}

export interface CacheData {
  entries: CachedEntry[]
  totalHits: number
  totalMisses: number
}

// ── Helpers ──

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s가-힣]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0)
}

function createEmptyData(): CacheData {
  return { entries: [], totalHits: 0, totalMisses: 0 }
}

async function loadCache(): Promise<CacheData> {
  const data = await Storage.get<CacheData>(STORAGE_KEY)
  return data ?? createEmptyData()
}

async function saveCache(data: CacheData): Promise<void> {
  await Storage.set(STORAGE_KEY, data)
}

function isExpired(entry: CachedEntry, now: number): boolean {
  return now - entry.createdAt > entry.ttl
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length * TOKENS_PER_CHAR)
}

// ── Public API ──

/** Cache a prompt-response pair for a specific model */
export async function cacheResponse(
  prompt: string,
  response: string,
  modelId: string,
): Promise<void> {
  const data = await loadCache()
  const now = Date.now()

  const existingIdx = data.entries.findIndex(
    (e) => e.prompt === prompt && e.modelId === modelId,
  )

  const entry: CachedEntry = {
    prompt,
    response,
    modelId,
    createdAt: now,
    ttl: DEFAULT_TTL,
    hitCount: existingIdx >= 0 ? data.entries[existingIdx].hitCount : 0,
  }

  const updatedEntries =
    existingIdx >= 0
      ? data.entries.map((e, i) => (i === existingIdx ? entry : e))
      : [...data.entries, entry]

  // FIFO eviction if over max
  const trimmed =
    updatedEntries.length > MAX_ENTRIES
      ? updatedEntries.slice(updatedEntries.length - MAX_ENTRIES)
      : updatedEntries

  await saveCache({ ...data, entries: trimmed })
}

/** Find a cached response using BM25 similarity scoring */
export async function findCachedResponse(
  prompt: string,
  modelId: string,
  threshold: number = 0.8,
): Promise<CachedEntry | null> {
  const data = await loadCache()
  const now = Date.now()

  // Filter to same model and non-expired
  const candidates = data.entries.filter(
    (e) => e.modelId === modelId && !isExpired(e, now),
  )

  if (candidates.length === 0) {
    await saveCache({ ...data, totalMisses: data.totalMisses + 1 })
    return null
  }

  // Check exact match first
  const exact = candidates.find((e) => e.prompt === prompt)
  if (exact) {
    const updatedEntries = data.entries.map((e) =>
      e === exact ? { ...e, hitCount: e.hitCount + 1 } : e,
    )
    await saveCache({
      ...data,
      entries: updatedEntries,
      totalHits: data.totalHits + 1,
    })
    return { ...exact, hitCount: exact.hitCount + 1 }
  }

  // BM25 similarity search
  const queryTokens = tokenize(prompt)
  const docs = candidates.map((e, i) => ({
    id: String(i),
    tokens: tokenize(e.prompt),
    length: tokenize(e.prompt).length,
  }))

  const index = buildBM25Index(docs)

  let bestScore = 0
  let bestIdx = -1

  for (let i = 0; i < docs.length; i++) {
    const score = scoreBM25(docs[i], queryTokens, index)
    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  }

  if (bestScore >= threshold && bestIdx >= 0) {
    const matched = candidates[bestIdx]
    const updatedEntries = data.entries.map((e) =>
      e === matched ? { ...e, hitCount: e.hitCount + 1 } : e,
    )
    await saveCache({
      ...data,
      entries: updatedEntries,
      totalHits: data.totalHits + 1,
    })
    return { ...matched, hitCount: matched.hitCount + 1 }
  }

  await saveCache({ ...data, totalMisses: data.totalMisses + 1 })
  return null
}

/** Clean expired cache entries, return number deleted */
export async function cleanExpiredCache(): Promise<number> {
  const data = await loadCache()
  const now = Date.now()

  const valid = data.entries.filter((e) => !isExpired(e, now))
  const deletedCount = data.entries.length - valid.length

  if (deletedCount > 0) {
    await saveCache({ ...data, entries: valid })
  }

  return deletedCount
}

/** Get cache statistics */
export async function getCacheStats(): Promise<CacheStats> {
  const data = await loadCache()

  const totalRequests = data.totalHits + data.totalMisses
  const hitRate = totalRequests > 0 ? data.totalHits / totalRequests : 0

  const estimatedTokensSaved = data.entries.reduce(
    (sum, e) => sum + e.hitCount * estimateTokens(e.response),
    0,
  )

  return {
    totalEntries: data.entries.length,
    totalHits: data.totalHits,
    totalMisses: data.totalMisses,
    hitRate,
    estimatedTokensSaved,
  }
}
