import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const mockProvider = {
  stream: vi.fn(),
  models: vi.fn(() => []),
  name: 'mock-provider',
}

vi.mock('../../lib/providers/provider-factory', () => ({
  createAllProviders: vi.fn(() => ({ bedrock: mockProvider })),
  getProviderForModel: vi.fn(() => mockProvider),
}))

vi.mock('../../lib/deepResearch', () => ({
  streamDeepResearch: vi.fn(),
}))

import { useDeepResearch } from '../useDeepResearch'
import { streamDeepResearch } from '../../lib/deepResearch'
import { getProviderForModel } from '../../lib/providers/provider-factory'
import type { Config } from '../useConfig'

const mockConfig: Config = {
  aws: { accessKeyId: 'key', secretAccessKey: 'secret', region: 'us-east-1' },
  openai: { apiKey: '' },
  gemini: { apiKey: '' },
  ollama: { baseUrl: '', modelFilter: [] },
  openrouter: { apiKey: '', siteUrl: '', siteName: '' },
  defaultModel: 'us.anthropic.claude-sonnet-4-6',
  autoRouting: false,
  theme: 'system',
  language: 'ko',
  enableContentScript: true,
  enableSearchEnhance: true,
  enableWebSearch: true,
  googleSearchApiKey: '',
  googleSearchEngineId: '',
  budget: { monthly: 0, warnThreshold: 70, critThreshold: 90, webhookUrl: '', webhookEnabled: false },
}

function makeMocks() {
  return {
    sendMessage: vi.fn(() => Promise.resolve()),
    showToast: vi.fn(),
    t: vi.fn((key: string) => key),
    locale: 'ko',
  }
}

describe('useDeepResearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with deepResearch off and no progress', () => {
    const { sendMessage, showToast, t, locale } = makeMocks()
    const { result } = renderHook(() =>
      useDeepResearch(mockConfig, 'model-1', sendMessage, showToast, t, locale),
    )

    expect(result.current.deepResearch).toBe(false)
    expect(result.current.researchProgress).toBeNull()
    expect(result.current.researchSources).toEqual([])
    expect(result.current.researchReport).toBe('')
  })

  it('can toggle deepResearch state', () => {
    const { sendMessage, showToast, t, locale } = makeMocks()
    const { result } = renderHook(() =>
      useDeepResearch(mockConfig, 'model-1', sendMessage, showToast, t, locale),
    )

    act(() => {
      result.current.setDeepResearch(true)
    })

    expect(result.current.deepResearch).toBe(true)
  })

  it('shows toast when no provider is found', async () => {
    vi.mocked(getProviderForModel).mockReturnValueOnce(null as unknown as ReturnType<typeof getProviderForModel>)
    const { sendMessage, showToast, t, locale } = makeMocks()
    const { result } = renderHook(() =>
      useDeepResearch(mockConfig, 'model-1', sendMessage, showToast, t, locale),
    )

    await act(async () => {
      await result.current.handleDeepResearch('test question')
    })

    expect(showToast).toHaveBeenCalledWith('common.apiKeyNotSet')
  })

  it('tracks progress events from stream', async () => {
    const events = [
      { type: 'progress' as const, progress: { step: 'generating_queries' as const, detail: '', current: 1, total: 3 } },
      { type: 'progress' as const, progress: { step: 'searching' as const, detail: 'query 1', current: 2, total: 3 } },
      { type: 'done' as const, result: { report: 'Final report', sources: [], queriesUsed: ['q1'] } },
    ]

    vi.mocked(streamDeepResearch).mockReturnValueOnce(
      (async function* () { for (const e of events) yield e })(),
    )

    const { sendMessage, showToast, t, locale } = makeMocks()
    const { result } = renderHook(() =>
      useDeepResearch(mockConfig, 'model-1', sendMessage, showToast, t, locale),
    )

    await act(async () => {
      await result.current.handleDeepResearch('test question')
    })

    // After done, progress is cleared
    expect(result.current.researchProgress).toBeNull()
    expect(sendMessage).toHaveBeenCalled()
  })

  it('collects sources from sources_found events', async () => {
    const source1 = { url: 'https://a.com', title: 'A', snippet: 'Snippet A' }
    const source2 = { url: 'https://b.com', title: 'B', snippet: 'Snippet B' }

    const events = [
      { type: 'sources_found' as const, query: 'q1', sources: [source1] },
      { type: 'sources_found' as const, query: 'q2', sources: [source2] },
      { type: 'done' as const, result: { report: 'Report', sources: [source1, source2], queriesUsed: ['q1', 'q2'] } },
    ]

    vi.mocked(streamDeepResearch).mockReturnValueOnce(
      (async function* () { for (const e of events) yield e })(),
    )

    const { sendMessage, showToast, t, locale } = makeMocks()
    const { result } = renderHook(() =>
      useDeepResearch(mockConfig, 'model-1', sendMessage, showToast, t, locale),
    )

    await act(async () => {
      await result.current.handleDeepResearch('test question')
    })

    // After done, sources are cleared
    expect(result.current.researchSources).toEqual([])
    expect(sendMessage).toHaveBeenCalled()
  })

  it('streams report chunks and builds report text', async () => {
    const events = [
      { type: 'report_chunk' as const, chunk: 'Part 1 ' },
      { type: 'report_chunk' as const, chunk: 'Part 2' },
      { type: 'done' as const, result: { report: 'Part 1 Part 2', sources: [], queriesUsed: [] } },
    ]

    vi.mocked(streamDeepResearch).mockReturnValueOnce(
      (async function* () { for (const e of events) yield e })(),
    )

    const { sendMessage, showToast, t, locale } = makeMocks()
    const { result } = renderHook(() =>
      useDeepResearch(mockConfig, 'model-1', sendMessage, showToast, t, locale),
    )

    await act(async () => {
      await result.current.handleDeepResearch('test question')
    })

    // After done, report is cleared
    expect(result.current.researchReport).toBe('')
  })

  it('calls sendMessage with system prompt on done event', async () => {
    const events = [
      { type: 'done' as const, result: { report: 'Final report', sources: [], queriesUsed: [] } },
    ]

    vi.mocked(streamDeepResearch).mockReturnValueOnce(
      (async function* () { for (const e of events) yield e })(),
    )

    const { sendMessage, showToast, t, locale } = makeMocks()
    const { result } = renderHook(() =>
      useDeepResearch(mockConfig, 'model-1', sendMessage, showToast, t, locale),
    )

    await act(async () => {
      await result.current.handleDeepResearch('my question')
    })

    expect(sendMessage).toHaveBeenCalledWith('my question', {
      systemPrompt: 'aiPrompts.deepResearchSystem',
    })
  })

  it('handles errors gracefully and shows toast', async () => {
    vi.mocked(streamDeepResearch).mockReturnValueOnce(
      (async function* () { throw new Error('Network error') })(),
    )

    const { sendMessage, showToast, t, locale } = makeMocks()
    const { result } = renderHook(() =>
      useDeepResearch(mockConfig, 'model-1', sendMessage, showToast, t, locale),
    )

    await act(async () => {
      await result.current.handleDeepResearch('test question')
    })

    expect(showToast).toHaveBeenCalledWith('deepResearch.failed')
    expect(result.current.researchProgress).toBeNull()
    expect(result.current.researchSources).toEqual([])
    expect(result.current.researchReport).toBe('')
  })

  it('does NOT show toast for cancelled error', async () => {
    const t = vi.fn((key: string) => {
      if (key === 'deepResearch.cancelled') return '취소됨'
      if (key === 'deepResearch.failed') return '실패'
      return key
    })

    vi.mocked(streamDeepResearch).mockReturnValueOnce(
      (async function* () { throw new Error('취소됨') })(),
    )

    const { sendMessage, showToast, locale } = makeMocks()
    const { result } = renderHook(() =>
      useDeepResearch(mockConfig, 'model-1', sendMessage, showToast, t, locale),
    )

    await act(async () => {
      await result.current.handleDeepResearch('test')
    })

    expect(showToast).not.toHaveBeenCalled()
  })

  it('passes AbortController signal to streamDeepResearch', async () => {
    const events = [
      { type: 'done' as const, result: { report: 'Report', sources: [], queriesUsed: [] } },
    ]

    vi.mocked(streamDeepResearch).mockReturnValueOnce(
      (async function* () { for (const e of events) yield e })(),
    )

    const { sendMessage, showToast, t, locale } = makeMocks()
    const { result } = renderHook(() =>
      useDeepResearch(mockConfig, 'model-1', sendMessage, showToast, t, locale),
    )

    await act(async () => {
      await result.current.handleDeepResearch('test question')
    })

    expect(streamDeepResearch).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    )
  })

  it('aborts previous research when starting a new one', async () => {
    let resolveFirst: () => void
    const firstBlocker = new Promise<void>((r) => { resolveFirst = r })

    vi.mocked(streamDeepResearch).mockReturnValueOnce(
      (async function* () {
        await firstBlocker
        yield { type: 'done' as const, result: { report: '', sources: [], queriesUsed: [] } }
      })(),
    )

    const { sendMessage, showToast, t, locale } = makeMocks()
    const { result } = renderHook(() =>
      useDeepResearch(mockConfig, 'model-1', sendMessage, showToast, t, locale),
    )

    // Start first research (don't await)
    let firstPromise: Promise<void>
    act(() => {
      firstPromise = result.current.handleDeepResearch('first question')
    })

    // Get the first signal
    const firstCall = vi.mocked(streamDeepResearch).mock.calls[0][0]
    const firstSignal = firstCall.signal!

    // Start second research — should abort the first
    const events2 = [
      { type: 'done' as const, result: { report: 'Report 2', sources: [], queriesUsed: [] } },
    ]
    vi.mocked(streamDeepResearch).mockReturnValueOnce(
      (async function* () { for (const e of events2) yield e })(),
    )

    await act(async () => {
      await result.current.handleDeepResearch('second question')
    })

    expect(firstSignal.aborted).toBe(true)

    // Resolve first so it doesn't hang
    resolveFirst!()
    await act(async () => {
      try { await firstPromise! } catch { /* aborted */ }
    })
  })

  it('creates fresh AbortController for each research call', async () => {
    const events = [
      { type: 'done' as const, result: { report: 'Report', sources: [], queriesUsed: [] } },
    ]

    vi.mocked(streamDeepResearch).mockReturnValue(
      (async function* () { for (const e of events) yield e })(),
    )

    const { sendMessage, showToast, t, locale } = makeMocks()
    const { result } = renderHook(() =>
      useDeepResearch(mockConfig, 'model-1', sendMessage, showToast, t, locale),
    )

    await act(async () => {
      await result.current.handleDeepResearch('question 1')
    })

    const firstSignal = vi.mocked(streamDeepResearch).mock.calls[0][0].signal

    vi.mocked(streamDeepResearch).mockReturnValue(
      (async function* () { for (const e of events) yield e })(),
    )

    await act(async () => {
      await result.current.handleDeepResearch('question 2')
    })

    const secondSignal = vi.mocked(streamDeepResearch).mock.calls[1][0].signal

    // Each call should have a different signal (new AbortController)
    expect(firstSignal).not.toBe(secondSignal)
  })

  it('sets initial progress when starting research', async () => {
    // Use a generator that we can control step by step
    let resolve: () => void
    const blocker = new Promise<void>((r) => { resolve = r })

    vi.mocked(streamDeepResearch).mockReturnValueOnce(
      (async function* () {
        await blocker
        yield { type: 'done' as const, result: { report: '', sources: [], queriesUsed: [] } }
      })(),
    )

    const { sendMessage, showToast, t, locale } = makeMocks()
    const { result } = renderHook(() =>
      useDeepResearch(mockConfig, 'model-1', sendMessage, showToast, t, locale),
    )

    // Start research without awaiting
    let researchPromise: Promise<void>
    act(() => {
      researchPromise = result.current.handleDeepResearch('test')
    })

    // Progress should be set to initial state
    await waitFor(() => {
      expect(result.current.researchProgress).toEqual({
        step: 'generating_queries',
        detail: '',
        current: 0,
        total: 3,
      })
    })

    // Resolve and finish
    resolve!()
    await act(async () => {
      await researchPromise!
    })
  })
})
