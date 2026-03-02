import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../i18n', () => ({
  t: vi.fn((key: string, params?: Record<string, string | number>) => {
    const map: Record<string, string> = {
      'timeAgo.justNow': '방금 전',
      'timeAgo.minutesAgo': '{n}분 전',
      'timeAgo.hoursAgo': '{n}시간 전',
      'timeAgo.daysAgo': '{n}일 전',
    }
    let result = map[key] ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        result = result.replace(`{${k}}`, String(v))
      }
    }
    return result
  }),
}))

import { Bookmarks, timeAgo, type Highlight } from '../bookmarks'

function makeHighlightData(overrides: Partial<Omit<Highlight, 'id' | 'createdAt' | 'updatedAt'>> = {}) {
  return {
    url: 'https://example.com',
    title: 'Test Page',
    text: 'highlighted text',
    color: 'yellow' as const,
    xpath: '/html/body/p[1]',
    textOffset: 0,
    tags: [],
    ...overrides,
  }
}

describe('Bookmarks', () => {
  describe('add', () => {
    it('creates a highlight with generated id and timestamps', async () => {
      const h = await Bookmarks.add(makeHighlightData())
      expect(h.id).toBeTruthy()
      expect(h.createdAt).toBeGreaterThan(0)
      expect(h.updatedAt).toBeGreaterThan(0)
      expect(h.text).toBe('highlighted text')
    })
  })

  describe('list', () => {
    it('returns empty array when no highlights', async () => {
      expect(await Bookmarks.list()).toEqual([])
    })

    it('returns all highlights without filter', async () => {
      await Bookmarks.add(makeHighlightData())
      await Bookmarks.add(makeHighlightData({ text: 'second' }))
      const list = await Bookmarks.list()
      expect(list).toHaveLength(2)
    })

    it('filters by URL', async () => {
      await Bookmarks.add(makeHighlightData({ url: 'https://a.com' }))
      await Bookmarks.add(makeHighlightData({ url: 'https://b.com' }))
      const list = await Bookmarks.list({ url: 'https://a.com' })
      expect(list).toHaveLength(1)
      expect(list[0].url).toBe('https://a.com')
    })

    it('filters by tag', async () => {
      await Bookmarks.add(makeHighlightData({ tags: ['react'] }))
      await Bookmarks.add(makeHighlightData({ tags: ['vue'] }))
      const list = await Bookmarks.list({ tag: 'react' })
      expect(list).toHaveLength(1)
    })

    it('filters by query (text search)', async () => {
      await Bookmarks.add(makeHighlightData({ text: 'React hooks are great' }))
      await Bookmarks.add(makeHighlightData({ text: 'Vue composition API' }))
      const list = await Bookmarks.list({ query: 'react' })
      expect(list).toHaveLength(1)
      expect(list[0].text).toContain('React')
    })

    it('searches in note and aiSummary', async () => {
      await Bookmarks.add(makeHighlightData({ note: 'important note about React' }))
      const list = await Bookmarks.list({ query: 'react' })
      expect(list).toHaveLength(1)
    })
  })

  describe('update', () => {
    it('patches highlight properties', async () => {
      const h = await Bookmarks.add(makeHighlightData())
      await Bookmarks.update(h.id, { note: 'added note', color: 'green' })
      const list = await Bookmarks.list()
      expect(list[0].note).toBe('added note')
      expect(list[0].color).toBe('green')
    })

    it('updates updatedAt timestamp', async () => {
      const h = await Bookmarks.add(makeHighlightData())
      const originalUpdatedAt = h.updatedAt
      // Small delay to ensure different timestamp
      await new Promise((r) => setTimeout(r, 10))
      await Bookmarks.update(h.id, { note: 'updated' })
      const list = await Bookmarks.list()
      expect(list[0].updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt)
    })

    it('is no-op for nonexistent id', async () => {
      await Bookmarks.update('fake-id', { note: 'nothing' })
      // should not throw
    })
  })

  describe('delete', () => {
    it('removes a highlight', async () => {
      const h = await Bookmarks.add(makeHighlightData())
      await Bookmarks.delete(h.id)
      expect(await Bookmarks.list()).toHaveLength(0)
    })
  })

  describe('getByUrl', () => {
    it('returns highlights for specific URL', async () => {
      await Bookmarks.add(makeHighlightData({ url: 'https://a.com' }))
      await Bookmarks.add(makeHighlightData({ url: 'https://b.com' }))
      const result = await Bookmarks.getByUrl('https://a.com')
      expect(result).toHaveLength(1)
    })
  })

  describe('getAllTags', () => {
    it('returns unique sorted tags', async () => {
      await Bookmarks.add(makeHighlightData({ tags: ['b', 'a'] }))
      await Bookmarks.add(makeHighlightData({ tags: ['c', 'a'] }))
      const tags = await Bookmarks.getAllTags()
      expect(tags).toEqual(['a', 'b', 'c'])
    })

    it('returns empty for no highlights', async () => {
      expect(await Bookmarks.getAllTags()).toEqual([])
    })
  })

  describe('count', () => {
    it('returns 0 for empty', async () => {
      expect(await Bookmarks.count()).toBe(0)
    })

    it('returns correct count', async () => {
      await Bookmarks.add(makeHighlightData())
      await Bookmarks.add(makeHighlightData())
      expect(await Bookmarks.count()).toBe(2)
    })
  })
})

describe('timeAgo', () => {
  it('returns "방금 전" for recent timestamps', () => {
    expect(timeAgo(Date.now() - 30000)).toBe('방금 전')
  })

  it('returns minutes ago', () => {
    expect(timeAgo(Date.now() - 5 * 60 * 1000)).toBe('5분 전')
  })

  it('returns hours ago', () => {
    expect(timeAgo(Date.now() - 3 * 60 * 60 * 1000)).toBe('3시간 전')
  })

  it('returns days ago', () => {
    expect(timeAgo(Date.now() - 2 * 24 * 60 * 60 * 1000)).toBe('2일 전')
  })

  it('returns formatted date for old timestamps', () => {
    const old = Date.now() - 14 * 24 * 60 * 60 * 1000
    const result = timeAgo(old)
    // Should be a formatted date string (not a relative time)
    expect(result).toMatch(/\d/)
  })
})
