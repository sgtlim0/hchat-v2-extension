import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// ── Mock dependencies ──

const mockDetectPII = vi.fn(() => [])
const mockGetGuardrailConfig = vi.fn(() =>
  Promise.resolve({ enabled: false, types: [], action: 'warn' }),
)

vi.mock('../../lib/guardrail', () => ({
  detectPII: (...args: unknown[]) => mockDetectPII(...args),
  getGuardrailConfig: () => mockGetGuardrailConfig(),
}))

const mockNeedsWebSearch = vi.fn(() => false)
const mockExtractSearchQuery = vi.fn((t: string) => t)
const mockWebSearch = vi.fn(() => Promise.resolve([]))
const mockBuildSearchContext = vi.fn(() => '')

vi.mock('../../lib/searchIntent', () => ({
  needsWebSearch: (...args: unknown[]) => mockNeedsWebSearch(...args),
  extractSearchQuery: (...args: unknown[]) => mockExtractSearchQuery(...args),
}))

vi.mock('../../lib/webSearch', () => ({
  webSearch: (...args: unknown[]) => mockWebSearch(...args),
  buildSearchContext: (...args: unknown[]) => mockBuildSearchContext(...args),
}))

const mockRunAgent = vi.fn(() =>
  Promise.resolve({ finalText: 'agent result', steps: [{ type: 'response', content: 'agent result' }] }),
)

vi.mock('../../lib/agent', () => ({
  runAgent: (...args: unknown[]) => mockRunAgent(...args),
}))

vi.mock('../../lib/agentTools', () => ({
  BUILTIN_TOOLS: [{ name: 'web_search' }, { name: 'calculator' }],
}))

vi.mock('../../lib/pluginRegistry', () => ({
  PluginRegistry: { toAgentTools: () => Promise.resolve([{ name: 'custom-tool' }]) },
}))

const mockGetById = vi.fn(() => Promise.resolve(null))
const mockIncrementUsage = vi.fn(() => Promise.resolve())

vi.mock('../../lib/assistantBuilder', () => ({
  AssistantRegistry: {
    getById: (...args: unknown[]) => mockGetById(...args),
    incrementUsage: (...args: unknown[]) => mockIncrementUsage(...args),
  },
}))

const mockStreamRetry = vi.fn(async function* () {
  yield 'Hello'
})

vi.mock('../../lib/providers/stream-retry', () => ({
  streamWithRetry: (...args: unknown[]) => mockStreamRetry(...args),
}))

const mockProviderIsConfigured = vi.fn(() => true)
const mockProvider = {
  isConfigured: () => mockProviderIsConfigured(),
  stream: vi.fn(async function* () { yield 'Hello' }),
}

vi.mock('../../lib/providers/provider-factory', () => ({
  createAllProviders: () => [mockProvider],
  getProviderForModel: () => mockProvider,
  getModelDef: () => ({ provider: 'bedrock' }),
}))

const mockRouteModel = vi.fn(() => null)

vi.mock('../../lib/providers/model-router', () => ({
  routeModel: (...args: unknown[]) => mockRouteModel(...args),
}))

vi.mock('../../lib/providers/bedrock-provider', () => ({
  BedrockProvider: vi.fn().mockImplementation(() => ({
    isConfigured: () => true,
    stream: async function* () { yield 'Fallback' },
  })),
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
const mockAddMessage = vi.fn((_convId: string, msg: { role: string; content: string }) => {
  messageCounter++
  return Promise.resolve({
    id: `msg-${messageCounter}`,
    role: msg.role,
    content: msg.content,
    ts: Date.now(),
    streaming: false,
  })
})
const mockUpdateMessage = vi.fn(() => Promise.resolve())
const mockTruncateAfter = vi.fn(() => Promise.resolve())

vi.mock('../../lib/chatHistory', () => ({
  ChatHistory: {
    create: () => Promise.resolve({ ...mockConversation }),
    get: (...args: unknown[]) => mockChatHistoryGet(...args),
    addMessage: (...args: unknown[]) => mockAddMessage(...(args as [string, { role: string; content: string }])),
    updateMessage: (...args: unknown[]) => mockUpdateMessage(...args),
    truncateAfter: (...args: unknown[]) => mockTruncateAfter(...args),
  },
}))

vi.mock('../../lib/personas', () => ({
  Personas: { getById: () => Promise.resolve({ id: 'default', systemPrompt: '기본 페르소나 프롬프트' }) },
}))

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

vi.mock('../../lib/usage', () => ({
  Usage: { track: vi.fn(() => Promise.resolve()) },
}))

vi.mock('../../lib/messageQueue', () => ({
  MessageQueue: {
    enqueue: vi.fn(() => Promise.resolve()),
    processQueue: vi.fn(() => Promise.resolve()),
  },
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
  ollama: { baseUrl: '', modelFilter: [] },
  openrouter: { apiKey: '', siteUrl: '', siteName: '' },
  autoRouting: false,
  enableWebSearch: false,
  enableContentScript: true,
  enableSearchEnhance: true,
  language: 'ko',
  theme: 'dark',
  googleSearchApiKey: '',
  googleSearchEngineId: '',
  budget: { monthly: 0, warnThreshold: 70, critThreshold: 90, webhookUrl: '', webhookEnabled: false },
}

describe('useChat branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    messageCounter = 0
    mockChatHistoryGet.mockResolvedValue({ ...mockConversation, messages: [] })
    mockLoadLatestSummary.mockResolvedValue(null)
    mockShouldSummarize.mockReturnValue(false)
    mockGetGuardrailConfig.mockResolvedValue({ enabled: false, types: [], action: 'warn' })
    mockDetectPII.mockReturnValue([])
    mockNeedsWebSearch.mockReturnValue(false)
    mockRunAgent.mockResolvedValue({ finalText: 'agent result', steps: [] })
    mockStreamRetry.mockImplementation(async function* () { yield 'Hello' })
    mockProviderIsConfigured.mockReturnValue(true)
    mockRouteModel.mockReturnValue(null)
    mockGetById.mockResolvedValue(null)
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })
  })

  // ── 1. sendMessage: normal vs agent mode ──

  it('sendMessage in normal mode calls streamWithRetry (not runAgent)', async () => {
    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      await result.current.sendMessage('hello normal')
    })

    await waitFor(() => {
      expect(mockStreamRetry).toHaveBeenCalled()
    })
    expect(mockRunAgent).not.toHaveBeenCalled()
  })

  it('sendMessage in agent mode calls runAgent (not streamWithRetry)', async () => {
    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      result.current.setAgentMode(true)
    })

    await act(async () => {
      await result.current.sendMessage('hello agent')
    })

    await waitFor(() => {
      expect(mockRunAgent).toHaveBeenCalled()
    })
    // streamWithRetry should NOT be called in agent mode
    expect(mockStreamRetry).not.toHaveBeenCalled()
  })

  // ── 2. PII detection branch ──

  it('blocks sending when PII is detected', async () => {
    mockGetGuardrailConfig.mockResolvedValue({ enabled: true, types: ['email'], action: 'warn' })
    mockDetectPII.mockReturnValue([
      { type: 'email', value: 'test@example.com', start: 0, end: 16, masked: '***@***.com' },
    ])

    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      await result.current.sendMessage('test@example.com')
    })

    // Message is blocked: pendingMessage is set, messages remain empty
    await waitFor(() => {
      expect(result.current.pendingMessage).toBe('test@example.com')
      expect(result.current.piiDetections).toHaveLength(1)
    })
    expect(result.current.messages).toHaveLength(0)
  })

  it('sends normally when no PII is detected even with guardrail enabled', async () => {
    mockGetGuardrailConfig.mockResolvedValue({ enabled: true, types: ['email'], action: 'warn' })
    mockDetectPII.mockReturnValue([])

    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      await result.current.sendMessage('no pii here')
    })

    await waitFor(() => {
      expect(result.current.messages.length).toBeGreaterThanOrEqual(2)
    })
    expect(result.current.pendingMessage).toBeNull()
  })

  // ── 3. Web search: on/off, needsWebSearch true/false ──

  it('skips web search when config.enableWebSearch is false', async () => {
    mockNeedsWebSearch.mockReturnValue(true)

    const { result } = renderHook(() => useChat({ ...baseConfig, enableWebSearch: false }))

    await act(async () => {
      await result.current.sendMessage('latest news')
    })

    await waitFor(() => {
      expect(result.current.messages.length).toBeGreaterThanOrEqual(2)
    })
    expect(mockWebSearch).not.toHaveBeenCalled()
  })

  it('skips web search when enableWebSearch is true but needsWebSearch returns false', async () => {
    mockNeedsWebSearch.mockReturnValue(false)

    const { result } = renderHook(() => useChat({ ...baseConfig, enableWebSearch: true }))

    await act(async () => {
      await result.current.sendMessage('just a normal question')
    })

    await waitFor(() => {
      expect(result.current.messages.length).toBeGreaterThanOrEqual(2)
    })
    expect(mockWebSearch).not.toHaveBeenCalled()
  })

  it('performs web search when enableWebSearch is true and needsWebSearch returns true', async () => {
    mockNeedsWebSearch.mockReturnValue(true)
    mockWebSearch.mockResolvedValue([
      { title: 'Result 1', url: 'https://example.com', snippet: 'snippet' },
    ])
    mockBuildSearchContext.mockReturnValue('Search context: Result 1')

    const { result } = renderHook(() => useChat({ ...baseConfig, enableWebSearch: true }))

    await act(async () => {
      await result.current.sendMessage('latest AI news')
    })

    await waitFor(() => {
      expect(mockWebSearch).toHaveBeenCalled()
      expect(mockBuildSearchContext).toHaveBeenCalled()
    })
  })

  it('handles web search failure gracefully (proceeds without search results)', async () => {
    mockNeedsWebSearch.mockReturnValue(true)
    mockWebSearch.mockRejectedValue(new Error('Search API error'))

    const { result } = renderHook(() => useChat({ ...baseConfig, enableWebSearch: true }))

    await act(async () => {
      await result.current.sendMessage('failing search')
    })

    await waitFor(() => {
      // Chat should still complete despite search failure
      expect(result.current.messages.length).toBeGreaterThanOrEqual(2)
      expect(result.current.error).toBe('')
    })
  })

  // ── 4. Assistant mode: systemPrompt injection ──

  it('injects assistant systemPrompt in normal chat mode', async () => {
    mockGetById.mockResolvedValue({
      id: 'ast-writer',
      name: 'Writer',
      systemPrompt: '당신은 전문 작가입니다.',
      tools: [],
      isBuiltIn: true,
    })

    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      result.current.setAssistantId('ast-writer')
    })

    await act(async () => {
      await result.current.sendMessage('write a poem')
    })

    await waitFor(() => {
      expect(mockStreamRetry).toHaveBeenCalled()
    })

    // Verify systemPrompt arg passed to streamWithRetry includes assistant prompt
    const streamCall = mockStreamRetry.mock.calls[0]
    const opts = streamCall[1] as { systemPrompt?: string }
    expect(opts.systemPrompt).toContain('당신은 전문 작가입니다.')
  })

  it('injects assistant systemPrompt in agent mode', async () => {
    mockGetById.mockResolvedValue({
      id: 'ast-coder',
      name: 'Coder',
      systemPrompt: '당신은 코드 전문가입니다.',
      tools: ['web_search'],
      isBuiltIn: false,
    })

    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      result.current.setAgentMode(true)
      result.current.setAssistantId('ast-coder')
    })

    await act(async () => {
      await result.current.sendMessage('write code')
    })

    await waitFor(() => {
      expect(mockRunAgent).toHaveBeenCalled()
    })

    const agentCall = mockRunAgent.mock.calls[0][0] as { systemPrompt?: string; tools?: { name: string }[] }
    expect(agentCall.systemPrompt).toBe('당신은 코드 전문가입니다.')
    // Tools should be filtered by assistant tool bindings
    expect(agentCall.tools).toEqual([{ name: 'web_search' }])
  })

  // ── 5. Error handling: stream error, network error ──

  it('sets error state when stream throws', async () => {
    mockStreamRetry.mockImplementation(async function* () {
      throw new Error('Stream connection failed')
    })

    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      await result.current.sendMessage('will fail')
    })

    await waitFor(() => {
      expect(result.current.error).toContain('Stream connection failed')
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('sets error state when runAgent throws in agent mode', async () => {
    mockRunAgent.mockRejectedValue(new Error('Agent execution error'))

    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      result.current.setAgentMode(true)
    })

    await act(async () => {
      await result.current.sendMessage('agent fail')
    })

    await waitFor(() => {
      expect(result.current.error).toContain('Agent execution error')
      expect(result.current.isLoading).toBe(false)
    })
  })

  // ── 6. Conversation lifecycle: startNew, loadConv, editAndResend, regenerate ──

  it('startNew creates a new conversation and clears messages', async () => {
    const { result } = renderHook(() => useChat(baseConfig))

    let newConv: unknown
    await act(async () => {
      newConv = await result.current.startNew()
    })

    expect(newConv).toEqual(expect.objectContaining({ id: 'conv-1' }))
    expect(result.current.messages).toEqual([])
    expect(result.current.error).toBe('')
  })

  it('loadConv loads existing conversation and restores messages', async () => {
    const existingMessages = [
      { id: 'm-1', role: 'user', content: 'hi', ts: 1000, streaming: false },
      { id: 'm-2', role: 'assistant', content: 'hello', ts: 2000, streaming: false, model: 'test-model' },
    ]
    mockChatHistoryGet.mockResolvedValue({
      ...mockConversation,
      messages: existingMessages,
    })

    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      await result.current.loadConv('conv-1')
    })

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2)
      expect(result.current.messages[0].content).toBe('hi')
      expect(result.current.messages[1].content).toBe('hello')
    })
  })

  it('editAndResend updates user message and resends', async () => {
    // Setup conversation with messages
    const existingMessages = [
      { id: 'm-1', role: 'user' as const, content: 'old text', ts: 1000, streaming: false },
      { id: 'm-2', role: 'assistant' as const, content: 'old reply', ts: 2000, streaming: false, model: 'test-model' },
    ]
    mockChatHistoryGet.mockResolvedValue({
      ...mockConversation,
      messages: existingMessages,
    })

    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      await result.current.loadConv('conv-1')
    })

    await act(async () => {
      await result.current.editAndResend('m-1', 'new text')
    })

    await waitFor(() => {
      expect(mockUpdateMessage).toHaveBeenCalledWith('conv-1', 'm-1', 'new text')
      expect(mockTruncateAfter).toHaveBeenCalledWith('conv-1', 'm-2')
    })
  })

  it('regenerate resends the last user message', async () => {
    const existingMessages = [
      { id: 'm-1', role: 'user' as const, content: 'regenerate me', ts: 1000, streaming: false },
      { id: 'm-2', role: 'assistant' as const, content: 'old response', ts: 2000, streaming: false, model: 'test-model' },
    ]
    mockChatHistoryGet.mockResolvedValue({
      ...mockConversation,
      messages: existingMessages,
    })

    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      await result.current.loadConv('conv-1')
    })

    await act(async () => {
      await result.current.regenerate()
    })

    await waitFor(() => {
      expect(mockTruncateAfter).toHaveBeenCalledWith('conv-1', 'm-2')
      // The sendMessage should be called with the last user text
      expect(mockStreamRetry).toHaveBeenCalled()
    })
  })

  // ── 7. Auto-summarization: 20+ messages triggers call ──

  it('triggers auto-summarize when shouldSummarize returns true', async () => {
    mockShouldSummarize.mockReturnValue(true)
    mockLoadLatestSummary.mockResolvedValue(null)
    mockChatHistoryGet.mockResolvedValue({
      ...mockConversation,
      messages: Array.from({ length: 22 }, (_, i) => ({
        id: `m-${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `message ${i}`,
        ts: Date.now() + i,
      })),
    })

    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      await result.current.sendMessage('trigger summarize')
    })

    await waitFor(() => {
      expect(mockShouldSummarize).toHaveBeenCalledWith(22, expect.any(Object))
      expect(mockSaveSummaryEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          convId: 'conv-1',
          messageCount: 22,
        }),
      )
    })
  })

  // ── 8. Usage tracking: trackUsage calls ──

  it('calls trackUsage for model and assistant in normal mode', async () => {
    mockGetById.mockResolvedValue({
      id: 'ast-custom',
      name: 'Custom',
      systemPrompt: 'custom prompt',
      tools: [],
      isBuiltIn: false,
    })

    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      result.current.setAssistantId('ast-custom')
    })

    await act(async () => {
      await result.current.sendMessage('track this')
    })

    await waitFor(() => {
      expect(mockTrackUsage).toHaveBeenCalledWith('model', 'us.anthropic.claude-sonnet-4-6')
      expect(mockTrackUsage).toHaveBeenCalledWith('assistant', 'ast-custom')
    })
    // Non-builtin assistant should trigger incrementUsage
    expect(mockIncrementUsage).toHaveBeenCalledWith('ast-custom')
  })

  it('calls trackUsage for model in agent mode', async () => {
    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      result.current.setAgentMode(true)
    })

    await act(async () => {
      await result.current.sendMessage('agent track')
    })

    await waitFor(() => {
      expect(mockTrackUsage).toHaveBeenCalledWith('model', 'us.anthropic.claude-sonnet-4-6')
    })
  })

  it('does not increment usage for builtin assistant', async () => {
    mockGetById.mockResolvedValue({
      id: 'ast-builtin',
      name: 'Builtin',
      systemPrompt: 'builtin prompt',
      tools: [],
      isBuiltIn: true,
    })

    const { result } = renderHook(() => useChat(baseConfig))

    await act(async () => {
      result.current.setAssistantId('ast-builtin')
    })

    await act(async () => {
      await result.current.sendMessage('builtin test')
    })

    await waitFor(() => {
      expect(mockStreamRetry).toHaveBeenCalled()
    })

    expect(mockIncrementUsage).not.toHaveBeenCalled()
  })
})
