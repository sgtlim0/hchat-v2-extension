import { describe, it, expect, beforeEach } from 'vitest'
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
import { BEDROCK_MODELS } from '../bedrock-provider'
import { OPENAI_MODELS } from '../openai-provider'
import { GEMINI_MODELS } from '../gemini-provider'

describe('provider-factory', () => {
  const mockConfigs: ProviderConfigs = {
    bedrock: {
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    },
    openai: {
      apiKey: 'sk-test-key',
    },
    gemini: {
      apiKey: 'gemini-test-key',
    },
  }

  beforeEach(() => {
    chrome.storage.local.clear()
  })

  describe('createProvider', () => {
    it('creates Bedrock provider', () => {
      const provider = createProvider('bedrock', mockConfigs)
      expect(provider.type).toBe('bedrock')
      expect(provider.models.length).toBeGreaterThan(0)
    })

    it('creates OpenAI provider', () => {
      const provider = createProvider('openai', mockConfigs)
      expect(provider.type).toBe('openai')
      expect(provider.models.length).toBeGreaterThan(0)
    })

    it('creates Gemini provider', () => {
      const provider = createProvider('gemini', mockConfigs)
      expect(provider.type).toBe('gemini')
      expect(provider.models.length).toBeGreaterThan(0)
    })
  })

  describe('createAllProviders', () => {
    it('returns providers for all three types', () => {
      const providers = createAllProviders(mockConfigs)
      expect(providers).toHaveLength(3)
      expect(providers.map((p) => p.type)).toEqual(['bedrock', 'openai', 'gemini'])
    })

    it('each provider has models', () => {
      const providers = createAllProviders(mockConfigs)
      providers.forEach((p) => {
        expect(p.models.length).toBeGreaterThan(0)
      })
    })

    it('uses provided credentials', () => {
      const providers = createAllProviders(mockConfigs)
      expect(providers[0].type).toBe('bedrock')
      expect(providers[1].type).toBe('openai')
      expect(providers[2].type).toBe('gemini')
    })
  })

  describe('getAllModels', () => {
    it('returns flat list of all models from all providers', () => {
      const providers = createAllProviders(mockConfigs)
      const models = getAllModels(providers)
      expect(models.length).toBe(BEDROCK_MODELS.length + OPENAI_MODELS.length + GEMINI_MODELS.length)
    })

    it('each model has required properties', () => {
      const providers = createAllProviders(mockConfigs)
      const models = getAllModels(providers)
      models.forEach((m) => {
        expect(m).toHaveProperty('id')
        expect(m).toHaveProperty('label')
        expect(m).toHaveProperty('provider')
        expect(m).toHaveProperty('emoji')
      })
    })

    it('returns empty array for empty provider list', () => {
      expect(getAllModels([])).toEqual([])
    })
  })

  describe('getProviderForModel', () => {
    it('returns correct provider for Bedrock model', () => {
      const providers = createAllProviders(mockConfigs)
      const provider = getProviderForModel('us.anthropic.claude-sonnet-4-6', providers)
      expect(provider?.type).toBe('bedrock')
    })

    it('returns correct provider for OpenAI model', () => {
      const providers = createAllProviders(mockConfigs)
      const provider = getProviderForModel('gpt-4o', providers)
      expect(provider?.type).toBe('openai')
    })

    it('returns correct provider for Gemini model', () => {
      const providers = createAllProviders(mockConfigs)
      const provider = getProviderForModel('gemini-2.0-flash', providers)
      expect(provider?.type).toBe('gemini')
    })

    it('returns undefined for unknown model', () => {
      const providers = createAllProviders(mockConfigs)
      expect(getProviderForModel('nonexistent-model', providers)).toBeUndefined()
    })

    it('returns undefined for empty provider list', () => {
      expect(getProviderForModel('gpt-4o', [])).toBeUndefined()
    })
  })

  describe('getModelDef', () => {
    it('returns model definition for existing model', () => {
      const providers = createAllProviders(mockConfigs)
      const model = getModelDef('gpt-4o', providers)
      expect(model).toBeDefined()
      expect(model?.id).toBe('gpt-4o')
      expect(model?.label).toContain('GPT-4o')
    })

    it('returns undefined for nonexistent model', () => {
      const providers = createAllProviders(mockConfigs)
      expect(getModelDef('fake-model-id', providers)).toBeUndefined()
    })

    it('returns undefined for empty provider list', () => {
      expect(getModelDef('gpt-4o', [])).toBeUndefined()
    })

    it('finds models across different providers', () => {
      const providers = createAllProviders(mockConfigs)
      const sonnet = getModelDef('us.anthropic.claude-sonnet-4-6', providers)
      const gpt = getModelDef('gpt-4o', providers)
      const gemini = getModelDef('gemini-2.0-flash', providers)

      expect(sonnet?.provider).toBe('bedrock')
      expect(gpt?.provider).toBe('openai')
      expect(gemini?.provider).toBe('gemini')
    })
  })

  describe('getModelEmoji', () => {
    it('returns correct emoji for Bedrock model', () => {
      const emoji = getModelEmoji('us.anthropic.claude-sonnet-4-6')
      expect(emoji).toBe('🟣')
    })

    it('returns correct emoji for OpenAI model', () => {
      const emoji = getModelEmoji('gpt-4o')
      expect(emoji).toBe('🟢')
    })

    it('returns correct emoji for Gemini model', () => {
      const emoji = getModelEmoji('gemini-2.0-flash')
      expect(emoji).toBe('🔵')
    })

    it('returns default emoji for unknown model', () => {
      expect(getModelEmoji('unknown-model')).toBe('🤖')
    })

    it('works without provider instances', () => {
      // Should use static model list
      const emoji = getModelEmoji('gpt-4o')
      expect(typeof emoji).toBe('string')
      expect(emoji.length).toBeGreaterThan(0)
    })
  })

  describe('getStaticModelDef', () => {
    it('returns model definition without provider instances', () => {
      const model = getStaticModelDef('gpt-4o')
      expect(model).toBeDefined()
      expect(model?.id).toBe('gpt-4o')
      expect(model?.provider).toBe('openai')
    })

    it('returns undefined for nonexistent model', () => {
      expect(getStaticModelDef('fake-model')).toBeUndefined()
    })

    it('finds models from all provider types', () => {
      const bedrock = getStaticModelDef('us.anthropic.claude-sonnet-4-6')
      const openai = getStaticModelDef('gpt-4o')
      const gemini = getStaticModelDef('gemini-2.0-flash')

      expect(bedrock?.provider).toBe('bedrock')
      expect(openai?.provider).toBe('openai')
      expect(gemini?.provider).toBe('gemini')
    })
  })
})
