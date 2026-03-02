// lib/debate.ts — Cross-model debate engine

import type { AIProvider } from './providers/types'
import { Usage } from './usage'

export interface DebateRound {
  round: number
  modelId: string
  provider: string
  role: 'initial' | 'critique' | 'synthesis'
  content: string
  ms: number
}

export interface DebateConfig {
  topic: string
  modelIds: string[]
  providers: AIProvider[]
  getProviderForModel: (id: string) => AIProvider | undefined
  onRound: (round: DebateRound) => void
  onChunk: (modelId: string, chunk: string) => void
  signal?: AbortSignal
}

/**
 * Run a multi-model debate:
 * Round 1: All models give initial answers (parallel)
 * Round 2: Each model critiques the others (sequential)
 * Round 3: Synthesis from first model
 */
export async function runDebate(config: DebateConfig): Promise<DebateRound[]> {
  const { topic, modelIds, getProviderForModel, onRound, onChunk, signal } = config
  const rounds: DebateRound[] = []

  if (modelIds.length < 2) {
    throw new Error('토론에는 최소 2개의 모델이 필요합니다')
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

      let content = ''
      const gen = provider.stream({
        model: modelId,
        messages: [{ role: 'user', content: topic }],
        systemPrompt: '당신은 토론 참가자입니다. 주어진 주제에 대해 자신의 견해를 명확하고 논리적으로 제시해주세요. 한국어로 답변하세요.',
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

    let content = ''
    const gen = provider.stream({
      model: modelId,
      messages: [{ role: 'user', content: critiquePrompt }],
      systemPrompt: '당신은 토론 비평가입니다. 다른 참가자의 답변을 분석하고, 논리적으로 비평해주세요. 한국어로 답변하세요.',
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

    let content = ''
    const gen = synthProvider.stream({
      model: synthModelId,
      messages: [{ role: 'user', content: synthPrompt }],
      systemPrompt: '당신은 토론 사회자입니다. 모든 참가자의 의견을 공정하게 종합하여 결론을 도출해주세요. 한국어로 답변하세요.',
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
