// lib/__tests__/debateVoting.test.ts — Tests for debate voting and consensus system

import { describe, it, expect } from 'vitest'
import {
  getDefaultVotingConfig,
  validateParticipants,
  calculateScoreboard,
  checkConsensus,
  buildVotingPrompt,
  parseVotingResponse,
  buildConsensusSummaryPrompt,
  type DebateVote,
  type VotingConfig,
} from '../debateVoting'

describe('debateVoting', () => {
  // ── getDefaultVotingConfig ──
  describe('getDefaultVotingConfig', () => {
    it('should return correct defaults', () => {
      const config = getDefaultVotingConfig()

      expect(config.enableVoting).toBe(true)
      expect(config.maxParticipants).toBe(4)
      expect(config.votingRound).toBe(true)
      expect(config.consensusThreshold).toBe(0.7)
    })
  })

  // ── validateParticipants ──
  describe('validateParticipants', () => {
    const config = getDefaultVotingConfig()

    it('should accept 2 participants', () => {
      expect(validateParticipants(2, config)).toBeNull()
    })

    it('should accept 4 participants (default max)', () => {
      expect(validateParticipants(4, config)).toBeNull()
    })

    it('should accept 6 participants with extended config', () => {
      const extendedConfig: VotingConfig = { ...config, maxParticipants: 6 }
      expect(validateParticipants(6, extendedConfig)).toBeNull()
    })

    it('should reject 1 participant', () => {
      const error = validateParticipants(1, config)
      expect(error).toBe('토론에는 최소 2명의 참가자가 필요합니다')
    })

    it('should reject 0 participants', () => {
      const error = validateParticipants(0, config)
      expect(error).not.toBeNull()
    })

    it('should reject exceeding maxParticipants', () => {
      const error = validateParticipants(5, config)
      expect(error).toContain('최대 4명')
    })

    it('should reject more than 7 even with high maxParticipants', () => {
      const highConfig: VotingConfig = { ...config, maxParticipants: 10 }
      const error = validateParticipants(7, highConfig)
      expect(error).toContain('최대')
    })
  })

  // ── calculateScoreboard ──
  describe('calculateScoreboard', () => {
    it('should calculate scores for 2 participants', () => {
      const votes: DebateVote[] = [
        { voterId: 'modelA', targetId: 'modelB', round: 1, score: 4 },
        { voterId: 'modelB', targetId: 'modelA', round: 1, score: 3 },
      ]

      const board = calculateScoreboard(votes, ['modelA', 'modelB'])

      expect(board.participants).toHaveLength(2)
      expect(board.participants[0].modelId).toBe('modelB')
      expect(board.participants[0].totalScore).toBe(4)
      expect(board.participants[1].modelId).toBe('modelA')
      expect(board.participants[1].totalScore).toBe(3)
    })

    it('should calculate scores for 3 participants', () => {
      const votes: DebateVote[] = [
        { voterId: 'A', targetId: 'B', round: 1, score: 5 },
        { voterId: 'A', targetId: 'C', round: 1, score: 2 },
        { voterId: 'B', targetId: 'A', round: 1, score: 4 },
        { voterId: 'B', targetId: 'C', round: 1, score: 3 },
        { voterId: 'C', targetId: 'A', round: 1, score: 4 },
        { voterId: 'C', targetId: 'B', round: 1, score: 4 },
      ]

      const board = calculateScoreboard(votes, ['A', 'B', 'C'])

      const findParticipant = (id: string) => board.participants.find((p) => p.modelId === id)!

      expect(findParticipant('B').totalScore).toBe(9) // 5 + 4
      expect(findParticipant('A').totalScore).toBe(8) // 4 + 4
      expect(findParticipant('C').totalScore).toBe(5) // 2 + 3
      expect(board.participants[0].rank).toBe(1)
    })

    it('should handle empty votes', () => {
      const board = calculateScoreboard([], ['A', 'B'])

      expect(board.participants).toHaveLength(2)
      expect(board.participants[0].totalScore).toBe(0)
      expect(board.participants[0].avgScore).toBe(0)
    })

    it('should handle ties correctly', () => {
      const votes: DebateVote[] = [
        { voterId: 'C', targetId: 'A', round: 1, score: 4 },
        { voterId: 'C', targetId: 'B', round: 1, score: 4 },
      ]

      const board = calculateScoreboard(votes, ['A', 'B', 'C'])

      const rankA = board.participants.find((p) => p.modelId === 'A')!.rank
      const rankB = board.participants.find((p) => p.modelId === 'B')!.rank

      expect(rankA).toBe(rankB)
    })
  })

  // ── checkConsensus ──
  describe('checkConsensus', () => {
    it('should detect consensus when top score exceeds threshold', () => {
      const votes: DebateVote[] = [
        { voterId: 'A', targetId: 'B', round: 1, score: 5 },
        { voterId: 'C', targetId: 'B', round: 1, score: 4 },
        { voterId: 'A', targetId: 'C', round: 1, score: 2 },
        { voterId: 'B', targetId: 'C', round: 1, score: 2 },
        { voterId: 'B', targetId: 'A', round: 1, score: 2 },
        { voterId: 'C', targetId: 'A', round: 1, score: 2 },
      ]

      const result = checkConsensus(votes, ['A', 'B', 'C'], 0.7)

      expect(result.reached).toBe(true)
      expect(result.topPosition).toBe('B')
      expect(result.agreementScore).toBeGreaterThan(0)
    })

    it('should not reach consensus with low scores', () => {
      const votes: DebateVote[] = [
        { voterId: 'A', targetId: 'B', round: 1, score: 2 },
        { voterId: 'C', targetId: 'B', round: 1, score: 1 },
        { voterId: 'A', targetId: 'C', round: 1, score: 1 },
        { voterId: 'B', targetId: 'C', round: 1, score: 2 },
        { voterId: 'B', targetId: 'A', round: 1, score: 1 },
        { voterId: 'C', targetId: 'A', round: 1, score: 2 },
      ]

      // Spread: A avg=1.5, B avg=1.5, C avg=1.5 → all within 1 = consensus via spread
      // But let's make spread > 1
      const votesNoConsensus: DebateVote[] = [
        { voterId: 'A', targetId: 'B', round: 1, score: 1 },
        { voterId: 'C', targetId: 'B', round: 1, score: 2 },
        { voterId: 'A', targetId: 'C', round: 1, score: 4 },
        { voterId: 'B', targetId: 'C', round: 1, score: 1 },
        { voterId: 'B', targetId: 'A', round: 1, score: 1 },
        { voterId: 'C', targetId: 'A', round: 1, score: 1 },
      ]

      const result = checkConsensus(votesNoConsensus, ['A', 'B', 'C'], 0.9)

      // Top is C with avg 2.5, threshold*5 = 4.5, and spread = 2.5-1 = 1.5 > 1
      expect(result.reached).toBe(false)
    })

    it('should handle empty votes', () => {
      const result = checkConsensus([], ['A', 'B'], 0.7)

      expect(result.reached).toBe(false)
      expect(result.agreementScore).toBe(0)
      expect(result.topPosition).toBe('')
    })
  })

  // ── buildVotingPrompt ──
  describe('buildVotingPrompt', () => {
    const responses = [
      { modelId: 'modelA', content: 'AI는 인류에게 유익합니다' },
      { modelId: 'modelB', content: 'AI에는 위험이 따릅니다' },
      { modelId: 'modelC', content: 'AI는 균형이 필요합니다' },
    ]

    it('should contain topic and other responses', () => {
      const prompt = buildVotingPrompt('AI의 미래', responses, 'modelA')

      expect(prompt).toContain('AI의 미래')
      expect(prompt).toContain('[modelB]')
      expect(prompt).toContain('[modelC]')
      expect(prompt).toContain('AI에는 위험이 따릅니다')
    })

    it('should exclude current model from evaluation targets', () => {
      const prompt = buildVotingPrompt('AI의 미래', responses, 'modelA')

      // Should not contain modelA's response as a target
      const lines = prompt.split('\n')
      const targetLines = lines.filter((l) => l.match(/\[modelA\]:\s*점수/))
      expect(targetLines).toHaveLength(0)
    })
  })

  // ── parseVotingResponse ──
  describe('parseVotingResponse', () => {
    const participantIds = ['modelA', 'modelB', 'modelC']

    it('should parse valid voting format', () => {
      const response = `
[modelB]: 4/5 - 논리적인 분석
[modelC]: 3/5 - 근거가 부족함
`
      const votes = parseVotingResponse(response, participantIds, 'modelA')

      expect(votes).toHaveLength(2)
      expect(votes.find((v) => v.targetId === 'modelB')!.score).toBe(4)
      expect(votes.find((v) => v.targetId === 'modelB')!.reasoning).toBe('논리적인 분석')
      expect(votes.find((v) => v.targetId === 'modelC')!.score).toBe(3)
    })

    it('should parse partial format and default missing to 3', () => {
      const response = `[modelB]: 5/5 - 훌륭한 답변`

      const votes = parseVotingResponse(response, participantIds, 'modelA')

      expect(votes).toHaveLength(2)
      expect(votes.find((v) => v.targetId === 'modelB')!.score).toBe(5)
      expect(votes.find((v) => v.targetId === 'modelC')!.score).toBe(3) // default
    })

    it('should default all to 3 for invalid format', () => {
      const response = '이 답변들은 모두 훌륭합니다.'

      const votes = parseVotingResponse(response, participantIds, 'modelA')

      expect(votes).toHaveLength(2)
      votes.forEach((v) => {
        expect(v.score).toBe(3)
      })
    })

    it('should handle empty response', () => {
      const votes = parseVotingResponse('', participantIds, 'modelA')

      expect(votes).toHaveLength(2)
      votes.forEach((v) => {
        expect(v.score).toBe(3)
        expect(v.voterId).toBe('modelA')
      })
    })
  })

  // ── buildConsensusSummaryPrompt ──
  describe('buildConsensusSummaryPrompt', () => {
    it('should contain topic and scoreboard data', () => {
      const scoreboard = calculateScoreboard(
        [
          { voterId: 'A', targetId: 'B', round: 1, score: 5 },
          { voterId: 'B', targetId: 'A', round: 1, score: 3 },
        ],
        ['A', 'B']
      )
      const responses = [
        { modelId: 'A', content: '답변 A' },
        { modelId: 'B', content: '답변 B' },
      ]

      const prompt = buildConsensusSummaryPrompt('AI의 미래', scoreboard, responses)

      expect(prompt).toContain('AI의 미래')
      expect(prompt).toContain('투표 결과')
      expect(prompt).toContain('답변 A')
      expect(prompt).toContain('답변 B')
      expect(prompt).toContain('1위')
    })
  })

  // ── Integration: full voting flow ──
  describe('Integration: full voting flow', () => {
    it('should flow from votes → scoreboard → consensus', () => {
      const participantIds = ['claude', 'gpt', 'gemini']

      const votes: DebateVote[] = [
        { voterId: 'claude', targetId: 'gpt', round: 1, score: 4 },
        { voterId: 'claude', targetId: 'gemini', round: 1, score: 3 },
        { voterId: 'gpt', targetId: 'claude', round: 1, score: 5 },
        { voterId: 'gpt', targetId: 'gemini', round: 1, score: 3 },
        { voterId: 'gemini', targetId: 'claude', round: 1, score: 4 },
        { voterId: 'gemini', targetId: 'gpt', round: 1, score: 4 },
      ]

      const scoreboard = calculateScoreboard(votes, participantIds)
      const consensus = checkConsensus(votes, participantIds, 0.7)

      // Claude: 5+4=9, GPT: 4+4=8, Gemini: 3+3=6
      expect(scoreboard.participants[0].modelId).toBe('claude')
      expect(scoreboard.participants[0].totalScore).toBe(9)
      expect(consensus.topPosition).toBe('claude')
      expect(consensus.agreementScore).toBeGreaterThan(0)
    })

    it('should handle 4-participant voting flow', () => {
      const ids = ['A', 'B', 'C', 'D']

      const votes: DebateVote[] = [
        { voterId: 'A', targetId: 'B', round: 1, score: 5 },
        { voterId: 'A', targetId: 'C', round: 1, score: 3 },
        { voterId: 'A', targetId: 'D', round: 1, score: 2 },
        { voterId: 'B', targetId: 'A', round: 1, score: 4 },
        { voterId: 'B', targetId: 'C', round: 1, score: 4 },
        { voterId: 'B', targetId: 'D', round: 1, score: 1 },
        { voterId: 'C', targetId: 'A', round: 1, score: 3 },
        { voterId: 'C', targetId: 'B', round: 1, score: 5 },
        { voterId: 'C', targetId: 'D', round: 1, score: 2 },
        { voterId: 'D', targetId: 'A', round: 1, score: 3 },
        { voterId: 'D', targetId: 'B', round: 1, score: 4 },
        { voterId: 'D', targetId: 'C', round: 1, score: 3 },
      ]

      const scoreboard = calculateScoreboard(votes, ids)

      expect(scoreboard.participants).toHaveLength(4)
      // B: 5+5+4=14, A: 4+3+3=10, C: 3+4+3=10, D: 2+1+2=5
      expect(scoreboard.participants[0].modelId).toBe('B')
      expect(scoreboard.participants[0].totalScore).toBe(14)
    })
  })

  // ── Score bounds ──
  describe('Score bounds', () => {
    it('should clamp scores to 1~5 range', () => {
      const votes: DebateVote[] = [
        { voterId: 'A', targetId: 'B', round: 1, score: 0 },
        { voterId: 'A', targetId: 'C', round: 1, score: 10 },
      ]

      const board = calculateScoreboard(votes, ['A', 'B', 'C'])
      const bScore = board.participants.find((p) => p.modelId === 'B')!
      const cScore = board.participants.find((p) => p.modelId === 'C')!

      expect(bScore.totalScore).toBe(1) // clamped from 0
      expect(cScore.totalScore).toBe(5) // clamped from 10
    })
  })

  // ── Rank ordering with ties ──
  describe('Rank ordering with ties', () => {
    it('should assign same rank to tied participants', () => {
      const votes: DebateVote[] = [
        { voterId: 'C', targetId: 'A', round: 1, score: 4 },
        { voterId: 'C', targetId: 'B', round: 1, score: 4 },
        { voterId: 'D', targetId: 'A', round: 1, score: 3 },
        { voterId: 'D', targetId: 'B', round: 1, score: 3 },
      ]

      const board = calculateScoreboard(votes, ['A', 'B', 'C', 'D'])

      const rankA = board.participants.find((p) => p.modelId === 'A')!.rank
      const rankB = board.participants.find((p) => p.modelId === 'B')!.rank

      expect(rankA).toBe(1)
      expect(rankB).toBe(1)
    })
  })

  // ── Agreement score accuracy ──
  describe('Agreement score accuracy', () => {
    it('should return 1.0 when top participant has perfect 5.0 avg', () => {
      const votes: DebateVote[] = [
        { voterId: 'A', targetId: 'B', round: 1, score: 5 },
        { voterId: 'C', targetId: 'B', round: 1, score: 5 },
      ]

      const result = checkConsensus(votes, ['A', 'B', 'C'], 0.7)

      expect(result.agreementScore).toBe(1.0)
    })

    it('should return proportional score for average ratings', () => {
      const votes: DebateVote[] = [
        { voterId: 'A', targetId: 'B', round: 1, score: 3 },
        { voterId: 'C', targetId: 'B', round: 1, score: 4 },
        { voterId: 'A', targetId: 'C', round: 1, score: 1 },
        { voterId: 'B', targetId: 'C', round: 1, score: 1 },
        { voterId: 'B', targetId: 'A', round: 1, score: 1 },
        { voterId: 'C', targetId: 'A', round: 1, score: 1 },
      ]

      const result = checkConsensus(votes, ['A', 'B', 'C'], 0.7)

      // B avg = 3.5, agreement = 3.5/5 = 0.7
      expect(result.agreementScore).toBe(0.7)
      expect(result.topPosition).toBe('B')
    })
  })
})
