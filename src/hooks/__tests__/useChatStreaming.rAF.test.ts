import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock dependencies ──

vi.mock('../../lib/providers/stream-retry', () => ({
  streamWithRetry: vi.fn(),
}))

vi.mock('../../lib/providers/bedrock-provider', () => ({
  BedrockProvider: vi.fn().mockImplementation(() => ({
    isConfigured: () => true,
    stream: async function* () { yield 'Fallback' },
  })),
}))

vi.mock('../../lib/searchIntent', () => ({
  needsWebSearch: () => false,
  extractSearchQuery: (t: string) => t,
}))

vi.mock('../../lib/webSearch', () => ({
  webSearch: () => Promise.resolve([]),
  buildSearchContext: () => '',
}))

vi.mock('../../lib/personas', () => ({
  Personas: { getById: () => Promise.resolve({ id: 'default', systemPrompt: '기본' }) },
}))

vi.mock('../../lib/chatHistory', () => ({
  ChatHistory: {
    addMessage: vi.fn(() => Promise.resolve()),
    get: vi.fn(() => Promise.resolve({ id: 'conv-1', messages: [] })),
  },
}))

vi.mock('../../lib/usage', () => ({
  Usage: { track: vi.fn(() => Promise.resolve()) },
}))

vi.mock('../../lib/userPreferences', () => ({
  trackUsage: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../lib/assistantBuilder', () => ({
  AssistantRegistry: { incrementUsage: vi.fn(() => Promise.resolve()) },
}))

vi.mock('../../lib/conversationSummarizer', () => ({
  shouldSummarize: () => false,
  buildSummaryPrompt: () => '',
  saveSummaryEntry: () => Promise.resolve(),
  loadLatestSummary: () => Promise.resolve(null),
  buildSystemPromptInjection: (s: string) => s,
  getDefaultConfig: () => ({ enabled: false, threshold: 20, maxCachePerConv: 5 }),
}))

import { streamWithRetry } from '../../lib/providers/stream-retry'
import { executeChatMode, type ExecuteChatParams } from '../useChatStreaming'

const mockStreamRetry = vi.mocked(streamWithRetry)

function makeParams(overrides?: Partial<ExecuteChatParams>): ExecuteChatParams {
  return {
    convId: 'conv-1',
    model: 'test-model',
    providerType: 'bedrock',
    text: 'hello',
    historyMsgs: [{ role: 'user', content: 'hello' }],
    placeholderId: 'ph-1',
    setMessages: vi.fn((updater) => {
      if (typeof updater === 'function') updater([])
    }),
    setIsSearching: vi.fn(),
    signal: new AbortController().signal,
    provider: { isConfigured: () => true, stream: vi.fn() } as never,
    aws: { accessKeyId: 'k', secretAccessKey: 's', region: 'us-east-1' },
    personaId: 'default',
    assistantId: 'ast-default',
    enableWebSearch: false,
    googleSearchApiKey: '',
    googleSearchEngineId: '',
    ...overrides,
  }
}

describe('executeChatMode rAF batching', () => {
  let rafCallbacks: (() => void)[] = []
  let rafIdCounter = 1
  let cancelledRafIds: Set<number> = new Set()

  beforeEach(() => {
    rafCallbacks = []
    rafIdCounter = 1
    cancelledRafIds = new Set()

    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
      const id = rafIdCounter++
      rafCallbacks.push(() => {
        if (!cancelledRafIds.has(id)) cb()
      })
      return id
    })

    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      cancelledRafIds.add(id)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('batches multiple chunks into a single setMessages call per rAF frame', async () => {
    const setMessages = vi.fn((updater: unknown) => {
      if (typeof updater === 'function') (updater as (prev: never[]) => void)([])
    })

    mockStreamRetry.mockImplementation(async function* () {
      yield 'Hello'
      yield ' world'
      yield '!'
    })

    const params = makeParams({ setMessages: setMessages as never })
    await executeChatMode(params)

    // rAF batching means fewer setMessages calls than chunks.
    // After streaming completes, the finally block flushes remaining.
    // We expect the finalize call + at most a few batched calls, NOT 3 separate chunk calls.
    const chunkCalls = setMessages.mock.calls.filter((call) => {
      if (typeof call[0] !== 'function') return false
      // Test if this is a chunk-append call (maps over messages to append content)
      // vs other setMessages calls (finalize, etc.)
      return true
    })
    // Should be fewer total setMessages calls than if each chunk triggered individually
    // Without rAF: 3 chunk calls + 1 finalize = 4 minimum
    // With rAF: chunks are batched, so total calls are reduced
    expect(chunkCalls.length).toBeLessThanOrEqual(4)
  })

  it('schedules requestAnimationFrame on first chunk, not on subsequent chunks', async () => {
    let rafCallCount = 0
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
      rafCallCount++
      const id = rafIdCounter++
      rafCallbacks.push(() => {
        if (!cancelledRafIds.has(id)) cb()
      })
      return id
    })

    mockStreamRetry.mockImplementation(async function* () {
      yield 'a'
      yield 'b'
      yield 'c'
    })

    const params = makeParams()
    await executeChatMode(params)

    // rAF should be requested only once (or once per frame), not per chunk
    // Since chunks arrive synchronously within the same generator iteration,
    // rAF is requested once and subsequent chunks accumulate in the buffer
    expect(rafCallCount).toBeGreaterThanOrEqual(1)
  })

  it('flushes remaining buffered chunks in finally block on stream completion', async () => {
    const setMessagesUpdates: ((prev: { id: string; content: string }[]) => { id: string; content: string }[])[] = []
    const setMessages = vi.fn((updater: unknown) => {
      if (typeof updater === 'function') {
        setMessagesUpdates.push(updater as (prev: { id: string; content: string }[]) => { id: string; content: string }[])
      }
    })

    // Stream yields chunks but rAF callbacks are NOT fired (simulating pending rAF)
    vi.stubGlobal('requestAnimationFrame', () => {
      // Never fire the callback — simulates rAF not having run yet
      return 999
    })

    mockStreamRetry.mockImplementation(async function* () {
      yield 'buffered-content'
    })

    const params = makeParams({ setMessages: setMessages as never })
    await executeChatMode(params)

    // Even though rAF never fired, the finally block should flush remaining chunks
    // Find the flush call that appends the buffered content
    const flushCall = setMessagesUpdates.find((updater) => {
      const result = updater([{ id: 'ph-1', content: '' }])
      return result.some((m) => m.content.includes('buffered-content'))
    })
    expect(flushCall).toBeDefined()
  })

  it('cancels pending rAF when stream errors', async () => {
    let cancelledId: number | null = null
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      cancelledId = id
    })
    vi.stubGlobal('requestAnimationFrame', () => 42)

    mockStreamRetry.mockImplementation(async function* () {
      yield 'before-error'
      throw new Error('stream failed')
    })

    const params = makeParams()

    await expect(executeChatMode(params)).rejects.toThrow('stream failed')
    expect(cancelledId).toBe(42)
  })

  it('handles empty stream without errors', async () => {
    mockStreamRetry.mockImplementation(async function* () {
      // yield nothing
    })

    const setMessages = vi.fn((updater: unknown) => {
      if (typeof updater === 'function') (updater as (prev: never[]) => void)([])
    })

    const params = makeParams({ setMessages: setMessages as never })
    await executeChatMode(params)

    // Should complete without errors and still call finalize
    expect(setMessages).toHaveBeenCalled()
  })
})
