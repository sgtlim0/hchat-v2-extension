// lib/__tests__/promptCache.test.ts — Tests for prompt cache module

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SK } from '../storageKeys'

vi.mock('../bm25', () => ({
  buildBM25Index: vi.fn(),
  scoreBM25: vi.fn().mockReturnValue(0.85),
  calculateBM25Score: vi.fn().mockReturnValue(0.85),
}))

import {
  cacheResponse,
  findCachedResponse,
  cleanExpiredCache,
  getCacheStats,
  STORAGE_KEY,
  DEFAULT_TTL,
  MAX_ENTRIES,
  type CachedEntry,
  type CacheStats,
  type CacheData,
} from '../promptCache'
import { Storage } from '../storage'

describe('promptCache', () => {
  // ── Constants ──
  describe('constants', () => {
    it('should have correct defaults', () => {
      expect(STORAGE_KEY).toBe(SK.PROMPT_CACHE)
      expect(DEFAULT_TTL).toBe(24 * 60 * 60 * 1000)
      expect(MAX_ENTRIES).toBe(100)
    })
  })

  // ── cacheResponse ──
  describe('cacheResponse', () => {
    it('should save a new entry', async () => {
      await cacheResponse('hello world', 'response text', 'claude-sonnet')

      const data = await Storage.get<CacheData>(STORAGE_KEY)
      expect(data).not.toBeNull()
      expect(data!.entries).toHaveLength(1)
      expect(data!.entries[0].prompt).toBe('hello world')
      expect(data!.entries[0].response).toBe('response text')
      expect(data!.entries[0].modelId).toBe('claude-sonnet')
      expect(data!.entries[0].hitCount).toBe(0)
      expect(data!.entries[0].ttl).toBe(DEFAULT_TTL)
    })

    it('should update existing entry with same prompt and model', async () => {
      await cacheResponse('hello world', 'response 1', 'claude-sonnet')
      await cacheResponse('hello world', 'response 2', 'claude-sonnet')

      const data = await Storage.get<CacheData>(STORAGE_KEY)
      expect(data!.entries).toHaveLength(1)
      expect(data!.entries[0].response).toBe('response 2')
    })
  })

  // ── findCachedResponse ──
  describe('findCachedResponse', () => {
    it('should find exact match', async () => {
      await cacheResponse('hello world', 'cached response', 'claude-sonnet')

      const result = await findCachedResponse('hello world', 'claude-sonnet')
      expect(result).not.toBeNull()
      expect(result!.response).toBe('cached response')
    })

    it('should find similar prompt via BM25 (above threshold)', async () => {
      const { scoreBM25 } = await import('../bm25')
      vi.mocked(scoreBM25).mockReturnValue(0.85)

      await cacheResponse('how to write unit tests', 'use vitest', 'claude-sonnet')

      const result = await findCachedResponse(
        'how to write unit test',
        'claude-sonnet',
        0.8,
      )
      expect(result).not.toBeNull()
      expect(result!.response).toBe('use vitest')
    })

    it('should return null when BM25 score below threshold', async () => {
      const { scoreBM25 } = await import('../bm25')
      vi.mocked(scoreBM25).mockReturnValue(0.3)

      await cacheResponse('hello world', 'cached response', 'claude-sonnet')

      const result = await findCachedResponse(
        'completely different',
        'claude-sonnet',
        0.8,
      )
      expect(result).toBeNull()
    })

    it('should miss when model is different', async () => {
      await cacheResponse('hello world', 'cached response', 'claude-sonnet')

      const result = await findCachedResponse('hello world', 'gpt-4o')
      expect(result).toBeNull()
    })
  })

  // ── cleanExpiredCache ──
  describe('cleanExpiredCache', () => {
    it('should delete expired entries and return count', async () => {
      const now = Date.now()
      const expiredEntry: CachedEntry = {
        prompt: 'old prompt',
        response: 'old response',
        modelId: 'claude-sonnet',
        createdAt: now - DEFAULT_TTL - 1000,
        ttl: DEFAULT_TTL,
        hitCount: 0,
      }
      const validEntry: CachedEntry = {
        prompt: 'new prompt',
        response: 'new response',
        modelId: 'claude-sonnet',
        createdAt: now,
        ttl: DEFAULT_TTL,
        hitCount: 0,
      }

      await Storage.set<CacheData>(STORAGE_KEY, {
        entries: [expiredEntry, validEntry],
        totalHits: 0,
        totalMisses: 0,
      })

      const deleted = await cleanExpiredCache()
      expect(deleted).toBe(1)

      const data = await Storage.get<CacheData>(STORAGE_KEY)
      expect(data!.entries).toHaveLength(1)
      expect(data!.entries[0].prompt).toBe('new prompt')
    })

    it('should keep non-expired entries', async () => {
      const now = Date.now()
      const validEntry: CachedEntry = {
        prompt: 'valid',
        response: 'still good',
        modelId: 'claude-sonnet',
        createdAt: now - 1000,
        ttl: DEFAULT_TTL,
        hitCount: 0,
      }

      await Storage.set<CacheData>(STORAGE_KEY, {
        entries: [validEntry],
        totalHits: 0,
        totalMisses: 0,
      })

      const deleted = await cleanExpiredCache()
      expect(deleted).toBe(0)

      const data = await Storage.get<CacheData>(STORAGE_KEY)
      expect(data!.entries).toHaveLength(1)
    })
  })

  // ── Max entries (FIFO) ──
  describe('max entries FIFO', () => {
    it('should evict oldest entry when exceeding max', async () => {
      const entries: CachedEntry[] = Array.from({ length: MAX_ENTRIES }, (_, i) => ({
        prompt: `prompt-${i}`,
        response: `response-${i}`,
        modelId: 'claude-sonnet',
        createdAt: Date.now() + i,
        ttl: DEFAULT_TTL,
        hitCount: 0,
      }))

      await Storage.set<CacheData>(STORAGE_KEY, {
        entries,
        totalHits: 0,
        totalMisses: 0,
      })

      await cacheResponse('new prompt', 'new response', 'claude-sonnet')

      const data = await Storage.get<CacheData>(STORAGE_KEY)
      expect(data!.entries).toHaveLength(MAX_ENTRIES)
      // oldest (prompt-0) should be evicted
      expect(data!.entries.find((e) => e.prompt === 'prompt-0')).toBeUndefined()
      // newest should be present
      expect(data!.entries.find((e) => e.prompt === 'new prompt')).toBeDefined()
    })
  })

  // ── getCacheStats ──
  describe('getCacheStats', () => {
    it('should return zero stats for empty cache', async () => {
      const stats = await getCacheStats()

      expect(stats.totalEntries).toBe(0)
      expect(stats.totalHits).toBe(0)
      expect(stats.totalMisses).toBe(0)
      expect(stats.hitRate).toBe(0)
      expect(stats.estimatedTokensSaved).toBe(0)
    })

    it('should return correct stats after hits and misses', async () => {
      const { scoreBM25 } = await import('../bm25')
      vi.mocked(scoreBM25).mockReturnValue(0.9)

      await cacheResponse('test prompt', 'test response here with some tokens', 'claude-sonnet')

      // Hit
      await findCachedResponse('test prompt', 'claude-sonnet')

      // Miss (different model)
      await findCachedResponse('test prompt', 'gpt-4o')

      const stats = await getCacheStats()
      expect(stats.totalEntries).toBe(1)
      expect(stats.totalHits).toBe(1)
      expect(stats.totalMisses).toBe(1)
      expect(stats.hitRate).toBe(0.5)
      expect(stats.estimatedTokensSaved).toBeGreaterThan(0)
    })
  })

  // ── TTL ──
  describe('TTL behavior', () => {
    it('should find entry within TTL', async () => {
      const { scoreBM25 } = await import('../bm25')
      vi.mocked(scoreBM25).mockReturnValue(0.9)

      await cacheResponse('hello', 'world', 'claude-sonnet')

      const result = await findCachedResponse('hello', 'claude-sonnet')
      expect(result).not.toBeNull()
    })

    it('should not find entry past TTL', async () => {
      const { scoreBM25 } = await import('../bm25')
      vi.mocked(scoreBM25).mockReturnValue(0.9)

      const now = Date.now()
      const expiredEntry: CachedEntry = {
        prompt: 'hello',
        response: 'world',
        modelId: 'claude-sonnet',
        createdAt: now - DEFAULT_TTL - 1,
        ttl: DEFAULT_TTL,
        hitCount: 0,
      }

      await Storage.set<CacheData>(STORAGE_KEY, {
        entries: [expiredEntry],
        totalHits: 0,
        totalMisses: 0,
      })

      const result = await findCachedResponse('hello', 'claude-sonnet')
      expect(result).toBeNull()
    })
  })

  // ── hitCount ──
  describe('hitCount increment', () => {
    it('should increment hitCount on cache hit', async () => {
      const { scoreBM25 } = await import('../bm25')
      vi.mocked(scoreBM25).mockReturnValue(0.9)

      await cacheResponse('hello', 'world', 'claude-sonnet')

      await findCachedResponse('hello', 'claude-sonnet')
      await findCachedResponse('hello', 'claude-sonnet')

      const data = await Storage.get<CacheData>(STORAGE_KEY)
      expect(data!.entries[0].hitCount).toBe(2)
    })
  })
})
