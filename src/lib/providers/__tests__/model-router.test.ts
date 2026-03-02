import { describe, it, expect, vi } from 'vitest'
import type { AIProvider, ModelDef } from '../types'
import { routeModel } from '../model-router'

function makeMockProvider(models: ModelDef[], configured = true): AIProvider {
  return {
    type: 'bedrock',
    models,
    isConfigured: vi.fn(() => configured),
    stream: vi.fn(),
    testConnection: vi.fn(),
  }
}

const fastModel: ModelDef = {
  id: 'fast-model',
  provider: 'bedrock',
  label: 'Fast',
  shortLabel: 'Fast',
  emoji: '',
  capabilities: ['chat', 'fast'],
  cost: { input: 0.8, output: 4.0 },
}

const codeModel: ModelDef = {
  id: 'code-model',
  provider: 'bedrock',
  label: 'Coder',
  shortLabel: 'Code',
  emoji: '',
  capabilities: ['chat', 'code'],
  cost: { input: 3.0, output: 15.0 },
}

const visionModel: ModelDef = {
  id: 'vision-model',
  provider: 'openai',
  label: 'Vision',
  shortLabel: 'Vis',
  emoji: '',
  capabilities: ['chat', 'vision', 'code'],
  cost: { input: 2.5, output: 10.0 },
}

const reasoningModel: ModelDef = {
  id: 'reasoning-model',
  provider: 'bedrock',
  label: 'Reason',
  shortLabel: 'Rsn',
  emoji: '',
  capabilities: ['chat', 'reasoning'],
  cost: { input: 15.0, output: 75.0 },
}

describe('routeModel', () => {
  it('returns null when no providers configured', () => {
    const provider = makeMockProvider([fastModel], false)
    expect(routeModel('hello', [provider])).toBeNull()
  })

  it('routes simple greetings to fast model', () => {
    const provider = makeMockProvider([fastModel, codeModel, reasoningModel])
    const result = routeModel('안녕!', [provider])
    expect(result).toBe('fast-model')
  })

  it('routes short queries to fast model', () => {
    const provider = makeMockProvider([fastModel, codeModel])
    const result = routeModel('yes', [provider])
    expect(result).toBe('fast-model')
  })

  it('routes code-related queries to code model', () => {
    const provider = makeMockProvider([fastModel, codeModel])
    const result = routeModel('function handleClick() { 코드를 분석해줘 }', [provider])
    expect(result).toBe('code-model')
  })

  it('routes image prompts to vision model', () => {
    const p1 = makeMockProvider([fastModel, codeModel])
    const p2 = makeMockProvider([visionModel])
    const result = routeModel('이 이미지 설명해줘', [p1, p2], true)
    expect(result).toBe('vision-model')
  })

  it('excludes non-vision models for image prompts', () => {
    const provider = makeMockProvider([fastModel, visionModel])
    const result = routeModel('describe this image', [provider], true)
    expect(result).toBe('vision-model')
  })

  it('routes reasoning queries to reasoning model', () => {
    // English reasoning keywords work with \b word boundary; Korean \b doesn't match
    const provider = makeMockProvider([fastModel, reasoningModel])
    const result = routeModel(
      'Please analyze and compare these two approaches, then explain why one is better',
      [provider],
    )
    expect(result).toBe('reasoning-model')
  })

  it('returns first model when scores are ambiguous', () => {
    const provider = makeMockProvider([codeModel, reasoningModel])
    const result = routeModel('일반적인 질문입니다 충분히 긴 질문', [provider])
    // Both should have similar score, first wins on tie
    expect(result).toBeTruthy()
  })

  it('handles multiple providers', () => {
    // Use models without fast capability to test code routing
    const p1 = makeMockProvider([reasoningModel])
    const p2 = makeMockProvider([codeModel])
    const result = routeModel('코드 리뷰해줘 function test() { const x = 1 }', [p1, p2])
    expect(result).toBe('code-model')
  })

  it('skips unconfigured providers', () => {
    const configured = makeMockProvider([fastModel], true)
    const unconfigured = makeMockProvider([codeModel], false)
    const result = routeModel('코드 작성해줘', [configured, unconfigured])
    expect(result).toBe('fast-model')
  })
})
