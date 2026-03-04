// lib/assistantChain.ts — 비서 체인 파이프라인 (비서1 → 비서2 → 비서3)

import { Storage } from './storage'

const STORAGE_KEY = 'hchat:assistant-chains'
const MAX_CHAINS = 20
const MAX_STEPS = 10

export interface ChainStep {
  assistantId: string
  promptTemplate: string // {{input}}: 이전 출력, {{original}}: 최초 입력
  transformOutput?: 'none' | 'trim' | 'extractFirst'
}

export interface AssistantChain {
  id: string
  name: string
  description: string
  steps: ChainStep[]
  createdAt: number
  updatedAt: number
  usageCount: number
}

export interface ChainExecutionResult {
  stepResults: ChainStepResult[]
  finalOutput: string
  totalMs: number
}

export interface ChainStepResult {
  stepIndex: number
  assistantId: string
  input: string
  output: string
  ms: number
}

// 템플릿 변수 치환: {{input}}은 이전 단계 출력, {{original}}은 최초 입력
export function resolveTemplate(template: string, input: string, original: string): string {
  return template
    .replace(/\{\{input\}\}/g, input)
    .replace(/\{\{original\}\}/g, original)
}

// 체인 유효성 검증 — 오류 메시지 반환, 유효하면 null
export function validateChain(chain: Pick<AssistantChain, 'name' | 'steps'>): string | null {
  if (!chain.name.trim()) {
    return '체인 이름이 필요합니다'
  }

  if (chain.steps.length < 2) {
    return '최소 2개 이상의 단계가 필요합니다'
  }

  if (chain.steps.length > MAX_STEPS) {
    return `최대 ${MAX_STEPS}개의 단계만 허용됩니다`
  }

  for (let i = 0; i < chain.steps.length; i++) {
    if (!chain.steps[i].assistantId.trim()) {
      return `단계 ${i + 1}에 비서 ID가 필요합니다`
    }
    if (!chain.steps[i].promptTemplate.trim()) {
      return `단계 ${i + 1}에 프롬프트 템플릿이 필요합니다`
    }
  }

  return null
}

// 출력 후처리 변환
export function applyTransform(output: string, transform: ChainStep['transformOutput']): string {
  if (!transform || transform === 'none') {
    return output
  }

  if (transform === 'trim') {
    return output.trim()
  }

  // extractFirst: 첫 번째 문단 추출 (빈 줄 기준)
  if (transform === 'extractFirst') {
    const paragraphs = output.split(/\n\n+/)
    return (paragraphs[0] ?? '').trim()
  }

  return output
}

function generateId(): string {
  return `chain-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

async function getChains(): Promise<AssistantChain[]> {
  return (await Storage.get<AssistantChain[]>(STORAGE_KEY)) ?? []
}

async function saveChains(chains: AssistantChain[]): Promise<void> {
  await Storage.set(STORAGE_KEY, chains)
}

export const AssistantChainStore = {
  async list(): Promise<AssistantChain[]> {
    const chains = await getChains()
    return chains.sort((a, b) => b.updatedAt - a.updatedAt)
  },

  async get(id: string): Promise<AssistantChain | null> {
    const chains = await getChains()
    return chains.find((c) => c.id === id) ?? null
  },

  async save(
    chain: Omit<AssistantChain, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>,
  ): Promise<AssistantChain> {
    const chains = await getChains()

    if (chains.length >= MAX_CHAINS) {
      chains.shift()
    }

    const now = Date.now()
    const newChain: AssistantChain = {
      ...chain,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
    }

    await saveChains([...chains, newChain])
    return newChain
  },

  async update(
    id: string,
    updates: Partial<Pick<AssistantChain, 'name' | 'description' | 'steps'>>,
  ): Promise<AssistantChain | null> {
    const chains = await getChains()
    const index = chains.findIndex((c) => c.id === id)
    if (index === -1) return null

    const updated: AssistantChain = {
      ...chains[index],
      ...updates,
      updatedAt: Date.now(),
    }

    const newChains = chains.map((c) => (c.id === id ? updated : c))
    await saveChains(newChains)
    return updated
  },

  async remove(id: string): Promise<boolean> {
    const chains = await getChains()
    const filtered = chains.filter((c) => c.id !== id)
    if (filtered.length === chains.length) return false
    await saveChains(filtered)
    return true
  },

  async incrementUsage(id: string): Promise<void> {
    const chains = await getChains()
    const updated = chains.map((c) =>
      c.id === id ? { ...c, usageCount: c.usageCount + 1 } : c,
    )
    await saveChains(updated)
  },

  // 체인 실행: 각 단계를 순차적으로 처리
  async execute(
    chainId: string,
    input: string,
    sendMessage: (prompt: string, assistantId: string) => Promise<string>,
    onStep?: (result: ChainStepResult) => void,
    signal?: AbortSignal,
  ): Promise<ChainExecutionResult> {
    const chain = await AssistantChainStore.get(chainId)
    if (!chain) {
      throw new Error(`체인을 찾을 수 없습니다: ${chainId}`)
    }

    const stepResults: ChainStepResult[] = []
    let currentInput = input
    const startMs = Date.now()

    for (let i = 0; i < chain.steps.length; i++) {
      if (signal?.aborted) {
        throw new Error('체인 실행이 중단되었습니다')
      }

      const step = chain.steps[i]
      const resolvedPrompt = resolveTemplate(step.promptTemplate, currentInput, input)
      const stepStart = Date.now()

      const rawOutput = await sendMessage(resolvedPrompt, step.assistantId)
      const output = applyTransform(rawOutput, step.transformOutput)

      const result: ChainStepResult = {
        stepIndex: i,
        assistantId: step.assistantId,
        input: resolvedPrompt,
        output,
        ms: Date.now() - stepStart,
      }

      stepResults.push(result)
      onStep?.(result)
      currentInput = output
    }

    await AssistantChainStore.incrementUsage(chainId)

    return {
      stepResults,
      finalOutput: currentInput,
      totalMs: Date.now() - startMs,
    }
  },

  async exportChains(ids?: string[]): Promise<string> {
    const chains = await getChains()
    const toExport = ids ? chains.filter((c) => ids.includes(c.id)) : chains

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      chains: toExport,
    }

    return JSON.stringify(exportData, null, 2)
  },

  async importChains(json: string): Promise<{ imported: number; skipped: number }> {
    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch {
      throw new Error('Invalid JSON format')
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('version' in parsed) ||
      !('chains' in parsed) ||
      !Array.isArray((parsed as { chains: unknown }).chains)
    ) {
      throw new Error('Invalid chain export format')
    }

    const data = parsed as { version: number; chains: AssistantChain[] }
    const existingChains = await getChains()
    const existingNames = new Set(existingChains.map((c) => c.name))

    let imported = 0
    let skipped = 0

    for (const chain of data.chains) {
      if (existingNames.has(chain.name)) {
        skipped++
        continue
      }

      if (existingChains.length + imported >= MAX_CHAINS) {
        skipped += data.chains.length - imported - skipped
        break
      }

      const newChain: AssistantChain = {
        ...chain,
        id: generateId(),
        usageCount: 0,
      }

      existingChains.push(newChain)
      imported++
    }

    await saveChains(existingChains)
    return { imported, skipped }
  },
}
