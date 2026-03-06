// provider-factory.branches.test.ts — Branch coverage for provider-factory.ts
// Tests edge cases, partial configs, and boundary conditions using mocked providers

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AIProvider, ModelDef } from '../types'

// --- Mock providers ---

function makeMockProvider(
  type: 'bedrock' | 'openai' | 'gemini' | 'ollama' | 'openrouter',
  models: ModelDef[],
  configured = true
): AIProvider {
  return {
    type,
    models,
    isConfigured: vi.fn().mockReturnValue(configured),
    stream: vi.fn(),
    testConnection: vi.fn().mockResolvedValue(configured),
  }
}

const bedrockModel: ModelDef = {
  id: 'us.anthropic.claude-sonnet-4-6',
  provider: 'bedrock',
  label: 'Claude Sonnet 4.6',
  shortLabel: 'Sonnet 4.6',
  emoji: '🟣',
  capabilities: ['chat', 'code', 'vision', 'reasoning'],
  cost: { input: 3.0, output: 15.0 },
}

const openaiModel: ModelDef = {
  id: 'gpt-4o',
  provider: 'openai',
  label: 'GPT-4o',
  shortLabel: 'GPT-4o',
  emoji: '🟢',
  capabilities: ['chat', 'code', 'vision', 'reasoning'],
  cost: { input: 2.5, output: 10.0 },
}

const geminiModel: ModelDef = {
  id: 'gemini-2.0-flash',
  provider: 'gemini',
  label: 'Gemini Flash 2.0',
  shortLabel: 'Flash 2.0',
  emoji: '🔵',
  capabilities: ['chat', 'code', 'vision', 'fast'],
  cost: { input: 0.1, output: 0.4 },
}

// --- Import real factory functions (they work on AIProvider[], no mocking needed) ---

import {
  createProvider,
  createAllProviders,
  getAllModels,
  getProviderForModel,
  getModelDef,
  getModelEmoji,
  getStaticModelDef,
  type ProviderConfigs,
} from '../provider-factory'

const defaultConfigs: ProviderConfigs = {
  bedrock: { accessKeyId: 'key', secretAccessKey: 'secret', region: 'us-east-1' },
  openai: { apiKey: 'sk-test' },
  gemini: { apiKey: 'gem-test' },
}

describe('provider-factory branches', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // ── createAllProviders ──────────────────────────────────────────────

  describe('createAllProviders', () => {
    it('creates all three providers with valid configs', () => {
      const providers = createAllProviders(defaultConfigs)
      expect(providers).toHaveLength(3)
      expect(providers[0].type).toBe('bedrock')
      expect(providers[1].type).toBe('openai')
      expect(providers[2].type).toBe('gemini')
    })

    it('creates providers even with empty string credentials', () => {
      const configs: ProviderConfigs = {
        bedrock: { accessKeyId: '', secretAccessKey: '', region: '' },
        openai: { apiKey: '' },
        gemini: { apiKey: '' },
      }
      const providers = createAllProviders(configs)
      expect(providers).toHaveLength(3)
      // providers exist but are not configured
      providers.forEach((p) => {
        expect(p.isConfigured()).toBe(false)
      })
    })

    it('each provider exposes correct type', () => {
      const providers = createAllProviders(defaultConfigs)
      const types = providers.map((p) => p.type)
      expect(types).toEqual(['bedrock', 'openai', 'gemini'])
    })

    it('includes ollama provider when ollama config is present', () => {
      const configs = { ...defaultConfigs, ollama: { baseUrl: 'http://localhost:11434' } }
      const providers = createAllProviders(configs)
      expect(providers).toHaveLength(4)
      expect(providers[3].type).toBe('ollama')
    })

    it('includes openrouter provider when openrouter config is present', () => {
      const configs = { ...defaultConfigs, openrouter: { apiKey: 'or-test' } }
      const providers = createAllProviders(configs)
      expect(providers).toHaveLength(4)
      expect(providers[3].type).toBe('openrouter')
    })

    it('includes both ollama and openrouter when both configs are present', () => {
      const configs = {
        ...defaultConfigs,
        ollama: { baseUrl: 'http://localhost:11434' },
        openrouter: { apiKey: 'or-test' },
      }
      const providers = createAllProviders(configs)
      expect(providers).toHaveLength(5)
      expect(providers.map((p) => p.type)).toEqual([
        'bedrock', 'openai', 'gemini', 'ollama', 'openrouter',
      ])
    })

    it('does not include ollama/openrouter when configs are absent', () => {
      const providers = createAllProviders(defaultConfigs)
      expect(providers).toHaveLength(3)
      expect(providers.map((p) => p.type)).toEqual(['bedrock', 'openai', 'gemini'])
    })
  })

  // ── createProvider ──────────────────────────────────────────────────

  describe('createProvider', () => {
    it('creates bedrock provider via switch', () => {
      const p = createProvider('bedrock', defaultConfigs)
      expect(p.type).toBe('bedrock')
    })

    it('creates openai provider via switch', () => {
      const p = createProvider('openai', defaultConfigs)
      expect(p.type).toBe('openai')
    })

    it('creates gemini provider via switch', () => {
      const p = createProvider('gemini', defaultConfigs)
      expect(p.type).toBe('gemini')
    })

    it('creates ollama provider via switch', () => {
      const configs = { ...defaultConfigs, ollama: { baseUrl: 'http://localhost:11434' } }
      const p = createProvider('ollama', configs)
      expect(p.type).toBe('ollama')
    })

    it('creates openrouter provider via switch', () => {
      const configs = { ...defaultConfigs, openrouter: { apiKey: 'or-test' } }
      const p = createProvider('openrouter', configs)
      expect(p.type).toBe('openrouter')
    })

    it('creates ollama provider with default config when not provided', () => {
      const p = createProvider('ollama', defaultConfigs)
      expect(p.type).toBe('ollama')
    })

    it('creates openrouter provider with default config when not provided', () => {
      const p = createProvider('openrouter', defaultConfigs)
      expect(p.type).toBe('openrouter')
      expect(p.isConfigured()).toBe(false)
    })
  })

  // ── getProviderForModel ─────────────────────────────────────────────

  describe('getProviderForModel', () => {
    it('returns correct provider when model exists in first provider', () => {
      const providers = [
        makeMockProvider('bedrock', [bedrockModel]),
        makeMockProvider('openai', [openaiModel]),
      ]
      const result = getProviderForModel('us.anthropic.claude-sonnet-4-6', providers)
      expect(result?.type).toBe('bedrock')
    })

    it('returns correct provider when model exists in last provider', () => {
      const providers = [
        makeMockProvider('bedrock', [bedrockModel]),
        makeMockProvider('openai', [openaiModel]),
        makeMockProvider('gemini', [geminiModel]),
      ]
      const result = getProviderForModel('gemini-2.0-flash', providers)
      expect(result?.type).toBe('gemini')
    })

    it('returns undefined for unknown model ID', () => {
      const providers = [
        makeMockProvider('bedrock', [bedrockModel]),
        makeMockProvider('openai', [openaiModel]),
      ]
      expect(getProviderForModel('nonexistent-model', providers)).toBeUndefined()
    })

    it('returns undefined for empty providers array', () => {
      expect(getProviderForModel('gpt-4o', [])).toBeUndefined()
    })

    it('returns undefined when providers have no models', () => {
      const providers = [
        makeMockProvider('bedrock', []),
        makeMockProvider('openai', []),
      ]
      expect(getProviderForModel('gpt-4o', providers)).toBeUndefined()
    })

    it('returns first matching provider when duplicate model IDs exist', () => {
      const duplicateModel: ModelDef = { ...openaiModel, provider: 'bedrock' }
      const providers = [
        makeMockProvider('bedrock', [duplicateModel]),
        makeMockProvider('openai', [openaiModel]),
      ]
      const result = getProviderForModel('gpt-4o', providers)
      expect(result?.type).toBe('bedrock')
    })
  })

  // ── getAllModels ─────────────────────────────────────────────────────

  describe('getAllModels', () => {
    it('returns all models from all providers', () => {
      const providers = [
        makeMockProvider('bedrock', [bedrockModel]),
        makeMockProvider('openai', [openaiModel]),
        makeMockProvider('gemini', [geminiModel]),
      ]
      const models = getAllModels(providers)
      expect(models).toHaveLength(3)
      expect(models.map((m) => m.id)).toEqual([
        'us.anthropic.claude-sonnet-4-6',
        'gpt-4o',
        'gemini-2.0-flash',
      ])
    })

    it('returns models from single provider', () => {
      const providers = [makeMockProvider('openai', [openaiModel])]
      const models = getAllModels(providers)
      expect(models).toHaveLength(1)
      expect(models[0].id).toBe('gpt-4o')
    })

    it('returns empty array for empty providers', () => {
      expect(getAllModels([])).toEqual([])
    })

    it('returns empty array when all providers have no models', () => {
      const providers = [
        makeMockProvider('bedrock', []),
        makeMockProvider('openai', []),
      ]
      expect(getAllModels(providers)).toEqual([])
    })

    it('handles mixed: some providers with models, some without', () => {
      const providers = [
        makeMockProvider('bedrock', []),
        makeMockProvider('openai', [openaiModel]),
        makeMockProvider('gemini', []),
      ]
      const models = getAllModels(providers)
      expect(models).toHaveLength(1)
      expect(models[0].provider).toBe('openai')
    })
  })

  // ── getModelDef ─────────────────────────────────────────────────────

  describe('getModelDef', () => {
    it('returns model definition from first provider', () => {
      const providers = [
        makeMockProvider('bedrock', [bedrockModel]),
        makeMockProvider('openai', [openaiModel]),
      ]
      const model = getModelDef('us.anthropic.claude-sonnet-4-6', providers)
      expect(model?.id).toBe('us.anthropic.claude-sonnet-4-6')
      expect(model?.provider).toBe('bedrock')
    })

    it('returns model definition from later provider', () => {
      const providers = [
        makeMockProvider('bedrock', [bedrockModel]),
        makeMockProvider('gemini', [geminiModel]),
      ]
      const model = getModelDef('gemini-2.0-flash', providers)
      expect(model?.id).toBe('gemini-2.0-flash')
    })

    it('returns undefined for nonexistent model', () => {
      const providers = [makeMockProvider('bedrock', [bedrockModel])]
      expect(getModelDef('no-such-model', providers)).toBeUndefined()
    })

    it('returns undefined for empty providers', () => {
      expect(getModelDef('gpt-4o', [])).toBeUndefined()
    })
  })

  // ── getModelEmoji ───────────────────────────────────────────────────

  describe('getModelEmoji', () => {
    it('returns emoji for known Bedrock model', () => {
      expect(getModelEmoji('us.anthropic.claude-sonnet-4-6')).toBe('🟣')
    })

    it('returns emoji for known OpenAI model', () => {
      expect(getModelEmoji('gpt-4o')).toBe('🟢')
    })

    it('returns emoji for known Gemini model', () => {
      expect(getModelEmoji('gemini-2.0-flash')).toBe('🔵')
    })

    it('returns default robot emoji for unknown model', () => {
      expect(getModelEmoji('completely-unknown')).toBe('🤖')
    })

    it('returns default robot emoji for empty string', () => {
      expect(getModelEmoji('')).toBe('🤖')
    })
  })

  // ── getStaticModelDef ───────────────────────────────────────────────

  describe('getStaticModelDef', () => {
    it('returns static model def for Bedrock model', () => {
      const model = getStaticModelDef('us.anthropic.claude-sonnet-4-6')
      expect(model).toBeDefined()
      expect(model?.provider).toBe('bedrock')
    })

    it('returns static model def for OpenAI model', () => {
      const model = getStaticModelDef('gpt-4o')
      expect(model).toBeDefined()
      expect(model?.provider).toBe('openai')
    })

    it('returns static model def for Gemini model', () => {
      const model = getStaticModelDef('gemini-2.0-flash')
      expect(model).toBeDefined()
      expect(model?.provider).toBe('gemini')
    })

    it('returns undefined for unknown model', () => {
      expect(getStaticModelDef('nonexistent')).toBeUndefined()
    })

    it('returns undefined for empty string', () => {
      expect(getStaticModelDef('')).toBeUndefined()
    })

    it('model def includes all required fields', () => {
      const model = getStaticModelDef('gpt-4o')
      expect(model).toHaveProperty('id')
      expect(model).toHaveProperty('provider')
      expect(model).toHaveProperty('label')
      expect(model).toHaveProperty('shortLabel')
      expect(model).toHaveProperty('emoji')
      expect(model).toHaveProperty('capabilities')
      expect(model).toHaveProperty('cost')
    })
  })
})
