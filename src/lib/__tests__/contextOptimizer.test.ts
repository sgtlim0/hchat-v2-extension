import { describe, it, expect } from 'vitest'
import type { ChatMessage } from '../chatHistory'
import {
  estimateTokens,
  estimateMessagesTokens,
  compressMessages,
  calculatePromptBudget,
  getContextUsage,
} from '../contextOptimizer'

// --- Helper ---

function makeMessage(
  overrides: Partial<ChatMessage> & { content: string },
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'user',
    ts: Date.now(),
    ...overrides,
  }
}

// === estimateTokens ===

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('estimates English text at ~4 chars per token', () => {
    const text = 'Hello world test' // 16 chars → 4 tokens
    expect(estimateTokens(text)).toBe(4)
  })

  it('estimates Korean text at ~2 chars per token', () => {
    const text = '안녕하세요테스트' // 8 Korean chars → 4 tokens
    expect(estimateTokens(text)).toBe(4)
  })

  it('estimates mixed Korean and English text', () => {
    // '안녕' = 2 Korean chars → 1 token, 'hello' = 5 English chars → ceil(5/4)=2 tokens → total ~3
    const text = '안녕hello'
    const tokens = estimateTokens(text)
    expect(tokens).toBeGreaterThan(0)
    expect(tokens).toBe(3)
  })

  it('handles whitespace-only text', () => {
    expect(estimateTokens('    ')).toBe(1) // 4 chars / 4
  })
})

// === estimateMessagesTokens ===

describe('estimateMessagesTokens', () => {
  it('returns 0 for empty array', () => {
    expect(estimateMessagesTokens([])).toBe(0)
  })

  it('counts tokens for a single message', () => {
    const messages = [makeMessage({ content: 'Hello world test' })]
    expect(estimateMessagesTokens(messages)).toBe(4)
  })

  it('sums tokens for multiple messages', () => {
    const messages = [
      makeMessage({ content: 'Hello world test' }), // 4
      makeMessage({ content: '안녕하세요테스트', role: 'assistant' }), // 4
    ]
    expect(estimateMessagesTokens(messages)).toBe(8)
  })

  it('handles messages with empty content', () => {
    const messages = [
      makeMessage({ content: '' }),
      makeMessage({ content: 'test' }), // 1
    ]
    expect(estimateMessagesTokens(messages)).toBe(1)
  })
})

// === compressMessages ===

describe('compressMessages', () => {
  it('returns empty array for empty input', () => {
    expect(compressMessages([], 100)).toEqual([])
  })

  it('returns all messages when within token budget', () => {
    const messages = [
      makeMessage({ content: 'Hi', ts: 1 }),
      makeMessage({ content: 'Hello', role: 'assistant', ts: 2 }),
    ]
    const result = compressMessages(messages, 1000)
    expect(result).toHaveLength(2)
  })

  it('keeps most recent messages when exceeding budget', () => {
    const messages = [
      makeMessage({ content: 'a'.repeat(400), ts: 1 }), // 100 tokens
      makeMessage({ content: 'b'.repeat(400), ts: 2 }), // 100 tokens
      makeMessage({ content: 'c'.repeat(40), ts: 3 }),   // 10 tokens
    ]
    // Budget of 20 tokens → only last message fits
    const result = compressMessages(messages, 20)
    expect(result).toHaveLength(1)
    expect(result[0].content).toBe('c'.repeat(40))
  })

  it('always includes pinned messages regardless of budget', () => {
    const messages = [
      makeMessage({ content: 'a'.repeat(400), ts: 1, pinned: true }), // 100 tokens, pinned
      makeMessage({ content: 'b'.repeat(400), ts: 2 }), // 100 tokens
      makeMessage({ content: 'c'.repeat(40), ts: 3 }),   // 10 tokens
    ]
    // Budget of 120 → pinned (100) + last (10) = 110, fits; middle dropped
    const result = compressMessages(messages, 120)
    expect(result.some((m) => m.pinned)).toBe(true)
    expect(result).toHaveLength(2)
    expect(result[0].content).toBe('a'.repeat(400)) // pinned first
    expect(result[1].content).toBe('c'.repeat(40))  // most recent
  })

  it('preserves original message order in output', () => {
    const messages = [
      makeMessage({ content: 'first', ts: 1, pinned: true }),
      makeMessage({ content: 'second', ts: 2 }),
      makeMessage({ content: 'third', ts: 3 }),
    ]
    const result = compressMessages(messages, 1000)
    expect(result[0].ts).toBeLessThan(result[1].ts)
    expect(result[1].ts).toBeLessThan(result[2].ts)
  })
})

// === calculatePromptBudget ===

describe('calculatePromptBudget', () => {
  it('calculates budget with default reserved response tokens', () => {
    const budget = calculatePromptBudget(128000)
    // systemBudget: 20% of (128000 - 4096), messageBudget: 80% of (128000 - 4096)
    const available = 128000 - 4096
    expect(budget.systemBudget).toBe(Math.floor(available * 0.2))
    expect(budget.messageBudget).toBe(Math.floor(available * 0.8))
  })

  it('calculates budget with custom reserved response', () => {
    const budget = calculatePromptBudget(100000, 8000)
    const available = 100000 - 8000
    expect(budget.systemBudget).toBe(Math.floor(available * 0.2))
    expect(budget.messageBudget).toBe(Math.floor(available * 0.8))
  })

  it('handles small context window', () => {
    const budget = calculatePromptBudget(8000, 2000)
    const available = 8000 - 2000
    expect(budget.systemBudget).toBe(Math.floor(available * 0.2))
    expect(budget.messageBudget).toBe(Math.floor(available * 0.8))
  })

  it('returns zero budgets when reserved exceeds context window', () => {
    const budget = calculatePromptBudget(4000, 5000)
    expect(budget.systemBudget).toBe(0)
    expect(budget.messageBudget).toBe(0)
  })
})

// === getContextUsage ===

describe('getContextUsage', () => {
  it('returns low usage with few messages', () => {
    const messages = [makeMessage({ content: 'Hi' })]
    const usage = getContextUsage(messages, 128000)
    expect(usage.used).toBeGreaterThan(0)
    expect(usage.total).toBe(128000)
    expect(usage.percentage).toBeLessThan(1)
    expect(usage.warning).toBe(false)
  })

  it('sets warning to true when percentage exceeds 80%', () => {
    // 128000 * 0.81 ≈ 103680 tokens needed
    // 103680 tokens * 4 chars = 414720 English chars
    const bigContent = 'a'.repeat(414720)
    const messages = [makeMessage({ content: bigContent })]
    const usage = getContextUsage(messages, 128000)
    expect(usage.percentage).toBeGreaterThan(80)
    expect(usage.warning).toBe(true)
  })

  it('handles 100% exceeded context', () => {
    const hugeContent = 'a'.repeat(600000) // 150000 tokens
    const messages = [makeMessage({ content: hugeContent })]
    const usage = getContextUsage(messages, 128000)
    expect(usage.percentage).toBeGreaterThan(100)
    expect(usage.warning).toBe(true)
  })

  it('returns 0% for empty messages', () => {
    const usage = getContextUsage([], 128000)
    expect(usage.used).toBe(0)
    expect(usage.percentage).toBe(0)
    expect(usage.warning).toBe(false)
  })
})

// === Edge cases ===

describe('edge cases', () => {
  it('handles undefined content gracefully in estimateTokens', () => {
    const msg = makeMessage({ content: '' })
    // @ts-expect-error — testing runtime safety for undefined content
    msg.content = undefined
    expect(estimateMessagesTokens([msg])).toBe(0)
  })

  it('handles null content gracefully in estimateTokens', () => {
    const msg = makeMessage({ content: '' })
    // @ts-expect-error — testing runtime safety for null content
    msg.content = null
    expect(estimateMessagesTokens([msg])).toBe(0)
  })

  it('handles very long message in compressMessages', () => {
    const longMsg = makeMessage({ content: 'a'.repeat(100000), ts: 1 })
    const result = compressMessages([longMsg], 50)
    // Single message exceeds budget but still returned (at least 1 message)
    expect(result).toHaveLength(1)
  })

  it('handles compressMessages with all pinned exceeding budget', () => {
    const messages = [
      makeMessage({ content: 'a'.repeat(400), ts: 1, pinned: true }),
      makeMessage({ content: 'b'.repeat(400), ts: 2, pinned: true }),
    ]
    // Budget is tiny but both are pinned — all pinned are always included
    const result = compressMessages(messages, 10)
    expect(result).toHaveLength(2)
  })
})
