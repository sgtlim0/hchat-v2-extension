import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SK } from '../storageKeys'
import {
  trackUsage,
  getTopUsed,
  getPreferences,
  resetPreferences,
  isRecommended,
  type UserPreferences,
} from '../userPreferences'
import { Storage } from '../storage'

beforeEach(async () => {
  await chrome.storage.local.clear()
})

const DAY_MS = 86_400_000

function mockDateNow(timestamp: number) {
  return vi.spyOn(Date, 'now').mockReturnValue(timestamp)
}

describe('trackUsage', () => {
  it('tracks new assistant usage', async () => {
    await trackUsage('assistant', 'ast-1')
    const top = await getTopUsed('assistant')
    expect(top).toHaveLength(1)
    expect(top[0].id).toBe('ast-1')
    expect(top[0].count).toBe(1)
  })

  it('increments existing assistant count', async () => {
    await trackUsage('assistant', 'ast-1')
    await trackUsage('assistant', 'ast-1')
    await trackUsage('assistant', 'ast-1')
    const top = await getTopUsed('assistant')
    expect(top[0].count).toBe(3)
  })

  it('tracks model usage', async () => {
    await trackUsage('model', 'claude-sonnet')
    const top = await getTopUsed('model')
    expect(top).toHaveLength(1)
    expect(top[0].id).toBe('claude-sonnet')
  })

  it('tracks tool usage', async () => {
    await trackUsage('tool', 'summarize')
    const top = await getTopUsed('tool')
    expect(top).toHaveLength(1)
    expect(top[0].id).toBe('summarize')
  })

  it('tracks multiple items in same category', async () => {
    await trackUsage('assistant', 'ast-1')
    await trackUsage('assistant', 'ast-2')
    await trackUsage('assistant', 'ast-3')
    const top = await getTopUsed('assistant')
    expect(top).toHaveLength(3)
  })

  it('updates lastUsed timestamp', async () => {
    const t1 = 1_000_000
    const t2 = 2_000_000
    const spy = mockDateNow(t1)
    await trackUsage('assistant', 'ast-1')

    spy.mockReturnValue(t2)
    await trackUsage('assistant', 'ast-1')

    const top = await getTopUsed('assistant')
    expect(top[0].lastUsed).toBe(t2)
    spy.mockRestore()
  })

  it('prunes when exceeding 50 entries', async () => {
    for (let i = 0; i < 55; i++) {
      await trackUsage('tool', `tool-${i}`)
    }
    const prefs = await getPreferences()
    expect(prefs.toolFreq.length).toBeLessThanOrEqual(50)
  })

  it('handles concurrent tracks', async () => {
    await Promise.all([
      trackUsage('assistant', 'a'),
      trackUsage('assistant', 'b'),
      trackUsage('assistant', 'c'),
    ])
    const top = await getTopUsed('assistant')
    // At least some entries should be tracked (exact result depends on race condition)
    expect(top.length).toBeGreaterThanOrEqual(1)
  })
})

describe('getTopUsed', () => {
  it('returns empty array initially', async () => {
    const top = await getTopUsed('assistant')
    expect(top).toEqual([])
  })

  it('returns sorted by count descending', async () => {
    await trackUsage('tool', 'a')
    await trackUsage('tool', 'b')
    await trackUsage('tool', 'b')
    await trackUsage('tool', 'c')
    await trackUsage('tool', 'c')
    await trackUsage('tool', 'c')

    const top = await getTopUsed('tool')
    expect(top[0].id).toBe('c')
    expect(top[1].id).toBe('b')
    expect(top[2].id).toBe('a')
  })

  it('respects limit parameter', async () => {
    for (let i = 0; i < 10; i++) {
      await trackUsage('model', `model-${i}`)
    }
    const top = await getTopUsed('model', 3)
    expect(top).toHaveLength(3)
  })

  it('default limit is 5', async () => {
    for (let i = 0; i < 10; i++) {
      await trackUsage('model', `model-${i}`)
    }
    const top = await getTopUsed('model')
    expect(top).toHaveLength(5)
  })

  it('applies time-decay for old entries', async () => {
    const now = Date.now()
    const spy = mockDateNow(now - 10 * DAY_MS)
    await trackUsage('tool', 'old-tool')
    await trackUsage('tool', 'old-tool')
    await trackUsage('tool', 'old-tool')
    await trackUsage('tool', 'old-tool')
    await trackUsage('tool', 'old-tool')
    // old-tool: raw count 5

    spy.mockReturnValue(now)
    await trackUsage('tool', 'new-tool')
    await trackUsage('tool', 'new-tool')
    // new-tool: raw count 2

    const top = await getTopUsed('tool')
    // old-tool weighted: 5 * 0.3 = 1.5, new-tool weighted: 2 * 1.0 = 2
    expect(top[0].id).toBe('new-tool')
    expect(top[1].id).toBe('old-tool')
    spy.mockRestore()
  })

  it('recent entries weighted at full value', async () => {
    const now = Date.now()
    const spy = mockDateNow(now - 3 * DAY_MS) // 3 days ago = recent
    await trackUsage('tool', 'recent-tool')
    await trackUsage('tool', 'recent-tool')

    spy.mockReturnValue(now)
    const top = await getTopUsed('tool')
    // 3-day-old entry: weight 1.0 (within 7 days)
    expect(top[0].count).toBe(2)
    spy.mockRestore()
  })

  it('handles single entry', async () => {
    await trackUsage('assistant', 'solo')
    const top = await getTopUsed('assistant')
    expect(top).toHaveLength(1)
    expect(top[0].id).toBe('solo')
  })

  it('sorts mixed recent/old entries correctly', async () => {
    const now = Date.now()
    const spy = mockDateNow(now - 15 * DAY_MS)
    // Track old entries with high count
    for (let i = 0; i < 10; i++) {
      await trackUsage('tool', 'old')
    }
    spy.mockReturnValue(now)
    // Track recent entries with lower count
    for (let i = 0; i < 4; i++) {
      await trackUsage('tool', 'recent')
    }

    const top = await getTopUsed('tool')
    // recent: 4 * 1.0 = 4, old: 10 * 0.3 = 3
    expect(top[0].id).toBe('recent')
    expect(top[1].id).toBe('old')
    spy.mockRestore()
  })
})

describe('getPreferences', () => {
  it('returns defaults when empty', async () => {
    const prefs = await getPreferences()
    expect(prefs.assistantFreq).toEqual([])
    expect(prefs.modelFreq).toEqual([])
    expect(prefs.toolFreq).toEqual([])
    expect(typeof prefs.updatedAt).toBe('number')
  })

  it('returns all categories', async () => {
    await trackUsage('assistant', 'a')
    await trackUsage('model', 'm')
    await trackUsage('tool', 't')
    const prefs = await getPreferences()
    expect(prefs.assistantFreq).toHaveLength(1)
    expect(prefs.modelFreq).toHaveLength(1)
    expect(prefs.toolFreq).toHaveLength(1)
  })

  it('includes updatedAt', async () => {
    const now = 1_700_000_000_000
    const spy = mockDateNow(now)
    await trackUsage('assistant', 'a')
    const prefs = await getPreferences()
    expect(prefs.updatedAt).toBe(now)
    spy.mockRestore()
  })

  it('returns correctly after multiple tracks', async () => {
    await trackUsage('assistant', 'a')
    await trackUsage('assistant', 'a')
    await trackUsage('assistant', 'b')
    const prefs = await getPreferences()
    const entryA = prefs.assistantFreq.find((e) => e.id === 'a')
    const entryB = prefs.assistantFreq.find((e) => e.id === 'b')
    expect(entryA?.count).toBe(2)
    expect(entryB?.count).toBe(1)
  })
})

describe('resetPreferences', () => {
  it('clears all data', async () => {
    await trackUsage('assistant', 'a')
    await trackUsage('model', 'm')
    await trackUsage('tool', 't')
    await resetPreferences()
    const prefs = await getPreferences()
    expect(prefs.assistantFreq).toEqual([])
    expect(prefs.modelFreq).toEqual([])
    expect(prefs.toolFreq).toEqual([])
  })

  it('returns empty after reset', async () => {
    await trackUsage('tool', 'x')
    await resetPreferences()
    const top = await getTopUsed('tool')
    expect(top).toEqual([])
  })

  it('allows tracking after reset', async () => {
    await trackUsage('assistant', 'a')
    await resetPreferences()
    await trackUsage('assistant', 'b')
    const top = await getTopUsed('assistant')
    expect(top).toHaveLength(1)
    expect(top[0].id).toBe('b')
  })
})

describe('isRecommended', () => {
  it('returns false when empty', async () => {
    const result = await isRecommended('assistant', 'any')
    expect(result).toBe(false)
  })

  it('returns true for top 3', async () => {
    await trackUsage('tool', 'a')
    await trackUsage('tool', 'a')
    await trackUsage('tool', 'a')
    await trackUsage('tool', 'b')
    await trackUsage('tool', 'b')
    await trackUsage('tool', 'c')

    expect(await isRecommended('tool', 'a')).toBe(true)
    expect(await isRecommended('tool', 'b')).toBe(true)
    expect(await isRecommended('tool', 'c')).toBe(true)
  })

  it('returns false for rank 4+', async () => {
    await trackUsage('tool', 'a')
    await trackUsage('tool', 'a')
    await trackUsage('tool', 'a')
    await trackUsage('tool', 'a')
    await trackUsage('tool', 'b')
    await trackUsage('tool', 'b')
    await trackUsage('tool', 'b')
    await trackUsage('tool', 'c')
    await trackUsage('tool', 'c')
    await trackUsage('tool', 'd')

    expect(await isRecommended('tool', 'a')).toBe(true)
    expect(await isRecommended('tool', 'b')).toBe(true)
    expect(await isRecommended('tool', 'c')).toBe(true)
    expect(await isRecommended('tool', 'd')).toBe(false)
  })

  it('works across categories independently', async () => {
    await trackUsage('assistant', 'a')
    await trackUsage('model', 'a')

    expect(await isRecommended('assistant', 'a')).toBe(true)
    expect(await isRecommended('model', 'a')).toBe(true)
    expect(await isRecommended('tool', 'a')).toBe(false)
  })

  it('handles ties by lastUsed', async () => {
    const now = Date.now()
    const spy = mockDateNow(now - 1000)
    await trackUsage('tool', 'older')

    spy.mockReturnValue(now)
    await trackUsage('tool', 'newer')

    const top = await getTopUsed('tool', 3)
    // Both have count 1, newer should come first (more recent lastUsed)
    expect(top[0].id).toBe('newer')
    expect(top[1].id).toBe('older')
    spy.mockRestore()
  })

  it('updates after new tracking', async () => {
    await trackUsage('tool', 'a')
    await trackUsage('tool', 'b')
    await trackUsage('tool', 'c')
    await trackUsage('tool', 'd')

    expect(await isRecommended('tool', 'd')).toBe(false)

    // Boost d to top
    await trackUsage('tool', 'd')
    await trackUsage('tool', 'd')
    await trackUsage('tool', 'd')
    await trackUsage('tool', 'd')

    expect(await isRecommended('tool', 'd')).toBe(true)
  })
})

describe('Time decay', () => {
  it('7-day-old entry gets full weight', async () => {
    const now = Date.now()
    const spy = mockDateNow(now - 7 * DAY_MS)
    await trackUsage('tool', 'week-old')
    await trackUsage('tool', 'week-old')
    await trackUsage('tool', 'week-old')

    spy.mockReturnValue(now)
    const top = await getTopUsed('tool')
    expect(top[0].count).toBe(3) // full weight
    spy.mockRestore()
  })

  it('8-day-old entry gets 0.3 weight', async () => {
    const now = Date.now()
    const spy = mockDateNow(now - 8 * DAY_MS)
    await trackUsage('tool', 'old')
    await trackUsage('tool', 'old')
    await trackUsage('tool', 'old')
    await trackUsage('tool', 'old')
    await trackUsage('tool', 'old')
    await trackUsage('tool', 'old')
    await trackUsage('tool', 'old')
    await trackUsage('tool', 'old')
    await trackUsage('tool', 'old')
    await trackUsage('tool', 'old')

    spy.mockReturnValue(now)
    const top = await getTopUsed('tool')
    // 10 * 0.3 = 3
    expect(top[0].count).toBeCloseTo(3, 1)
    spy.mockRestore()
  })

  it('30-day-old entry gets 0.3 weight', async () => {
    const now = Date.now()
    const spy = mockDateNow(now - 30 * DAY_MS)
    await trackUsage('tool', 'month-old')
    await trackUsage('tool', 'month-old')

    spy.mockReturnValue(now)
    const top = await getTopUsed('tool')
    expect(top[0].count).toBeCloseTo(0.6, 1)
    spy.mockRestore()
  })

  it('31-day-old entry is pruned', async () => {
    const now = Date.now()
    const spy = mockDateNow(now - 31 * DAY_MS)
    await trackUsage('tool', 'expired')

    spy.mockReturnValue(now)
    const top = await getTopUsed('tool')
    expect(top).toEqual([])
    spy.mockRestore()
  })

  it('mixed ages sorted correctly', async () => {
    const now = Date.now()
    const spy = mockDateNow(now - 20 * DAY_MS)
    for (let i = 0; i < 10; i++) {
      await trackUsage('tool', 'old-high')
    }

    spy.mockReturnValue(now - 2 * DAY_MS)
    for (let i = 0; i < 2; i++) {
      await trackUsage('tool', 'recent-low')
    }

    spy.mockReturnValue(now)
    const top = await getTopUsed('tool')
    // old-high: 10 * 0.3 = 3, recent-low: 2 * 1.0 = 2
    expect(top[0].id).toBe('old-high')
    expect(top[1].id).toBe('recent-low')
    spy.mockRestore()
  })

  it('fresh entry beats old entry with higher raw count', async () => {
    const now = Date.now()
    const spy = mockDateNow(now - 15 * DAY_MS)
    for (let i = 0; i < 6; i++) {
      await trackUsage('tool', 'old')
    }
    // old: raw 6, weighted 6 * 0.3 = 1.8

    spy.mockReturnValue(now)
    await trackUsage('tool', 'fresh')
    await trackUsage('tool', 'fresh')
    // fresh: raw 2, weighted 2 * 1.0 = 2.0

    const top = await getTopUsed('tool')
    expect(top[0].id).toBe('fresh')
    expect(top[1].id).toBe('old')
    spy.mockRestore()
  })
})

describe('Edge cases', () => {
  it('handles empty string id', async () => {
    await trackUsage('assistant', '')
    const top = await getTopUsed('assistant')
    expect(top).toHaveLength(1)
    expect(top[0].id).toBe('')
  })

  it('handles very long id', async () => {
    const longId = 'x'.repeat(1000)
    await trackUsage('model', longId)
    const top = await getTopUsed('model')
    expect(top[0].id).toBe(longId)
  })

  it('handles special characters in id', async () => {
    const specialId = '한글-テスト/special@#$%^&*()'
    await trackUsage('tool', specialId)
    const top = await getTopUsed('tool')
    expect(top[0].id).toBe(specialId)
  })

  it('handles corrupted storage data', async () => {
    await Storage.set(SK.USER_PREFS, { broken: true })
    const prefs = await getPreferences()
    expect(prefs.assistantFreq).toEqual([])
    expect(prefs.modelFreq).toEqual([])
    expect(prefs.toolFreq).toEqual([])
  })

  it('handles concurrent operations gracefully', async () => {
    const operations = Array.from({ length: 10 }, (_, i) =>
      trackUsage('assistant', `item-${i % 3}`),
    )
    await Promise.all(operations)
    const top = await getTopUsed('assistant')
    expect(top.length).toBeGreaterThanOrEqual(1)
    expect(top.length).toBeLessThanOrEqual(3)
  })
})
