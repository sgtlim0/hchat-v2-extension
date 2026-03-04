// lib/debateVoting.ts — Debate voting and consensus system

export interface DebateVote {
  voterId: string
  targetId: string
  round: number
  score: number // 1~5
  reasoning?: string
}

export interface VotingConfig {
  enableVoting: boolean
  maxParticipants: number // 2~6, default 4
  votingRound: boolean // Add voting round after critique
  consensusThreshold: number // 0.0~1.0, agreement level needed for consensus (default 0.7)
}

export interface ConsensusResult {
  reached: boolean
  agreementScore: number // 0.0~1.0
  topPosition: string // modelId with highest votes
  summary: string // Auto-generated consensus summary text
  votes: DebateVote[]
}

export interface DebateScoreboard {
  participants: {
    modelId: string
    totalScore: number
    avgScore: number
    rank: number
  }[]
  votes: DebateVote[]
  consensusResult: ConsensusResult | null
}

/** Default voting config */
export function getDefaultVotingConfig(): VotingConfig {
  return {
    enableVoting: true,
    maxParticipants: 4,
    votingRound: true,
    consensusThreshold: 0.7,
  }
}

/** Clamp score to valid range 1~5 */
function clampScore(score: number): number {
  return Math.max(1, Math.min(5, Math.round(score)))
}

/** Calculate scoreboard from votes */
export function calculateScoreboard(
  votes: DebateVote[],
  participantIds: string[]
): DebateScoreboard {
  const scoreMap: Record<string, number[]> = {}

  for (const id of participantIds) {
    scoreMap[id] = []
  }

  for (const vote of votes) {
    if (scoreMap[vote.targetId]) {
      scoreMap[vote.targetId].push(clampScore(vote.score))
    }
  }

  const scored = participantIds.map((modelId) => {
    const scores = scoreMap[modelId]
    const totalScore = scores.reduce((sum, s) => sum + s, 0)
    const avgScore = scores.length > 0 ? totalScore / scores.length : 0
    return { modelId, totalScore, avgScore, rank: 0 }
  })

  // Sort by total score desc, tie-break by avg score desc
  scored.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore
    return b.avgScore - a.avgScore
  })

  // Assign ranks (same rank for ties in both total and avg)
  let currentRank = 1
  for (let i = 0; i < scored.length; i++) {
    if (i > 0 && scored[i].totalScore === scored[i - 1].totalScore && scored[i].avgScore === scored[i - 1].avgScore) {
      scored[i] = { ...scored[i], rank: scored[i - 1].rank }
    } else {
      scored[i] = { ...scored[i], rank: currentRank }
    }
    currentRank = i + 2
  }

  return {
    participants: scored,
    votes: [...votes],
    consensusResult: null,
  }
}

/** Check if consensus is reached */
export function checkConsensus(
  votes: DebateVote[],
  participantIds: string[],
  threshold: number
): ConsensusResult {
  const scoreboard = calculateScoreboard(votes, participantIds)
  const { participants } = scoreboard

  if (participants.length === 0 || votes.length === 0) {
    return {
      reached: false,
      agreementScore: 0,
      topPosition: '',
      summary: '',
      votes: [...votes],
    }
  }

  const topParticipant = participants[0]

  // Agreement score: top participant's avg score normalized to 0~1
  const agreementScore = topParticipant.avgScore / 5

  // Check if score spread is low (all avg scores within 1 point = consensus)
  const avgScores = participants.filter((p) => p.avgScore > 0).map((p) => p.avgScore)
  const spreadIsLow =
    avgScores.length > 0 && Math.max(...avgScores) - Math.min(...avgScores) <= 1

  // Consensus: top avg >= threshold * 5, OR low spread
  const reached = topParticipant.avgScore >= threshold * 5 || spreadIsLow

  return {
    reached,
    agreementScore,
    topPosition: topParticipant.modelId,
    summary: '',
    votes: [...votes],
  }
}

/** Build voting prompt for AI to evaluate other participants */
export function buildVotingPrompt(
  topic: string,
  responses: { modelId: string; content: string }[],
  currentModelId: string
): string {
  const otherResponses = responses
    .filter((r) => r.modelId !== currentModelId)
    .map((r) => `[${r.modelId}]:\n${r.content}`)
    .join('\n\n---\n\n')

  return [
    `당신은 토론 심사위원입니다. 다음 주제에 대한 각 참가자의 답변을 평가해주세요.`,
    ``,
    `주제: ${topic}`,
    ``,
    `참가자 답변:`,
    otherResponses,
    ``,
    `각 참가자의 답변을 1~5점으로 평가하고, 간단한 이유를 제시해주세요.`,
    `다음 형식으로 답변해주세요:`,
    ``,
    ...responses
      .filter((r) => r.modelId !== currentModelId)
      .map((r) => `[${r.modelId}]: 점수/5 - 이유`),
  ].join('\n')
}

/** Parse AI voting response (extract scores from structured output) */
export function parseVotingResponse(
  response: string,
  participantIds: string[],
  voterId: string
): DebateVote[] {
  const votes: DebateVote[] = []
  const parsed = new Set<string>()

  const regex = /\[([^\]]+)\]:\s*(\d)\/5(?:\s*-\s*(.*))?/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(response)) !== null) {
    const targetId = match[1]
    const score = parseInt(match[2], 10)
    const reasoning = match[3]?.trim() || undefined

    if (participantIds.includes(targetId) && targetId !== voterId && !parsed.has(targetId)) {
      parsed.add(targetId)
      votes.push({
        voterId,
        targetId,
        round: 0,
        score: clampScore(score),
        reasoning,
      })
    }
  }

  // Default to 3/5 for unparsed participants
  for (const id of participantIds) {
    if (id !== voterId && !parsed.has(id)) {
      votes.push({
        voterId,
        targetId: id,
        round: 0,
        score: 3,
      })
    }
  }

  return votes
}

/** Validate participant count */
export function validateParticipants(count: number, config: VotingConfig): string | null {
  if (count < 2) {
    return '토론에는 최소 2명의 참가자가 필요합니다'
  }
  if (count > config.maxParticipants) {
    return `참가자 수는 최대 ${config.maxParticipants}명까지 가능합니다`
  }
  if (count > 6) {
    return '참가자 수는 최대 6명까지 가능합니다'
  }
  return null
}

/** Build consensus summary prompt */
export function buildConsensusSummaryPrompt(
  topic: string,
  scoreboard: DebateScoreboard,
  responses: { modelId: string; content: string }[]
): string {
  const rankings = scoreboard.participants
    .map((p) => `${p.rank}위: ${p.modelId} (총점: ${p.totalScore}, 평균: ${p.avgScore.toFixed(1)})`)
    .join('\n')

  const allResponses = responses
    .map((r) => `[${r.modelId}]:\n${r.content}`)
    .join('\n\n---\n\n')

  return [
    `당신은 토론 사회자입니다. 투표 결과와 각 참가자의 답변을 바탕으로 최종 합의문을 작성해주세요.`,
    ``,
    `주제: ${topic}`,
    ``,
    `투표 결과:`,
    rankings,
    ``,
    `참가자 답변:`,
    allResponses,
    ``,
    `위 내용을 종합하여 핵심 합의점과 결론을 한국어로 정리해주세요.`,
  ].join('\n')
}
