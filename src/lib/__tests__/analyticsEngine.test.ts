import { describe, it, expect } from 'vitest'
import {
  aggregateConversations,
  extractTopics,
  getDailyActivity,
  getHourlyHeatmap,
  compareProviders,
  type ConversationMeta,
} from '../analyticsEngine'

function makeConv(overrides: Partial<ConversationMeta> = {}): ConversationMeta {
  return {
    id: 'conv-1',
    model: 'claude-sonnet-4-6',
    provider: 'bedrock',
    messageCount: 10,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

// --- aggregateConversations ---

describe('aggregateConversations', () => {
  it('returns zeros for empty array', () => {
    const result = aggregateConversations([])

    expect(result.totalConversations).toBe(0)
    expect(result.totalMessages).toBe(0)
    expect(result.byModel).toEqual({})
    expect(result.byProvider).toEqual({})
    expect(result.avgMessagesPerConv).toBe(0)
  })

  it('aggregates a single conversation', () => {
    const conv = makeConv({ messageCount: 8 })
    const result = aggregateConversations([conv])

    expect(result.totalConversations).toBe(1)
    expect(result.totalMessages).toBe(8)
    expect(result.avgMessagesPerConv).toBe(8)
  })

  it('aggregates multiple conversations', () => {
    const convs = [
      makeConv({ id: 'c1', messageCount: 4 }),
      makeConv({ id: 'c2', messageCount: 6 }),
      makeConv({ id: 'c3', messageCount: 10 }),
    ]
    const result = aggregateConversations(convs)

    expect(result.totalConversations).toBe(3)
    expect(result.totalMessages).toBe(20)
    expect(result.avgMessagesPerConv).toBeCloseTo(6.67, 1)
  })

  it('counts by model correctly', () => {
    const convs = [
      makeConv({ id: 'c1', model: 'gpt-4o' }),
      makeConv({ id: 'c2', model: 'gpt-4o' }),
      makeConv({ id: 'c3', model: 'claude-sonnet-4-6' }),
    ]
    const result = aggregateConversations(convs)

    expect(result.byModel['gpt-4o']).toBe(2)
    expect(result.byModel['claude-sonnet-4-6']).toBe(1)
  })

  it('counts by provider correctly', () => {
    const convs = [
      makeConv({ id: 'c1', provider: 'bedrock' }),
      makeConv({ id: 'c2', provider: 'openai' }),
      makeConv({ id: 'c3', provider: 'openai' }),
      makeConv({ id: 'c4', provider: 'gemini' }),
    ]
    const result = aggregateConversations(convs)

    expect(result.byProvider['bedrock']).toBe(1)
    expect(result.byProvider['openai']).toBe(2)
    expect(result.byProvider['gemini']).toBe(1)
  })
})

// --- extractTopics ---

describe('extractTopics', () => {
  it('returns empty array for empty messages', () => {
    const topics = extractTopics([])
    expect(topics).toEqual([])
  })

  it('extracts topics from a single message', () => {
    const topics = extractTopics([{ content: 'TypeScript React development' }])

    expect(topics.length).toBeGreaterThan(0)
    expect(topics[0]).toHaveProperty('word')
    expect(topics[0]).toHaveProperty('score')
  })

  it('filters out Korean stop words', () => {
    const topics = extractTopics([
      { content: '그리고 하지만 프로그래밍 그래서 때문에 알고리즘' },
    ])
    const words = topics.map((t) => t.word)

    expect(words).not.toContain('그리고')
    expect(words).not.toContain('하지만')
    expect(words).not.toContain('그래서')
    expect(words).not.toContain('때문에')
    expect(words).toContain('프로그래밍')
    expect(words).toContain('알고리즘')
  })

  it('respects topK limit', () => {
    const content = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu'
    const topics = extractTopics([{ content }], 3)

    expect(topics).toHaveLength(3)
  })

  it('handles mixed Korean and English content', () => {
    const topics = extractTopics([
      { content: 'React 컴포넌트 설계 패턴' },
      { content: 'React hooks 사용법' },
    ])
    const words = topics.map((t) => t.word)

    expect(words).toContain('react')
  })

  it('scores repeated terms higher', () => {
    const topics = extractTopics([
      { content: 'kubernetes kubernetes kubernetes docker' },
    ])

    const k8s = topics.find((t) => t.word === 'kubernetes')
    const docker = topics.find((t) => t.word === 'docker')

    expect(k8s).toBeDefined()
    expect(docker).toBeDefined()
    expect(k8s!.score).toBeGreaterThanOrEqual(docker!.score)
  })
})

// --- getDailyActivity ---

describe('getDailyActivity', () => {
  it('returns empty array for no conversations', () => {
    const activity = getDailyActivity([])
    expect(activity).toEqual([])
  })

  it('returns correct number of days', () => {
    const now = Date.now()
    const conv = makeConv({ createdAt: now })
    const activity = getDailyActivity([conv], 7)

    expect(activity).toHaveLength(7)
  })

  it('returns 30 days by default', () => {
    const now = Date.now()
    const conv = makeConv({ createdAt: now })
    const activity = getDailyActivity([conv])

    expect(activity).toHaveLength(30)
  })

  it('counts conversations and messages per day', () => {
    const now = Date.now()
    const today = new Date(now)
    today.setHours(12, 0, 0, 0)
    const todayTs = today.getTime()

    const convs = [
      makeConv({ id: 'c1', messageCount: 5, createdAt: todayTs }),
      makeConv({ id: 'c2', messageCount: 3, createdAt: todayTs + 1000 }),
    ]
    const activity = getDailyActivity(convs, 7)

    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const todayStr = `${year}-${month}-${day}`
    const todayEntry = activity.find((a) => a.date === todayStr)

    expect(todayEntry).toBeDefined()
    expect(todayEntry!.conversations).toBe(2)
    expect(todayEntry!.messages).toBe(8)
  })

  it('ignores conversations outside the date range', () => {
    const now = Date.now()
    const oldTs = now - 60 * 86_400_000 // 60 days ago
    const convs = [
      makeConv({ id: 'c1', messageCount: 5, createdAt: oldTs }),
      makeConv({ id: 'c2', messageCount: 3, createdAt: now }),
    ]
    const activity = getDailyActivity(convs, 7)

    const totalConvs = activity.reduce((s, a) => s + a.conversations, 0)
    expect(totalConvs).toBe(1) // only the recent one
  })

  it('returns dates in ascending order', () => {
    const conv = makeConv({ createdAt: Date.now() })
    const activity = getDailyActivity([conv], 7)

    for (let i = 1; i < activity.length; i++) {
      expect(activity[i].date > activity[i - 1].date).toBe(true)
    }
  })
})

// --- getHourlyHeatmap ---

describe('getHourlyHeatmap', () => {
  it('returns 24-element array of zeros for empty data', () => {
    const heatmap = getHourlyHeatmap([])

    expect(heatmap).toHaveLength(24)
    expect(heatmap.every((v) => v === 0)).toBe(true)
  })

  it('always returns exactly 24 elements', () => {
    const conv = makeConv()
    const heatmap = getHourlyHeatmap([conv])

    expect(heatmap).toHaveLength(24)
  })

  it('counts activity in specific hours', () => {
    const base = new Date('2026-03-06T00:00:00')
    // Create conversations at hour 14 (2pm)
    const hour14a = new Date(base)
    hour14a.setHours(14, 10, 0, 0)
    const hour14b = new Date(base)
    hour14b.setHours(14, 30, 0, 0)
    // One at hour 9
    const hour9 = new Date(base)
    hour9.setHours(9, 0, 0, 0)

    const convs = [
      makeConv({ id: 'c1', createdAt: hour14a.getTime() }),
      makeConv({ id: 'c2', createdAt: hour14b.getTime() }),
      makeConv({ id: 'c3', createdAt: hour9.getTime() }),
    ]
    const heatmap = getHourlyHeatmap(convs)

    expect(heatmap[14]).toBe(2)
    expect(heatmap[9]).toBe(1)
    expect(heatmap[0]).toBe(0)
  })
})

// --- compareProviders ---

describe('compareProviders', () => {
  it('returns empty array for no conversations', () => {
    const result = compareProviders([])
    expect(result).toEqual([])
  })

  it('compares a single provider', () => {
    const convs = [
      makeConv({
        id: 'c1',
        provider: 'bedrock',
        messages: [
          { role: 'user', content: 'hello', ts: Date.now() },
          { role: 'assistant', content: 'hi there friend', ts: Date.now() },
        ],
      }),
    ]
    const result = compareProviders(convs)

    expect(result).toHaveLength(1)
    expect(result[0].provider).toBe('bedrock')
    expect(result[0].count).toBe(1)
  })

  it('compares multiple providers', () => {
    const now = Date.now()
    const convs = [
      makeConv({ id: 'c1', provider: 'bedrock', createdAt: now }),
      makeConv({ id: 'c2', provider: 'bedrock', createdAt: now }),
      makeConv({ id: 'c3', provider: 'openai', createdAt: now }),
    ]
    const result = compareProviders(convs)

    expect(result).toHaveLength(2)
    const bedrock = result.find((r) => r.provider === 'bedrock')
    const openai = result.find((r) => r.provider === 'openai')

    expect(bedrock!.count).toBe(2)
    expect(openai!.count).toBe(1)
  })

  it('calculates average response length', () => {
    const convs = [
      makeConv({
        id: 'c1',
        provider: 'openai',
        messages: [
          { role: 'assistant', content: 'short', ts: Date.now() },
          { role: 'assistant', content: 'a longer response here', ts: Date.now() },
        ],
      }),
    ]
    const result = compareProviders(convs)
    const openai = result.find((r) => r.provider === 'openai')

    // avg of 'short' (5) and 'a longer response here' (22) = 13.5
    expect(openai!.avgResponseLength).toBeCloseTo(13.5)
  })

  it('calculates peak hour', () => {
    const base = new Date('2026-03-06T00:00:00')
    const hour10a = new Date(base)
    hour10a.setHours(10, 0, 0, 0)
    const hour10b = new Date(base)
    hour10b.setHours(10, 30, 0, 0)
    const hour15 = new Date(base)
    hour15.setHours(15, 0, 0, 0)

    const convs = [
      makeConv({ id: 'c1', provider: 'gemini', createdAt: hour10a.getTime() }),
      makeConv({ id: 'c2', provider: 'gemini', createdAt: hour10b.getTime() }),
      makeConv({ id: 'c3', provider: 'gemini', createdAt: hour15.getTime() }),
    ]
    const result = compareProviders(convs)
    const gemini = result.find((r) => r.provider === 'gemini')

    expect(gemini!.peakHour).toBe(10)
  })
})
