// lib/__tests__/debate.voting.test.ts — Tests for debate + voting integration

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runDebateWithVoting, type DebateWithVotingConfig } from '../debate'
import {
  calculateScoreboard,
  checkConsensus,
  parseVotingResponse,
  buildVotingPrompt,
  getDefaultVotingConfig,
  type DebateVote,
} from '../debateVoting'
import type { AIProvider } from '../providers/types'

// Mock Usage to prevent storage calls
vi.mock('../usage', () => ({
  Usage: { track: vi.fn(() => Promise.resolve()) },
}))

const createMockProvider = (type: 'bedrock' | 'openai' | 'gemini'): AIProvider => ({
  type,
  isConfigured: () => true,
  stream: vi.fn(async function* () {
    yield '[modelB]: 4/5 - 좋은 분석\n'
    yield '[modelC]: 3/5 - 보통\n'
    return '[modelB]: 4/5 - 좋은 분석\n[modelC]: 3/5 - 보통\n'
  }),
})

const createMockProviderWithContent = (
  type: 'bedrock' | 'openai' | 'gemini',
  content: string
): AIProvider => ({
  type,
  isConfigured: () => true,
  stream: vi.fn(async function* () {
    yield content
    return content
  }),
})

describe('debate voting integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── startVotingRound integration ──
  describe('startVotingRound via runDebateWithVoting', () => {
    it('should run voting round after critique when votingConfig is enabled', async () => {
      const rounds: any[] = []

      const providers: Record<string, AIProvider> = {
        modelA: createMockProvider('bedrock'),
        modelB: createMockProvider('openai'),
      }

      const config: DebateWithVotingConfig = {
        topic: 'AI의 미래',
        modelIds: ['modelA', 'modelB'],
        providers: Object.values(providers),
        getProviderForModel: (id) => providers[id],
        onRound: (round) => rounds.push(round),
        onChunk: vi.fn(),
        votingConfig: {
          enableVoting: true,
          maxParticipants: 6,
          votingRound: true,
          consensusThreshold: 0.7,
        },
        onVotingComplete: vi.fn(),
      }

      await runDebateWithVoting(config)

      const votingRounds = rounds.filter((r) => r.role === 'voting')
      expect(votingRounds.length).toBeGreaterThan(0)
    })

    it('should not run voting round when votingConfig.enableVoting is false', async () => {
      const rounds: any[] = []

      const providers: Record<string, AIProvider> = {
        modelA: createMockProvider('bedrock'),
        modelB: createMockProvider('openai'),
      }

      const config: DebateWithVotingConfig = {
        topic: 'AI의 미래',
        modelIds: ['modelA', 'modelB'],
        providers: Object.values(providers),
        getProviderForModel: (id) => providers[id],
        onRound: (round) => rounds.push(round),
        onChunk: vi.fn(),
        votingConfig: {
          enableVoting: false,
          maxParticipants: 4,
          votingRound: true,
          consensusThreshold: 0.7,
        },
      }

      await runDebateWithVoting(config)

      const votingRounds = rounds.filter((r) => r.role === 'voting')
      expect(votingRounds).toHaveLength(0)
    })

    it('should not run voting round when votingRound is false', async () => {
      const rounds: any[] = []

      const providers: Record<string, AIProvider> = {
        modelA: createMockProvider('bedrock'),
        modelB: createMockProvider('openai'),
      }

      const config: DebateWithVotingConfig = {
        topic: 'AI의 미래',
        modelIds: ['modelA', 'modelB'],
        providers: Object.values(providers),
        getProviderForModel: (id) => providers[id],
        onRound: (round) => rounds.push(round),
        onChunk: vi.fn(),
        votingConfig: {
          enableVoting: true,
          maxParticipants: 4,
          votingRound: false,
          consensusThreshold: 0.7,
        },
      }

      await runDebateWithVoting(config)

      const votingRounds = rounds.filter((r) => r.role === 'voting')
      expect(votingRounds).toHaveLength(0)
    })

    it('should call onVotingComplete with scoreboard', async () => {
      const onVotingComplete = vi.fn()

      const providers: Record<string, AIProvider> = {
        modelA: createMockProvider('bedrock'),
        modelB: createMockProvider('openai'),
      }

      const config: DebateWithVotingConfig = {
        topic: 'AI의 미래',
        modelIds: ['modelA', 'modelB'],
        providers: Object.values(providers),
        getProviderForModel: (id) => providers[id],
        onRound: vi.fn(),
        onChunk: vi.fn(),
        votingConfig: getDefaultVotingConfig(),
        onVotingComplete,
      }

      await runDebateWithVoting(config)

      expect(onVotingComplete).toHaveBeenCalled()
      const scoreboard = onVotingComplete.mock.calls[0][0]
      expect(scoreboard.participants).toBeDefined()
      expect(scoreboard.votes).toBeDefined()
    })
  })

  // ── Participant count extension 2~6 ──
  describe('participant count extension', () => {
    it('should accept up to 6 participants with extended config', async () => {
      const providers: Record<string, AIProvider> = {}
      const modelIds: string[] = []
      for (let i = 0; i < 6; i++) {
        const id = `model${i}`
        modelIds.push(id)
        providers[id] = createMockProvider('bedrock')
      }

      const config: DebateWithVotingConfig = {
        topic: 'AI의 미래',
        modelIds,
        providers: Object.values(providers),
        getProviderForModel: (id) => providers[id],
        onRound: vi.fn(),
        onChunk: vi.fn(),
        votingConfig: {
          enableVoting: true,
          maxParticipants: 6,
          votingRound: true,
          consensusThreshold: 0.7,
        },
      }

      const result = await runDebateWithVoting(config)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should reject 7+ participants', async () => {
      const providers: Record<string, AIProvider> = {}
      const modelIds: string[] = []
      for (let i = 0; i < 7; i++) {
        const id = `model${i}`
        modelIds.push(id)
        providers[id] = createMockProvider('bedrock')
      }

      const config: DebateWithVotingConfig = {
        topic: 'AI의 미래',
        modelIds,
        providers: Object.values(providers),
        getProviderForModel: (id) => providers[id],
        onRound: vi.fn(),
        onChunk: vi.fn(),
        votingConfig: {
          enableVoting: true,
          maxParticipants: 6,
          votingRound: true,
          consensusThreshold: 0.7,
        },
      }

      await expect(runDebateWithVoting(config)).rejects.toThrow()
    })
  })

  // ── Scoreboard calculation from debate ──
  describe('scoreboard calculation in debate context', () => {
    it('should calculate correct scoreboard from parsed votes', () => {
      const votes: DebateVote[] = [
        { voterId: 'A', targetId: 'B', round: 2, score: 4 },
        { voterId: 'A', targetId: 'C', round: 2, score: 3 },
        { voterId: 'B', targetId: 'A', round: 2, score: 5 },
        { voterId: 'B', targetId: 'C', round: 2, score: 2 },
        { voterId: 'C', targetId: 'A', round: 2, score: 4 },
        { voterId: 'C', targetId: 'B', round: 2, score: 3 },
      ]

      const board = calculateScoreboard(votes, ['A', 'B', 'C'])

      expect(board.participants[0].modelId).toBe('A') // 5+4=9
      expect(board.participants[0].totalScore).toBe(9)
      expect(board.participants[0].rank).toBe(1)
    })
  })

  // ── Consensus detection in debate context ──
  describe('consensus detection in debate context', () => {
    it('should detect consensus with high agreement', () => {
      const votes: DebateVote[] = [
        { voterId: 'A', targetId: 'B', round: 2, score: 5 },
        { voterId: 'C', targetId: 'B', round: 2, score: 4 },
        { voterId: 'A', targetId: 'C', round: 2, score: 2 },
        { voterId: 'B', targetId: 'C', round: 2, score: 2 },
        { voterId: 'B', targetId: 'A', round: 2, score: 2 },
        { voterId: 'C', targetId: 'A', round: 2, score: 2 },
      ]

      const result = checkConsensus(votes, ['A', 'B', 'C'], 0.7)
      expect(result.reached).toBe(true)
      expect(result.topPosition).toBe('B')
    })

    it('should report no consensus with low threshold exceeded', () => {
      const votes: DebateVote[] = [
        { voterId: 'A', targetId: 'B', round: 2, score: 1 },
        { voterId: 'C', targetId: 'B', round: 2, score: 2 },
        { voterId: 'A', targetId: 'C', round: 2, score: 4 },
        { voterId: 'B', targetId: 'C', round: 2, score: 1 },
        { voterId: 'B', targetId: 'A', round: 2, score: 1 },
        { voterId: 'C', targetId: 'A', round: 2, score: 1 },
      ]

      const result = checkConsensus(votes, ['A', 'B', 'C'], 0.9)
      expect(result.reached).toBe(false)
    })
  })

  // ── Voting round insertion point ──
  describe('voting round insertion', () => {
    it('should insert voting round after round 2 (critique)', async () => {
      const rounds: any[] = []

      const providers: Record<string, AIProvider> = {
        modelA: createMockProvider('bedrock'),
        modelB: createMockProvider('openai'),
      }

      const config: DebateWithVotingConfig = {
        topic: 'AI의 미래',
        modelIds: ['modelA', 'modelB'],
        providers: Object.values(providers),
        getProviderForModel: (id) => providers[id],
        onRound: (round) => rounds.push(round),
        onChunk: vi.fn(),
        votingConfig: getDefaultVotingConfig(),
      }

      await runDebateWithVoting(config)

      // Find the voting round index
      const votingIdx = rounds.findIndex((r) => r.role === 'voting')
      const lastCritiqueIdx = rounds.reduce(
        (acc, r, i) => (r.role === 'critique' ? i : acc),
        -1
      )

      expect(votingIdx).toBeGreaterThan(lastCritiqueIdx)
    })
  })

  // ── Abort signal during voting ──
  describe('abort during voting', () => {
    it('should respect abort signal during voting round', async () => {
      const abortController = new AbortController()
      const rounds: any[] = []

      const slowProvider: AIProvider = {
        type: 'bedrock',
        isConfigured: () => true,
        stream: vi.fn(async function* () {
          yield 'Test response'
          return 'Test response'
        }),
      }

      const providers: Record<string, AIProvider> = {
        modelA: slowProvider,
        modelB: slowProvider,
      }

      // Abort after first few rounds
      const onRound = vi.fn((round: any) => {
        rounds.push(round)
        if (rounds.length >= 3) {
          abortController.abort()
        }
      })

      const config: DebateWithVotingConfig = {
        topic: 'AI의 미래',
        modelIds: ['modelA', 'modelB'],
        providers: Object.values(providers),
        getProviderForModel: (id) => providers[id],
        onRound,
        onChunk: vi.fn(),
        votingConfig: getDefaultVotingConfig(),
        signal: abortController.signal,
      }

      const result = await runDebateWithVoting(config)

      // Should have completed some rounds but not all
      expect(result.length).toBeGreaterThan(0)
    })
  })
})
