import { describe, it, expect, vi } from 'vitest'
import { Usage, estimateTokens, formatCost, formatTokens, exportUsageAsCSV, type UsageRecord } from '../usage'

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

describe('exportUsageAsCSV', () => {
  it('returns header only for empty records', () => {
    const csv = exportUsageAsCSV([])
    expect(csv).toBe('Date,Provider,Model,InputTokens,OutputTokens,Requests,Cost(USD),Feature')
  })

  it('formats records as CSV rows', () => {
    const records: UsageRecord[] = [
      { date: '2026-03-01', provider: 'bedrock', model: 'claude-sonnet-4-6', inputTokens: 100, outputTokens: 50, requests: 3, estimatedCost: 0.001075, feature: 'chat' },
      { date: '2026-03-02', provider: 'openai', model: 'gpt-4o', inputTokens: 200, outputTokens: 100, requests: 1, estimatedCost: 0.0015 },
    ]
    const csv = exportUsageAsCSV(records)
    const lines = csv.split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe('Date,Provider,Model,InputTokens,OutputTokens,Requests,Cost(USD),Feature')
    expect(lines[1]).toContain('2026-03-01')
    expect(lines[1]).toContain('bedrock')
    expect(lines[1]).toContain('chat')
    expect(lines[2]).toContain('gpt-4o')
    expect(lines[2].endsWith(',')).toBe(true)  // empty feature
  })

  it('formats cost to 6 decimal places', () => {
    const records: UsageRecord[] = [
      { date: '2026-03-01', provider: 'openai', model: 'gpt-4o', inputTokens: 10, outputTokens: 5, requests: 1, estimatedCost: 0.000123 },
    ]
    const csv = exportUsageAsCSV(records)
    expect(csv).toContain('0.000123')
  })
})
