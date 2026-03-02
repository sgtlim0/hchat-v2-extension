// providers/model-router.ts — Auto-route prompts to optimal models

import type { ModelDef, AIProvider } from './types'
import { getAllModels, getProviderForModel } from './provider-factory'

interface RouteContext {
  hasImage?: boolean
  isCodeRelated?: boolean
  needsReasoning?: boolean
  preferFast?: boolean
}

const CODE_PATTERNS = [
  /```[\s\S]*```/,
  /\b(function|class|const|let|var|import|export|def|async|await)\b/,
  /\b(코드|함수|변수|클래스|타입|인터페이스|컴포넌트|API|디버그|에러)\b/,
  /\b(code|debug|error|bug|fix|refactor|implement)\b/i,
]

const SIMPLE_PATTERNS = [
  /^(안녕|hello|hi|hey)\s*[!.?]?$/i,
  /^.{0,30}[?]$/,
]

const REASONING_PATTERNS = [
  /\b(분석|비교|장단점|평가|판단|논리|추론|근거)\b/,
  /\b(analyze|compare|evaluate|reason|explain why)\b/i,
  /\b(왜|어떻게|차이점|원인)\b/,
]

function detectContext(prompt: string, hasImage: boolean): RouteContext {
  const isCodeRelated = CODE_PATTERNS.some((p) => p.test(prompt))
  const preferFast = SIMPLE_PATTERNS.some((p) => p.test(prompt)) || prompt.length < 30
  const needsReasoning = REASONING_PATTERNS.some((p) => p.test(prompt))

  return { hasImage, isCodeRelated, needsReasoning, preferFast }
}

function scoreModel(model: ModelDef, ctx: RouteContext): number {
  let score = 0

  if (ctx.hasImage && model.capabilities.includes('vision')) score += 10
  if (ctx.hasImage && !model.capabilities.includes('vision')) return -1

  if (ctx.isCodeRelated && model.capabilities.includes('code')) score += 5
  if (ctx.needsReasoning && model.capabilities.includes('reasoning')) score += 5
  if (ctx.preferFast && model.capabilities.includes('fast')) score += 8

  // Cost efficiency bonus for simple tasks
  if (ctx.preferFast) {
    score += Math.max(0, 10 - model.cost.output)
  }

  return score
}

export function routeModel(
  prompt: string,
  providers: AIProvider[],
  hasImage = false,
): string | null {
  const ctx = detectContext(prompt, hasImage)
  const models = getAllModels(providers).filter((m) => {
    const provider = getProviderForModel(m.id, providers)
    return provider?.isConfigured()
  })

  if (models.length === 0) return null

  let bestModel = models[0]
  let bestScore = -Infinity

  for (const model of models) {
    const s = scoreModel(model, ctx)
    if (s > bestScore) {
      bestScore = s
      bestModel = model
    }
  }

  return bestModel.id
}
