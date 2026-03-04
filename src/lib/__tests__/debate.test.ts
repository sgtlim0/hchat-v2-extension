// lib/__tests__/debate.test.ts — Tests for debate engine with assistant support

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runDebate, type DebateConfig, type DebateParticipant } from '../debate'
import type { AIProvider } from '../providers/types'
import { AssistantRegistry } from '../assistantBuilder'

// Mock Usage to prevent storage calls that cause timeouts
vi.mock('../usage', () => ({
  Usage: { track: vi.fn(() => Promise.resolve()) },
}))

const createMockProvider = (type: 'bedrock' | 'openai' | 'gemini'): AIProvider => ({
  type,
  isConfigured: () => true,
  stream: vi.fn(async function* () {
    yield 'Test '
    yield 'response '
    yield 'from '
    yield type
    return `Test response from ${type}`
  }),
})

const mockProviders: Record<string, AIProvider> = {
  'us.anthropic.claude-sonnet-4-6': createMockProvider('bedrock'),
  'gpt-4o': createMockProvider('openai'),
  'gemini-2.0-flash': createMockProvider('gemini'),
}

const getProviderForModel = (modelId: string) => mockProviders[modelId]

describe('runDebate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic debate without assistants', () => {
    it('should run a debate with 2 models', async () => {
      const rounds: any[] = []
      const chunks: Record<string, string[]> = {}

      const config: DebateConfig = {
        topic: 'AI의 미래',
        modelIds: ['us.anthropic.claude-sonnet-4-6', 'gpt-4o'],
        providers: Object.values(mockProviders),
        getProviderForModel,
        onRound: (round) => rounds.push(round),
        onChunk: (modelId, chunk) => {
          chunks[modelId] = chunks[modelId] ?? []
          chunks[modelId].push(chunk)
        },
      }

      const result = await runDebate(config)

      expect(result.length).toBeGreaterThan(0)
      expect(rounds.length).toBeGreaterThan(0)
      expect(Object.keys(chunks).length).toBeGreaterThan(0)
    })

    it('should throw error if less than 2 models', async () => {
      const config: DebateConfig = {
        topic: 'AI의 미래',
        modelIds: ['us.anthropic.claude-sonnet-4-6'],
        providers: Object.values(mockProviders),
        getProviderForModel,
        onRound: vi.fn(),
        onChunk: vi.fn(),
      }

      await expect(runDebate(config)).rejects.toThrow('토론에는 최소 2개의 모델이 필요합니다')
    })

    it('should handle 3 models debate', async () => {
      const rounds: any[] = []

      const config: DebateConfig = {
        topic: 'AI의 미래',
        modelIds: ['us.anthropic.claude-sonnet-4-6', 'gpt-4o', 'gemini-2.0-flash'],
        providers: Object.values(mockProviders),
        getProviderForModel,
        onRound: (round) => rounds.push(round),
        onChunk: vi.fn(),
      }

      await runDebate(config)

      const round1 = rounds.filter((r) => r.round === 1)
      expect(round1.length).toBe(3)
    })
  })

  describe('Assistant integration', () => {
    it('should accept assistantId in DebateParticipant', () => {
      const participant: DebateParticipant = {
        modelId: 'us.anthropic.claude-sonnet-4-6',
        assistantId: 'ast-default',
      }

      expect(participant.modelId).toBe('us.anthropic.claude-sonnet-4-6')
      expect(participant.assistantId).toBe('ast-default')
    })

    it('should work without assistantId (backward compatibility)', async () => {
      const rounds: any[] = []

      const config: DebateConfig = {
        topic: 'AI의 미래',
        modelIds: ['us.anthropic.claude-sonnet-4-6', 'gpt-4o'],
        providers: Object.values(mockProviders),
        getProviderForModel,
        onRound: (round) => rounds.push(round),
        onChunk: vi.fn(),
      }

      await runDebate(config)

      expect(rounds.length).toBeGreaterThan(0)
    })

    it('should prepend assistant systemPrompt when assistantId is provided', async () => {
      let firstCallPrompt = ''
      const mockStreamWithAssistant = vi.fn(async function* (params: any) {
        if (!firstCallPrompt) {
          firstCallPrompt = params.systemPrompt
        }
        yield 'Test '
        yield 'response'
        return 'Test response'
      })

      const mockProvider: AIProvider = {
        type: 'bedrock',
        isConfigured: () => true,
        stream: mockStreamWithAssistant,
      }

      const participants: DebateParticipant[] = [
        { modelId: 'us.anthropic.claude-sonnet-4-6', assistantId: 'ast-default' },
        { modelId: 'gpt-4o' },
      ]

      const config: DebateConfig = {
        topic: 'AI의 미래',
        modelIds: ['us.anthropic.claude-sonnet-4-6', 'gpt-4o'],
        participants,
        providers: [mockProvider, mockProviders['gpt-4o']],
        getProviderForModel: (id) => (id === 'us.anthropic.claude-sonnet-4-6' ? mockProvider : mockProviders[id]),
        onRound: vi.fn(),
        onChunk: vi.fn(),
      }

      await runDebate(config)

      expect(mockStreamWithAssistant).toHaveBeenCalled()
      expect(firstCallPrompt).toContain('문서 검토 전문가')
      expect(firstCallPrompt).toContain('토론 참가자')
    })

    it('should support both participants with different assistants', async () => {
      const capturedPrompts: Record<string, string> = {}

      const createProviderWithCapture = (modelId: string): AIProvider => ({
        type: 'bedrock',
        isConfigured: () => true,
        stream: vi.fn(async function* (params: any) {
          capturedPrompts[modelId] = params.systemPrompt
          yield 'Test response'
          return 'Test response'
        }),
      })

      const provider1 = createProviderWithCapture('us.anthropic.claude-sonnet-4-6')
      const provider2 = createProviderWithCapture('gpt-4o')

      const participants: DebateParticipant[] = [
        { modelId: 'us.anthropic.claude-sonnet-4-6', assistantId: 'ast-default' },
        { modelId: 'gpt-4o', assistantId: 'ast-translator' },
      ]

      const config: DebateConfig = {
        topic: 'AI의 미래',
        modelIds: ['us.anthropic.claude-sonnet-4-6', 'gpt-4o'],
        participants,
        providers: [provider1, provider2],
        getProviderForModel: (id) => (id === 'us.anthropic.claude-sonnet-4-6' ? provider1 : provider2),
        onRound: vi.fn(),
        onChunk: vi.fn(),
      }

      await runDebate(config)

      expect(capturedPrompts['us.anthropic.claude-sonnet-4-6']).toContain('문서 검토 전문가')
      expect(capturedPrompts['gpt-4o']).toContain('전문 통역사')
    })

    it('should support one participant with assistant, one without', async () => {
      const firstCallPrompts: Record<string, string> = {}

      const createProviderWithCapture = (modelId: string): AIProvider => {
        let callCount = 0
        return {
          type: 'bedrock',
          isConfigured: () => true,
          stream: vi.fn(async function* (params: any) {
            if (callCount === 0) {
              firstCallPrompts[modelId] = params.systemPrompt
            }
            callCount++
            yield 'Test response'
            return 'Test response'
          }),
        }
      }

      const provider1 = createProviderWithCapture('us.anthropic.claude-sonnet-4-6')
      const provider2 = createProviderWithCapture('gpt-4o')

      const participants: DebateParticipant[] = [
        { modelId: 'us.anthropic.claude-sonnet-4-6', assistantId: 'ast-default' },
        { modelId: 'gpt-4o' },
      ]

      const config: DebateConfig = {
        topic: 'AI의 미래',
        modelIds: ['us.anthropic.claude-sonnet-4-6', 'gpt-4o'],
        participants,
        providers: [provider1, provider2],
        getProviderForModel: (id) => (id === 'us.anthropic.claude-sonnet-4-6' ? provider1 : provider2),
        onRound: vi.fn(),
        onChunk: vi.fn(),
      }

      await runDebate(config)

      expect(firstCallPrompts['us.anthropic.claude-sonnet-4-6']).toContain('문서 검토 전문가')
      expect(firstCallPrompts['gpt-4o']).not.toContain('문서 검토 전문가')
      expect(firstCallPrompts['gpt-4o']).toContain('토론 참가자')
    })

    it('should gracefully handle non-existent assistantId', async () => {
      const capturedPrompts: string[] = []

      const mockProvider: AIProvider = {
        type: 'bedrock',
        isConfigured: () => true,
        stream: vi.fn(async function* (params: any) {
          capturedPrompts.push(params.systemPrompt)
          yield 'Test response'
          return 'Test response'
        }),
      }

      const participants: DebateParticipant[] = [
        { modelId: 'us.anthropic.claude-sonnet-4-6', assistantId: 'non-existent-id' },
        { modelId: 'gpt-4o' },
      ]

      const config: DebateConfig = {
        topic: 'AI의 미래',
        modelIds: ['us.anthropic.claude-sonnet-4-6', 'gpt-4o'],
        participants,
        providers: [mockProvider, mockProviders['gpt-4o']],
        getProviderForModel: (id) => (id === 'us.anthropic.claude-sonnet-4-6' ? mockProvider : mockProviders[id]),
        onRound: vi.fn(),
        onChunk: vi.fn(),
      }

      await runDebate(config)

      expect(capturedPrompts[0]).toContain('토론 참가자')
      expect(capturedPrompts[0]).not.toContain('문서 검토 전문가')
    })

    it('should treat empty assistantId as no assistant', async () => {
      const capturedPrompts: string[] = []

      const mockProvider: AIProvider = {
        type: 'bedrock',
        isConfigured: () => true,
        stream: vi.fn(async function* (params: any) {
          capturedPrompts.push(params.systemPrompt)
          yield 'Test response'
          return 'Test response'
        }),
      }

      const participants: DebateParticipant[] = [
        { modelId: 'us.anthropic.claude-sonnet-4-6', assistantId: '' },
        { modelId: 'gpt-4o' },
      ]

      const config: DebateConfig = {
        topic: 'AI의 미래',
        modelIds: ['us.anthropic.claude-sonnet-4-6', 'gpt-4o'],
        participants,
        providers: [mockProvider, mockProviders['gpt-4o']],
        getProviderForModel: (id) => (id === 'us.anthropic.claude-sonnet-4-6' ? mockProvider : mockProviders[id]),
        onRound: vi.fn(),
        onChunk: vi.fn(),
      }

      await runDebate(config)

      expect(capturedPrompts[0]).toBe('당신은 토론 참가자입니다. 주어진 주제에 대해 자신의 견해를 명확하고 논리적으로 제시해주세요. 한국어로 답변하세요.')
    })

    it('should ensure assistant systemPrompt comes before debate prompt', async () => {
      const capturedPrompts: string[] = []

      const mockProvider: AIProvider = {
        type: 'bedrock',
        isConfigured: () => true,
        stream: vi.fn(async function* (params: any) {
          capturedPrompts.push(params.systemPrompt)
          yield 'Test response'
          return 'Test response'
        }),
      }

      const participants: DebateParticipant[] = [
        { modelId: 'us.anthropic.claude-sonnet-4-6', assistantId: 'ast-default' },
        { modelId: 'gpt-4o' },
      ]

      const config: DebateConfig = {
        topic: 'AI의 미래',
        modelIds: ['us.anthropic.claude-sonnet-4-6', 'gpt-4o'],
        participants,
        providers: [mockProvider, mockProviders['gpt-4o']],
        getProviderForModel: (id) => (id === 'us.anthropic.claude-sonnet-4-6' ? mockProvider : mockProviders[id]),
        onRound: vi.fn(),
        onChunk: vi.fn(),
      }

      await runDebate(config)

      const systemPrompt = capturedPrompts[0]
      const assistantIndex = systemPrompt.indexOf('문서 검토 전문가')
      const debateIndex = systemPrompt.indexOf('토론 참가자')

      expect(assistantIndex).toBeLessThan(debateIndex)
    })
  })

  describe('Debate structure with assistants', () => {
    it('should maintain debate round structure with assistants', async () => {
      const rounds: any[] = []

      const participants: DebateParticipant[] = [
        { modelId: 'us.anthropic.claude-sonnet-4-6', assistantId: 'ast-default' },
        { modelId: 'gpt-4o', assistantId: 'ast-translator' },
      ]

      const config: DebateConfig = {
        topic: 'AI의 미래',
        modelIds: ['us.anthropic.claude-sonnet-4-6', 'gpt-4o'],
        participants,
        providers: Object.values(mockProviders),
        getProviderForModel,
        onRound: (round) => rounds.push(round),
        onChunk: vi.fn(),
      }

      await runDebate(config)

      const round1 = rounds.filter((r) => r.round === 1)
      const round2 = rounds.filter((r) => r.round === 2)
      const round3 = rounds.filter((r) => r.round === 3)

      expect(round1.length).toBe(2)
      expect(round2.length).toBe(2)
      expect(round3.length).toBe(1)
    })

    it('should maintain assistant context across multiple rounds', async () => {
      const capturedPromptsPerRound: Record<number, string[]> = {}

      const createProviderWithRoundCapture = (): AIProvider => ({
        type: 'bedrock',
        isConfigured: () => true,
        stream: vi.fn(async function* (params: any) {
          const roundMatch = params.messages[0].content.match(/라운드 (\d+)/)
          const round = roundMatch ? parseInt(roundMatch[1], 10) : 1
          capturedPromptsPerRound[round] = capturedPromptsPerRound[round] ?? []
          capturedPromptsPerRound[round].push(params.systemPrompt)
          yield 'Test response'
          return 'Test response'
        }),
      })

      const provider = createProviderWithRoundCapture()

      const participants: DebateParticipant[] = [
        { modelId: 'us.anthropic.claude-sonnet-4-6', assistantId: 'ast-default' },
        { modelId: 'gpt-4o' },
      ]

      const config: DebateConfig = {
        topic: 'AI의 미래',
        modelIds: ['us.anthropic.claude-sonnet-4-6', 'gpt-4o'],
        participants,
        providers: [provider, mockProviders['gpt-4o']],
        getProviderForModel: (id) => (id === 'us.anthropic.claude-sonnet-4-6' ? provider : mockProviders[id]),
        onRound: vi.fn(),
        onChunk: vi.fn(),
      }

      await runDebate(config)

      expect(Object.keys(capturedPromptsPerRound).length).toBeGreaterThan(0)
    })

    it('should work with assistant having empty systemPrompt', async () => {
      vi.spyOn(AssistantRegistry, 'getById').mockResolvedValue({
        id: 'test-empty',
        name: 'Empty Assistant',
        description: 'Test',
        icon: '🔧',
        systemPrompt: '',
        model: '',
        tools: [],
        parameters: {},
        category: 'other',
        isBuiltIn: false,
        usageCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      const rounds: any[] = []

      const participants: DebateParticipant[] = [
        { modelId: 'us.anthropic.claude-sonnet-4-6', assistantId: 'test-empty' },
        { modelId: 'gpt-4o' },
      ]

      const config: DebateConfig = {
        topic: 'AI의 미래',
        modelIds: ['us.anthropic.claude-sonnet-4-6', 'gpt-4o'],
        participants,
        providers: Object.values(mockProviders),
        getProviderForModel,
        onRound: (round) => rounds.push(round),
        onChunk: vi.fn(),
      }

      await runDebate(config)

      expect(rounds.length).toBeGreaterThan(0)

      vi.restoreAllMocks()
    })

    it('should serialize DebateConfig with assistantId correctly', () => {
      const participants: DebateParticipant[] = [
        { modelId: 'us.anthropic.claude-sonnet-4-6', assistantId: 'ast-default' },
        { modelId: 'gpt-4o' },
      ]

      const config: Partial<DebateConfig> = {
        topic: 'AI의 미래',
        modelIds: ['us.anthropic.claude-sonnet-4-6', 'gpt-4o'],
        participants,
      }

      const serialized = JSON.stringify(config)
      const deserialized = JSON.parse(serialized)

      expect(deserialized.participants[0].assistantId).toBe('ast-default')
      expect(deserialized.participants[1].assistantId).toBeUndefined()
    })
  })
})
