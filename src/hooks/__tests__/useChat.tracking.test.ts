import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// ── Mock dependencies ──

const mockTrackUsage = vi.fn(() => Promise.resolve())
vi.mock('../../lib/userPreferences', () => ({
  trackUsage: (...args: unknown[]) => mockTrackUsage(...args),
}))

const mockShouldSummarize = vi.fn(() => false)
const mockBuildSummaryPrompt = vi.fn(() => 'summary prompt text')
const mockSaveSummaryEntry = vi.fn(() => Promise.resolve())
const mockLoadLatestSummary = vi.fn(() => Promise.resolve(null))
const mockBuildSystemPromptInjection = vi.fn((s: string) => `[요약]\n${s}\n[계속]`)
const mockGetSummaryConfig = vi.fn(() => ({ enabled: true, threshold: 20, maxCachePerConv: 5 }))

vi.mock('../../lib/conversationSummarizer', () => ({
  shouldSummarize: (...args: unknown[]) => mockShouldSummarize(...args),
  buildSummaryPrompt: (...args: unknown[]) => mockBuildSummaryPrompt(...args),
  saveSummaryEntry: (...args: unknown[]) => mockSaveSummaryEntry(...args),
  loadLatestSummary: (...args: unknown[]) => mockLoadLatestSummary(...args),
  buildSystemPromptInjection: (...args: unknown[]) => mockBuildSystemPromptInjection(...args),
  getDefaultConfig: () => mockGetSummaryConfig(),
}))

// Mock provider that immediately resolves
const mockStream = vi.fn(async function* () {
  yield 'Hello'
  return 'Hello'
})

const mockProvider = {
  isConfigured: () => true,
  stream: mockStream,
}

vi.mock('../../lib/providers/provider-factory', () => ({
  createAllProviders: () => [mockProvider],
  getProviderForModel: () => mockProvider,
  getModelDef: () => ({ provider: 'bedrock' }),
}))

vi.mock('../../lib/providers/stream-retry', () => ({
  streamWithRetry: (_provider: unknown, opts: unknown) => {
    return (async function* () {
      yield 'Hello'
    })()
  },
}))

vi.mock('../../lib/providers/model-router', () => ({
  routeModel: () => null,
}))

vi.mock('../../lib/providers/bedrock-provider', () => ({
  BedrockProvider: vi.fn(),
}))

const mockConversation = {
  id: 'conv-1',
  model: 'test-model',
  messages: [] as { id: string; role: string; content: string; ts: number; streaming: boolean; model?: string }[],
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

let messageCounter = 0
const mockChatHistoryGet = vi.fn(() => Promise.resolve({ ...mockConversation }))

vi.mock('../../lib/chatHistory', () => ({
  ChatHistory: {
    create: () => Promise.resolve({ ...mockConversation }),
    get: (...args: unknown[]) => mockChatHistoryGet(...args),
    addMessage: (_convId: string, msg: { role: string; content: string }) => {
      messageCounter++
      return Promise.resolve({
        id: `msg-${messageCounter}`,
        role: msg.role,
        content: msg.content,
        ts: Date.now(),
        streaming: false,
      })
    },
    updateMessage: vi.fn(() => Promise.resolve()),
    truncateAfter: vi.fn(() => Promise.resolve()),
  },
}))

vi.mock('../../lib/searchIntent', () => ({
  needsWebSearch: () => false,
  extractSearchQuery: (t: string) => t,
}))

vi.mock('../../lib/webSearch', () => ({
  webSearch: () => Promise.resolve([]),
  buildSearchContext: () => '',
}))

vi.mock('../../lib/agent', () => ({
  runAgent: () => Promise.resolve({ finalText: 'agent result', steps: [] }),
}))

vi.mock('../../lib/agentTools', () => ({
  BUILTIN_TOOLS: [],
}))

vi.mock('../../lib/pluginRegistry', () => ({
  PluginRegistry: { toAgentTools: () => Promise.resolve([]) },
}))

vi.mock('../../lib/personas', () => ({
  Personas: { getById: () => Promise.resolve(null) },
}))

vi.mock('../../lib/assistantBuilder', () => ({
  AssistantRegistry: {
    getById: vi.fn(() => Promise.resolve(null)),
    incrementUsage: vi.fn(() => Promise.resolve()),
  },
}))

vi.mock('../../lib/usage', () => ({
  Usage: { track: vi.fn(() => Promise.resolve()) },
}))

vi.mock('../../lib/messageQueue', () => ({
  MessageQueue: {
    enqueue: vi.fn(() => Promise.resolve()),
    processQueue: vi.fn(() => Promise.resolve()),
  },
}))

vi.mock('../../lib/guardrail', () => ({
  detectPII: () => [],
  getGuardrailConfig: () => Promise.resolve({ enabled: false, types: [], action: 'warn' }),
}))

vi.mock('../../lib/chatTemplates', () => ({
  ChatTemplateStore: {
    get: vi.fn(() => Promise.resolve(null)),
    incrementUsage: vi.fn(() => Promise.resolve()),
  },
  replaceVariables: (steps: unknown) => steps,
}))

vi.mock('../../i18n', () => ({
  getGlobalLocale: () => 'ko',
}))

import { useChat } from '../useChat'
import type { Config } from '../useConfig'

const baseConfig: Config = {
  defaultModel: 'us.anthropic.claude-sonnet-4-6',
  aws: { accessKeyId: 'test-key', secretAccessKey: 'test-secret', region: 'us-east-1' },
  openai: { apiKey: '' },
  gemini: { apiKey: '' },
  autoRouting: false,
  enableWebSearch: false,
  language: 'ko',
  theme: 'dark',
  googleSearchApiKey: '',
  googleSearchEngineId: '',
}

describe('useChat tracking & summarization integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    messageCounter = 0
    mockChatHistoryGet.mockResolvedValue({ ...mockConversation, messages: [] })
    mockLoadLatestSummary.mockResolvedValue(null)
    mockShouldSummarize.mockReturnValue(false)
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })
  })

  // ── trackUsage tests ──

  it('calls trackUsage for model after chat response', async () => {
    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      await result.current.sendMessage('hello')
    })

    await waitFor(() => {
      expect(mockTrackUsage).toHaveBeenCalledWith('model', 'us.anthropic.claude-sonnet-4-6')
    })
  })

  it('does NOT call trackUsage for assistant when using ast-default', async () => {
    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      await result.current.sendMessage('hello')
    })

    await waitFor(() => {
      expect(mockTrackUsage).toHaveBeenCalledWith('model', expect.any(String))
    })

    expect(mockTrackUsage).not.toHaveBeenCalledWith('assistant', 'ast-default')
  })

  it('calls trackUsage for assistant when using non-default assistant', async () => {
    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      result.current.setAssistantId('ast-custom-1')
    })

    await act(async () => {
      await result.current.sendMessage('hello')
    })

    await waitFor(() => {
      expect(mockTrackUsage).toHaveBeenCalledWith('assistant', 'ast-custom-1')
    })
  })

  it('calls trackUsage for model after agent mode response', async () => {
    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      result.current.setAgentMode(true)
    })

    await act(async () => {
      await result.current.sendMessage('search something')
    })

    await waitFor(() => {
      expect(mockTrackUsage).toHaveBeenCalledWith('model', 'us.anthropic.claude-sonnet-4-6')
    })
  })

  it('trackUsage errors do not break chat flow', async () => {
    mockTrackUsage.mockRejectedValueOnce(new Error('tracking error'))

    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      await result.current.sendMessage('hello')
    })

    // Should not throw and messages should still be set
    await waitFor(() => {
      expect(result.current.messages.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('trackUsage for model is always called even for default assistant', async () => {
    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      await result.current.sendMessage('hello')
    })

    await waitFor(() => {
      expect(mockTrackUsage).toHaveBeenCalledWith('model', expect.any(String))
    })
    // model track is called, assistant track is NOT
    const assistantCalls = mockTrackUsage.mock.calls.filter(
      (c: unknown[]) => c[0] === 'assistant'
    )
    expect(assistantCalls).toHaveLength(0)
  })

  it('both trackUsage calls are fire-and-forget with catch', async () => {
    // This test verifies that trackUsage is called but errors are swallowed
    mockTrackUsage.mockRejectedValue(new Error('silent error'))

    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      result.current.setAssistantId('ast-custom-1')
    })

    // Should not throw
    await act(async () => {
      await result.current.sendMessage('hello')
    })

    await waitFor(() => {
      expect(mockTrackUsage).toHaveBeenCalledTimes(2) // model + assistant
    })
  })

  // ── Summarization tests ──

  it('calls shouldSummarize with message count after chat response', async () => {
    mockChatHistoryGet.mockResolvedValue({
      ...mockConversation,
      messages: Array.from({ length: 25 }, (_, i) => ({
        id: `m-${i}`, role: i % 2 === 0 ? 'user' : 'assistant', content: `msg ${i}`, ts: Date.now(),
      })),
    })

    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      await result.current.sendMessage('hello')
    })

    await waitFor(() => {
      expect(mockShouldSummarize).toHaveBeenCalledWith(25, { enabled: true, threshold: 20, maxCachePerConv: 5 })
    })
  })

  it('calls saveSummaryEntry when threshold exceeded and no existing summary', async () => {
    mockShouldSummarize.mockReturnValue(true)
    mockLoadLatestSummary.mockResolvedValue(null)
    mockChatHistoryGet.mockResolvedValue({
      ...mockConversation,
      messages: Array.from({ length: 25 }, (_, i) => ({
        id: `m-${i}`, role: i % 2 === 0 ? 'user' : 'assistant', content: `msg ${i}`, ts: Date.now(),
      })),
    })

    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      await result.current.sendMessage('hello')
    })

    await waitFor(() => {
      expect(mockSaveSummaryEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          convId: 'conv-1',
          summary: 'summary prompt text',
          messageCount: 25,
        })
      )
    })
  })

  it('does NOT call saveSummaryEntry when below threshold', async () => {
    mockShouldSummarize.mockReturnValue(false)

    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      await result.current.sendMessage('hello')
    })

    await waitFor(() => {
      expect(mockShouldSummarize).toHaveBeenCalled()
    })

    expect(mockSaveSummaryEntry).not.toHaveBeenCalled()
  })

  it('auto-summarize only triggers when 10+ new messages since last summary', async () => {
    mockShouldSummarize.mockReturnValue(true)
    // Existing summary at messageCount 20, current is 25 → gap is 5, should NOT trigger
    mockLoadLatestSummary.mockResolvedValue({
      convId: 'conv-1',
      summary: 'old summary',
      messageCount: 20,
      createdAt: Date.now() - 60000,
    })
    mockChatHistoryGet.mockResolvedValue({
      ...mockConversation,
      messages: Array.from({ length: 25 }, (_, i) => ({
        id: `m-${i}`, role: 'user', content: `msg ${i}`, ts: Date.now(),
      })),
    })

    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      await result.current.sendMessage('hello')
    })

    await waitFor(() => {
      expect(mockShouldSummarize).toHaveBeenCalled()
    })

    // Gap is 5, which is less than 10 → should NOT save
    expect(mockSaveSummaryEntry).not.toHaveBeenCalled()
  })

  // ── Summary injection tests ──

  it('calls loadLatestSummary for summary injection in normal chat mode', async () => {
    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      await result.current.sendMessage('hello')
    })

    await waitFor(() => {
      expect(mockLoadLatestSummary).toHaveBeenCalledWith('conv-1')
    })
  })

  it('injects summary into systemPrompt when previous summary exists', async () => {
    mockLoadLatestSummary.mockResolvedValue({
      convId: 'conv-1',
      summary: 'Previous conversation was about TypeScript patterns',
      messageCount: 20,
      createdAt: Date.now() - 60000,
    })

    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      await result.current.sendMessage('hello')
    })

    await waitFor(() => {
      expect(mockBuildSystemPromptInjection).toHaveBeenCalledWith(
        'Previous conversation was about TypeScript patterns'
      )
    })
  })

  it('does NOT inject summary when no previous summary exists', async () => {
    mockLoadLatestSummary.mockResolvedValue(null)

    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      await result.current.sendMessage('hello')
    })

    await waitFor(() => {
      expect(mockLoadLatestSummary).toHaveBeenCalled()
    })

    expect(mockBuildSystemPromptInjection).not.toHaveBeenCalled()
  })

  it('saveSummaryEntry errors do not break chat flow', async () => {
    mockShouldSummarize.mockReturnValue(true)
    mockLoadLatestSummary.mockResolvedValue(null)
    mockSaveSummaryEntry.mockRejectedValueOnce(new Error('save error'))
    mockChatHistoryGet.mockResolvedValue({
      ...mockConversation,
      messages: Array.from({ length: 25 }, (_, i) => ({
        id: `m-${i}`, role: 'user', content: `msg ${i}`, ts: Date.now(),
      })),
    })

    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      await result.current.sendMessage('hello')
    })

    // Should not throw, messages still work
    await waitFor(() => {
      expect(result.current.messages.length).toBeGreaterThanOrEqual(1)
    })
  })
})
