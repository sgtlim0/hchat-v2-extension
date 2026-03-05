// lib/debate.ts — Cross-model debate engine with voting integration

import type { AIProvider } from './providers/types'
import { Usage } from './usage'
import { AssistantRegistry } from './assistantBuilder'
import {
  type VotingConfig,
  type DebateScoreboard,
  calculateScoreboard,
  checkConsensus,
  buildVotingPrompt,
  parseVotingResponse,
  validateParticipants,
} from './debateVoting'

export interface DebateParticipant {
  modelId: string
  assistantId?: string
}

export interface DebateRound {
  round: number
  modelId: string
  provider: string
  role: 'initial' | 'critique' | 'synthesis' | 'voting'
  content: string
  ms: number
}

export interface DebateConfig {
  topic: string
  modelIds: string[]
  participants?: DebateParticipant[]
  providers: AIProvider[]
  getProviderForModel: (id: string) => AIProvider | undefined
  onRound: (round: DebateRound) => void
  onChunk: (modelId: string, chunk: string) => void
  signal?: AbortSignal
}

export interface DebateWithVotingConfig extends DebateConfig {
  votingConfig?: VotingConfig
  onVotingComplete?: (scoreboard: DebateScoreboard) => void
}

/**
 * Run a multi-model debate:
 * Round 1: All models give initial answers (parallel)
 * Round 2: Each model critiques the others (sequential)
 * Round 3: Synthesis from first model
 */
export async function runDebate(config: DebateConfig): Promise<DebateRound[]> {
  const { topic, modelIds, participants, getProviderForModel, onRound, onChunk, signal } = config
  const rounds: DebateRound[] = []

  if (modelIds.length < 2) {
    throw new Error('토론에는 최소 2개의 모델이 필요합니다')
  }

  // Helper to get assistant system prompt
  const getAssistantPrompt = async (modelId: string): Promise<string> => {
    if (!participants) return ''
    const participant = participants.find((p) => p.modelId === modelId)
    if (!participant?.assistantId) return ''
    const assistant = await AssistantRegistry.getById(participant.assistantId)
    return assistant?.systemPrompt ?? ''
  }

  // ── Round 1: Parallel initial answers ──
  const initialAnswers: Record<string, string> = {}

  await Promise.all(
    modelIds.map(async (modelId) => {
      const start = Date.now()
      const provider = getProviderForModel(modelId)
      if (!provider?.isConfigured()) {
        const round: DebateRound = {
          round: 1, modelId, provider: provider?.type ?? 'unknown',
          role: 'initial', content: '⚠ API 키 미설정', ms: 0,
        }
        rounds.push(round)
        onRound(round)
        return
      }

      const assistantPrompt = await getAssistantPrompt(modelId)
      const debatePrompt = '당신은 토론 참가자입니다. 주어진 주제에 대해 자신의 견해를 명확하고 논리적으로 제시해주세요. 한국어로 답변하세요.'
      const systemPrompt = assistantPrompt ? `${assistantPrompt}\n\n${debatePrompt}` : debatePrompt

      let content = ''
      const gen = provider.stream({
        model: modelId,
        messages: [{ role: 'user', content: topic }],
        systemPrompt,
        signal,
      })

      for await (const chunk of gen) {
        content += chunk
        onChunk(modelId, chunk)
      }

      initialAnswers[modelId] = content
      const round: DebateRound = {
        round: 1, modelId, provider: provider.type,
        role: 'initial', content, ms: Date.now() - start,
      }
      rounds.push(round)
      onRound(round)
      Usage.track(modelId, provider.type, topic, content, 'debate').catch(() => {})
    })
  )

  if (signal?.aborted) return rounds

  // ── Round 2: Sequential critique ──
  const otherAnswers = (currentModelId: string) =>
    modelIds
      .filter((id) => id !== currentModelId)
      .map((id) => `[${id}의 답변]:\n${initialAnswers[id] ?? '(답변 없음)'}`)
      .join('\n\n')

  for (const modelId of modelIds) {
    if (signal?.aborted) break

    const start = Date.now()
    const provider = getProviderForModel(modelId)
    if (!provider?.isConfigured()) continue

    const critiquePrompt = `주제: ${topic}\n\n다른 참가자들의 답변:\n${otherAnswers(modelId)}\n\n위 답변들의 장단점을 분석하고, 자신의 입장에서 비평해주세요. 동의하는 부분과 반박할 부분을 명확히 구분해주세요.`

    const assistantPrompt = await getAssistantPrompt(modelId)
    const debateCritiquePrompt = '당신은 토론 비평가입니다. 다른 참가자의 답변을 분석하고, 논리적으로 비평해주세요. 한국어로 답변하세요.'
    const systemPrompt = assistantPrompt ? `${assistantPrompt}\n\n${debateCritiquePrompt}` : debateCritiquePrompt

    let content = ''
    const gen = provider.stream({
      model: modelId,
      messages: [{ role: 'user', content: critiquePrompt }],
      systemPrompt,
      signal,
    })

    for await (const chunk of gen) {
      content += chunk
      onChunk(modelId, chunk)
    }

    const round: DebateRound = {
      round: 2, modelId, provider: provider.type,
      role: 'critique', content, ms: Date.now() - start,
    }
    rounds.push(round)
    onRound(round)
    Usage.track(modelId, provider.type, critiquePrompt, content, 'debate').catch(() => {})
  }

  if (signal?.aborted) return rounds

  // ── Round 3: Synthesis from first model ──
  const synthModelId = modelIds[0]
  const synthProvider = getProviderForModel(synthModelId)
  if (synthProvider?.isConfigured()) {
    const start = Date.now()

    const allRounds = rounds
      .map((r) => `[라운드 ${r.round} - ${r.modelId} (${r.role})]:\n${r.content}`)
      .join('\n\n---\n\n')

    const synthPrompt = `주제: ${topic}\n\n지금까지의 토론 내용:\n${allRounds}\n\n모든 참가자의 의견과 비평을 종합하여, 핵심 합의점, 주요 쟁점, 그리고 최종 결론을 정리해주세요.`

    const assistantPrompt = await getAssistantPrompt(synthModelId)
    const debateSynthPrompt = '당신은 토론 사회자입니다. 모든 참가자의 의견을 공정하게 종합하여 결론을 도출해주세요. 한국어로 답변하세요.'
    const systemPrompt = assistantPrompt ? `${assistantPrompt}\n\n${debateSynthPrompt}` : debateSynthPrompt

    let content = ''
    const gen = synthProvider.stream({
      model: synthModelId,
      messages: [{ role: 'user', content: synthPrompt }],
      systemPrompt,
      signal,
    })

    for await (const chunk of gen) {
      content += chunk
      onChunk(synthModelId, chunk)
    }

    const round: DebateRound = {
      round: 3, modelId: synthModelId, provider: synthProvider.type,
      role: 'synthesis', content, ms: Date.now() - start,
    }
    rounds.push(round)
    onRound(round)
    Usage.track(synthModelId, synthProvider.type, synthPrompt, content, 'debate').catch(() => {})
  }

  return rounds
}

/**
 * Run a debate with optional voting round after critique.
 * Round 1: Initial answers (parallel)
 * Round 2: Critique (sequential)
 * Round 2.5: Voting round (each model evaluates others, if enabled)
 * Round 3: Synthesis
 */
export async function runDebateWithVoting(
  config: DebateWithVotingConfig
): Promise<DebateRound[]> {
  const { votingConfig, onVotingComplete, ...baseConfig } = config
  const { topic, modelIds, getProviderForModel, onRound, onChunk, signal } = baseConfig

  // Validate participant count against voting config
  if (votingConfig?.enableVoting) {
    const validationError = validateParticipants(modelIds.length, votingConfig)
    if (validationError) {
      throw new Error(validationError)
    }
  }

  // Run base debate (rounds 1-3)
  const rounds = await runDebate(baseConfig)

  // If voting is disabled or aborted, return base rounds
  if (!votingConfig?.enableVoting || !votingConfig.votingRound || signal?.aborted) {
    return rounds
  }

  // ── Voting Round: After critique, before synthesis ──
  // Collect initial answers for voting prompt
  const initialResponses = rounds
    .filter((r) => r.role === 'initial')
    .map((r) => ({ modelId: r.modelId, content: r.content }))

  const allVotes: import('./debateVoting').DebateVote[] = []

  for (const modelId of modelIds) {
    if (signal?.aborted) break

    const provider = getProviderForModel(modelId)
    if (!provider?.isConfigured()) continue

    const start = Date.now()
    const votingPrompt = buildVotingPrompt(topic, initialResponses, modelId)

    let content = ''
    const gen = provider.stream({
      model: modelId,
      messages: [{ role: 'user', content: votingPrompt }],
      systemPrompt: '당신은 토론 심사위원입니다. 각 참가자의 답변을 1~5점으로 공정하게 평가해주세요. 한국어로 답변하세요.',
      signal,
    })

    for await (const chunk of gen) {
      content += chunk
      onChunk(modelId, chunk)
    }

    // Parse votes from AI response
    const votes = parseVotingResponse(content, modelIds, modelId)
    const votesWithRound = votes.map((v) => ({ ...v, round: 2 }))
    allVotes.push(...votesWithRound)

    const round: DebateRound = {
      round: 2, modelId, provider: provider.type,
      role: 'voting', content, ms: Date.now() - start,
    }
    rounds.push(round)
    onRound(round)
    Usage.track(modelId, provider.type, votingPrompt, content, 'debate').catch(() => {})
  }

  // Calculate scoreboard and check consensus
  if (allVotes.length > 0) {
    const scoreboard = calculateScoreboard(allVotes, modelIds)
    const consensus = checkConsensus(allVotes, modelIds, votingConfig.consensusThreshold)
    const finalScoreboard: DebateScoreboard = {
      ...scoreboard,
      consensusResult: consensus,
    }
    onVotingComplete?.(finalScoreboard)
  }

  return rounds
}
