import { describe, it, expect, vi } from 'vitest'
import { Usage, estimateTokens, formatCost, formatTokens } from '../usage'

describe('estimateTokens', () => {
  it('estimates English text (~4 chars per token)', () => {
    const result = estimateTokens('Hello World')
    // 11 chars / 4 ≈ 3
    expect(result).toBe(3)
  })

  it('estimates Korean text (~2 chars per token)', () => {
    const result = estimateTokens('안녕하세요')
    // 5 Korean chars / 2 = 2.5 → 3
    expect(result).toBe(3)
  })

  it('handles mixed text', () => {
    const result = estimateTokens('Hello 안녕')
    // 6 other chars / 4 + 2 Korean chars / 2 = 1.5 + 1 = 2.5 → 3
    expect(result).toBe(3)
  })

  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })
})

describe('formatCost', () => {
  it('returns "< $0.01" for tiny amounts', () => {
    expect(formatCost(0.001)).toBe('< $0.01')
    expect(formatCost(0)).toBe('< $0.01')
  })

  it('formats to 2 decimal places', () => {
    expect(formatCost(1.5)).toBe('$1.50')
    expect(formatCost(0.12)).toBe('$0.12')
    expect(formatCost(99.999)).toBe('$100.00')
  })
})

describe('formatTokens', () => {
  it('returns raw number under 1000', () => {
    expect(formatTokens(500)).toBe('500')
    expect(formatTokens(0)).toBe('0')
    expect(formatTokens(999)).toBe('999')
  })

  it('formats thousands with K', () => {
    expect(formatTokens(1000)).toBe('1.0K')
    expect(formatTokens(1500)).toBe('1.5K')
    expect(formatTokens(999999)).toBe('1000.0K')
  })

  it('formats millions with M', () => {
    expect(formatTokens(1_000_000)).toBe('1.00M')
    expect(formatTokens(2_500_000)).toBe('2.50M')
  })
})

describe('Usage', () => {
  describe('getRecords', () => {
    it('returns empty array initially', async () => {
      expect(await Usage.getRecords()).toEqual([])
    })
  })

  describe('track', () => {
    it('creates a new record for today', async () => {
      await Usage.track('claude-sonnet-4-6', 'bedrock', 'hello', 'world')
      const records = await Usage.getRecords()
      expect(records).toHaveLength(1)
      expect(records[0].model).toBe('claude-sonnet-4-6')
      expect(records[0].provider).toBe('bedrock')
      expect(records[0].requests).toBe(1)
      expect(records[0].inputTokens).toBeGreaterThan(0)
      expect(records[0].outputTokens).toBeGreaterThan(0)
    })

    it('aggregates multiple calls for same model/date', async () => {
      await Usage.track('gpt-4o', 'openai', 'input1', 'output1')
      await Usage.track('gpt-4o', 'openai', 'input2', 'output2')
      const records = await Usage.getRecords()
      expect(records).toHaveLength(1)
      expect(records[0].requests).toBe(2)
    })

    it('creates separate records for different models', async () => {
      await Usage.track('gpt-4o', 'openai', 'hi', 'hello')
      await Usage.track('gpt-4o-mini', 'openai', 'hi', 'hello')
      const records = await Usage.getRecords()
      expect(records).toHaveLength(2)
    })

    it('estimates cost for known models', async () => {
      await Usage.track('claude-sonnet-4-6', 'bedrock', 'a'.repeat(100), 'b'.repeat(100))
      const records = await Usage.getRecords()
      expect(records[0].estimatedCost).toBeGreaterThan(0)
    })

    it('returns 0 cost for unknown models', async () => {
      await Usage.track('unknown-model', 'bedrock', 'hello', 'world')
      const records = await Usage.getRecords()
      expect(records[0].estimatedCost).toBe(0)
    })

    it('tracks feature type', async () => {
      await Usage.track('gpt-4o', 'openai', 'test', 'test', 'agent')
      const records = await Usage.getRecords()
      expect(records[0].feature).toBe('agent')
    })
  })

  describe('getSummary', () => {
    it('returns zeroed summary when no data', async () => {
      const summary = await Usage.getSummary()
      expect(summary.totalRequests).toBe(0)
      expect(summary.totalCost).toBe(0)
      expect(summary.byDate).toEqual([])
    })

    it('calculates summary from records', async () => {
      await Usage.track('gpt-4o', 'openai', 'hello world', 'response here')
      await Usage.track('gpt-4o-mini', 'openai', 'question', 'answer')
      const summary = await Usage.getSummary()
      expect(summary.totalRequests).toBe(2)
      expect(summary.totalInputTokens).toBeGreaterThan(0)
      expect(summary.byProvider['openai']).toBeTruthy()
      expect(summary.byProvider['openai'].requests).toBe(2)
    })

    it('groups by date', async () => {
      await Usage.track('gpt-4o', 'openai', 'q', 'a')
      const summary = await Usage.getSummary()
      expect(summary.byDate).toHaveLength(1)
      expect(summary.byDate[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  describe('clearAll', () => {
    it('removes all records', async () => {
      await Usage.track('gpt-4o', 'openai', 'test', 'test')
      await Usage.clearAll()
      expect(await Usage.getRecords()).toEqual([])
    })
  })
})
