import { describe, it, expect } from 'vitest'
import { validateConfig, type Config } from '../useConfig'

describe('validateConfig', () => {
  describe('valid configs', () => {
    it('accepts a complete valid config', () => {
      const input: Config = {
        aws: { accessKeyId: 'key', secretAccessKey: 'secret', region: 'us-east-1' },
        openai: { apiKey: 'oai-key' },
        gemini: { apiKey: 'gem-key' },
        ollama: { baseUrl: 'http://localhost:11434', modelFilter: ['llama3'] },
        openrouter: { apiKey: 'or-key', siteUrl: 'https://example.com', siteName: 'MySite' },
        defaultModel: 'us.anthropic.claude-sonnet-4-6',
        autoRouting: false,
        theme: 'dark',
        language: 'en',
        enableContentScript: true,
        enableSearchEnhance: true,
        enableWebSearch: false,
        googleSearchApiKey: 'gkey',
        googleSearchEngineId: 'gid',
        budget: { monthly: 100, warnThreshold: 70, critThreshold: 90, webhookUrl: '', webhookEnabled: false },
      }
      const result = validateConfig(input)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
      expect(result.data).toEqual(input)
    })

    it('accepts an empty object and fills all defaults', () => {
      const result = validateConfig({})
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
      expect(result.data.defaultModel).toBe('us.anthropic.claude-sonnet-4-6')
      expect(result.data.theme).toBe('system')
      expect(result.data.language).toBe('ko')
      expect(result.data.aws.region).toBe('us-east-1')
      expect(result.data.budget.warnThreshold).toBe(70)
    })

    it('accepts partial config with only some fields', () => {
      const result = validateConfig({ defaultModel: 'custom-model', theme: 'light' })
      expect(result.valid).toBe(true)
      expect(result.data.defaultModel).toBe('custom-model')
      expect(result.data.theme).toBe('light')
      expect(result.data.language).toBe('ko')
    })
  })

  describe('null/undefined/non-object input', () => {
    it('returns defaults for null', () => {
      const result = validateConfig(null)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Config must be a non-null object')
      expect(result.data.defaultModel).toBe('us.anthropic.claude-sonnet-4-6')
    })

    it('returns defaults for undefined', () => {
      const result = validateConfig(undefined)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Config must be a non-null object')
    })

    it('returns defaults for a string', () => {
      const result = validateConfig('not-an-object')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Config must be a non-null object')
    })

    it('returns defaults for a number', () => {
      const result = validateConfig(42)
      expect(result.valid).toBe(false)
    })

    it('returns defaults for an array', () => {
      const result = validateConfig([1, 2, 3])
      expect(result.valid).toBe(false)
    })
  })

  describe('wrong types', () => {
    it('detects number where string expected', () => {
      const result = validateConfig({ defaultModel: 123 })
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('Expected string'))).toBe(true)
      expect(result.data.defaultModel).toBe('us.anthropic.claude-sonnet-4-6')
    })

    it('detects string where boolean expected', () => {
      const result = validateConfig({ autoRouting: 'yes' })
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('Expected boolean'))).toBe(true)
      expect(result.data.autoRouting).toBe(false)
    })

    it('detects string where number expected in budget', () => {
      const result = validateConfig({ budget: { monthly: 'fifty' } })
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('Expected number'))).toBe(true)
      expect(result.data.budget.monthly).toBe(0)
    })

    it('detects NaN as invalid number', () => {
      const result = validateConfig({ budget: { monthly: NaN } })
      expect(result.valid).toBe(false)
      expect(result.data.budget.monthly).toBe(0)
    })

    it('detects invalid theme value', () => {
      const result = validateConfig({ theme: 'midnight' })
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('Invalid theme'))).toBe(true)
      expect(result.data.theme).toBe('system')
    })
  })

  describe('nested object handling', () => {
    it('handles aws as a non-object (string)', () => {
      const result = validateConfig({ aws: 'bad' })
      expect(result.data.aws.accessKeyId).toBe('')
      expect(result.data.aws.region).toBe('us-east-1')
    })

    it('handles aws as an array', () => {
      const result = validateConfig({ aws: [1, 2] })
      expect(result.data.aws.accessKeyId).toBe('')
    })

    it('handles partial aws object', () => {
      const result = validateConfig({ aws: { accessKeyId: 'my-key' } })
      expect(result.valid).toBe(true)
      expect(result.data.aws.accessKeyId).toBe('my-key')
      expect(result.data.aws.secretAccessKey).toBe('')
      expect(result.data.aws.region).toBe('us-east-1')
    })

    it('handles partial budget object', () => {
      const result = validateConfig({ budget: { monthly: 200 } })
      expect(result.valid).toBe(true)
      expect(result.data.budget.monthly).toBe(200)
      expect(result.data.budget.warnThreshold).toBe(70)
      expect(result.data.budget.critThreshold).toBe(90)
    })

    it('handles partial ollama with modelFilter', () => {
      const result = validateConfig({ ollama: { modelFilter: ['llama3', 'codellama'] } })
      expect(result.valid).toBe(true)
      expect(result.data.ollama.modelFilter).toEqual(['llama3', 'codellama'])
      expect(result.data.ollama.baseUrl).toBe('')
    })

    it('filters non-string items from modelFilter', () => {
      const result = validateConfig({ ollama: { modelFilter: ['valid', 123, null, 'also-valid'] } })
      expect(result.data.ollama.modelFilter).toEqual(['valid', 'also-valid'])
    })

    it('handles modelFilter as non-array', () => {
      const result = validateConfig({ ollama: { modelFilter: 'not-array' } })
      expect(result.data.ollama.modelFilter).toEqual([])
    })
  })

  describe('theme validation', () => {
    it('accepts system theme', () => {
      const result = validateConfig({ theme: 'system' })
      expect(result.data.theme).toBe('system')
      expect(result.valid).toBe(true)
    })

    it('accepts dark theme', () => {
      const result = validateConfig({ theme: 'dark' })
      expect(result.data.theme).toBe('dark')
    })

    it('accepts light theme', () => {
      const result = validateConfig({ theme: 'light' })
      expect(result.data.theme).toBe('light')
    })

    it('rejects invalid theme and uses default', () => {
      const result = validateConfig({ theme: 'neon' })
      expect(result.data.theme).toBe('system')
      expect(result.valid).toBe(false)
    })

    it('does not error when theme is undefined (missing)', () => {
      const result = validateConfig({})
      expect(result.data.theme).toBe('system')
      expect(result.valid).toBe(true)
    })
  })

  describe('previous version config (migration)', () => {
    it('handles config with extra unknown fields gracefully', () => {
      const result = validateConfig({
        defaultModel: 'model',
        unknownField: 'should-be-ignored',
        anotherExtra: 42,
      })
      expect(result.valid).toBe(true)
      expect(result.data.defaultModel).toBe('model')
      expect((result.data as Record<string, unknown>).unknownField).toBeUndefined()
    })

    it('handles config with wrong nested types and preserves valid fields', () => {
      const result = validateConfig({
        aws: { accessKeyId: 'valid-key', secretAccessKey: 123 },
        defaultModel: 'my-model',
      })
      expect(result.valid).toBe(false)
      expect(result.data.aws.accessKeyId).toBe('valid-key')
      expect(result.data.aws.secretAccessKey).toBe('')
      expect(result.data.defaultModel).toBe('my-model')
    })
  })

  describe('multiple errors', () => {
    it('collects all errors from a badly typed config', () => {
      const result = validateConfig({
        defaultModel: 42,
        autoRouting: 'yes',
        theme: 'invalid',
        budget: { monthly: 'free' },
      })
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(4)
    })
  })
})
