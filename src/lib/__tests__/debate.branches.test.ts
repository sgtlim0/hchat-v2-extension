import { describe, it, expect, vi } from 'vitest'

vi.mock('../../i18n', () => ({
  getGlobalLocale: vi.fn(() => 'ko'),
}))

vi.mock('../usage', () => ({
  Usage: { track: vi.fn(async () => {}) },
}))

vi.mock('../assistantBuilder', () => ({
  AssistantRegistry: {
    getById: vi.fn(async () => null),
  },
}))

import { runDebate, runDebateWithVoting } from '../debate'
import { AssistantRegistry } from '../assistantBuilder'
import type { DebateConfig, DebateRound, DebateWithVotingConfig } from '../debate'

function makeMockProvider(text: string, isConfiguredVal = true) {
  return {
    type: 'openai' as const,
    models: [],
    isConfigured: () => isConfiguredVal,
    stream: async function* () { yield text; return text },
    testConnection: async () => true,
  }
}

function makeConfig(overrides?: Partial<DebateConfig>): DebateConfig {
  const provider = makeMockProvider('I think this is important.')
  return {
    topic: 'Test topic',
    modelIds: ['model-a', 'model-b'],
    providers: [provider, provider],
    getProviderForModel: () => provider,
    onRound: vi.fn(),
    onChunk: vi.fn(),
    ...overrides,
  }
}

describe('debate branch coverage', () => {
  it('throws when less than 2 models', async () => {
    await expect(runDebate(makeConfig({ modelIds: ['model-a'] }))).rejects.toThrow('최소 2개의 모델')
  })

  it('reports unconfigured provider (null)', async () => {
    const rounds: DebateRound[] = []
    await runDebate(makeConfig({
      getProviderForModel: () => undefined,
      onRound: (r) => rounds.push(r),
    }))

    expect(rounds.length).toBeGreaterThan(0)
    expect(rounds.every((r) => r.content.includes('미설정'))).toBe(true)
  })

  it('reports unconfigured provider (isConfigured false)', async () => {
    const rounds: DebateRound[] = []
    const provider = makeMockProvider('text', false)
    await runDebate(makeConfig({
      getProviderForModel: () => provider,
      onRound: (r) => rounds.push(r),
    }))

    expect(rounds.some((r) => r.content.includes('미설정'))).toBe(true)
  })

  it('runs full debate with configured provider', async () => {
    const rounds: DebateRound[] = []
    await runDebate(makeConfig({
      onRound: (r) => rounds.push(r),
    }))

    expect(rounds.length).toBeGreaterThan(0)
    const initial = rounds.filter((r) => r.role === 'initial')
    expect(initial.length).toBe(2)
    const critique = rounds.filter((r) => r.role === 'critique')
    expect(critique.length).toBe(2)
    const synthesis = rounds.filter((r) => r.role === 'synthesis')
    expect(synthesis.length).toBe(1)
  })

  it('handles abort signal during initial round', async () => {
    const controller = new AbortController()
    const provider = {
      type: 'openai' as const,
      models: [],
      isConfigured: () => true,
      stream: async function* () {
        controller.abort()
        yield 'partial'
        return 'partial'
      },
      testConnection: async () => true,
    }

    const rounds: DebateRound[] = []
    await runDebate(makeConfig({
      getProviderForModel: () => provider,
      onRound: (r) => rounds.push(r),
      signal: controller.signal,
    }))

    // Should return early after abort
    expect(rounds.length).toBeGreaterThan(0)
  })

  it('uses participants with assistantId', async () => {
    vi.mocked(AssistantRegistry.getById).mockResolvedValue({
      id: 'assist-1',
      name: 'Expert',
      systemPrompt: 'You are an expert.',
      description: 'Expert',
      category: 'general',
      icon: '',
      isBuiltin: false,
      createdAt: Date.now(),
    })

    const rounds: DebateRound[] = []
    await runDebate(makeConfig({
      participants: [
        { modelId: 'model-a', assistantId: 'assist-1' },
        { modelId: 'model-b' },
      ],
      onRound: (r) => rounds.push(r),
    }))

    expect(rounds.length).toBeGreaterThan(0)
    vi.mocked(AssistantRegistry.getById).mockResolvedValue(null)
  })

  it('skips synthesis when provider is not configured for synth model', async () => {
    let callCount = 0
    const rounds: DebateRound[] = []
    await runDebate(makeConfig({
      getProviderForModel: (id: string) => {
        callCount++
        // First model unconfigured for synthesis (round 3), but configured otherwise
        if (id === 'model-a' && callCount > 4) {
          return makeMockProvider('x', false)
        }
        return makeMockProvider('Debate content')
      },
      onRound: (r) => rounds.push(r),
    }))

    expect(rounds.length).toBeGreaterThan(0)
  })
})

describe('runDebateWithVoting', () => {
  it('runs without voting when voting disabled', async () => {
    const rounds: DebateRound[] = []
    const config: DebateWithVotingConfig = {
      ...makeConfig({ onRound: (r) => rounds.push(r) }),
      votingConfig: { enableVoting: false, votingRound: false, consensusThreshold: 0.7 },
    }

    const result = await runDebateWithVoting(config)
    expect(result.length).toBeGreaterThan(0)
    expect(result.every((r) => r.role !== 'voting')).toBe(true)
  })

  it('runs with voting enabled', async () => {
    const rounds: DebateRound[] = []
    const onVotingComplete = vi.fn()

    // Mock a provider that returns vote-like content
    const provider = {
      type: 'openai' as const,
      models: [],
      isConfigured: () => true,
      stream: async function* () {
        const text = 'model-a: 4점\nmodel-b: 3점'
        yield text
        return text
      },
      testConnection: async () => true,
    }

    const config: DebateWithVotingConfig = {
      ...makeConfig({
        getProviderForModel: () => provider,
        onRound: (r) => rounds.push(r),
      }),
      votingConfig: { enableVoting: true, votingRound: true, consensusThreshold: 0.7 },
      onVotingComplete,
    }

    await runDebateWithVoting(config)
    // Should have voting rounds
    const votingRounds = rounds.filter((r) => r.role === 'voting')
    expect(votingRounds.length).toBeGreaterThan(0)
  })

  it('validates participants against voting config', async () => {
    const config: DebateWithVotingConfig = {
      ...makeConfig({ modelIds: ['model-a', 'model-b'] }),
      votingConfig: { enableVoting: true, votingRound: true, consensusThreshold: 0.7, maxParticipants: 1 },
    }

    await expect(runDebateWithVoting(config)).rejects.toThrow()
  })
})
