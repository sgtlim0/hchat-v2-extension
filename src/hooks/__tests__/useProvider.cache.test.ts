import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const mockCreateAllProviders = vi.fn(() => [
  { isConfigured: () => true, name: 'bedrock' },
])

vi.mock('../../lib/providers/provider-factory', () => ({
  createAllProviders: (...args: unknown[]) => mockCreateAllProviders(...args),
  getAllModels: () => [{ id: 'test-model', name: 'Test', provider: 'bedrock' }],
  getProviderForModel: () => ({ isConfigured: () => true }),
  getModelDef: () => ({ id: 'test-model', provider: 'bedrock' }),
}))

vi.mock('../../lib/providers/model-router', () => ({
  routeModel: () => null,
}))

import { useProvider } from '../useProvider'
import type { Config } from '../useConfig'

const baseConfig: Config = {
  defaultModel: 'test-model',
  aws: { accessKeyId: 'key', secretAccessKey: 'secret', region: 'us-east-1' },
  openai: { apiKey: '' },
  gemini: { apiKey: '' },
  ollama: { baseUrl: '', modelFilter: [] },
  openrouter: { apiKey: '', siteUrl: '', siteName: '' },
  autoRouting: false,
  enableWebSearch: false,
  enableContentScript: true,
  enableSearchEnhance: true,
  language: 'ko',
  theme: 'dark',
  googleSearchApiKey: '',
  googleSearchEngineId: '',
  budget: { monthly: 0, warnThreshold: 70, critThreshold: 90, webhookUrl: '', webhookEnabled: false },
}

describe('useProvider caching', () => {
  it('returns memoized providers on re-render with same config', () => {
    mockCreateAllProviders.mockClear()

    const { result, rerender } = renderHook(() => useProvider(baseConfig))
    const firstProviders = result.current.providers

    expect(mockCreateAllProviders).toHaveBeenCalledTimes(1)

    // Re-render with the exact same config object
    rerender()

    expect(result.current.providers).toBe(firstProviders)
    // createAllProviders should NOT be called again
    expect(mockCreateAllProviders).toHaveBeenCalledTimes(1)
  })

  it('recreates providers when config changes', () => {
    mockCreateAllProviders.mockClear()

    const { result, rerender } = renderHook(
      (props: { config: Config }) => useProvider(props.config),
      { initialProps: { config: baseConfig } },
    )
    const firstProviders = result.current.providers

    expect(mockCreateAllProviders).toHaveBeenCalledTimes(1)

    // Change config (different AWS key)
    const newConfig: Config = {
      ...baseConfig,
      aws: { accessKeyId: 'new-key', secretAccessKey: 'new-secret', region: 'us-west-2' },
    }
    rerender({ config: newConfig })

    // Should create new providers
    expect(mockCreateAllProviders).toHaveBeenCalledTimes(2)
    expect(result.current.providers).not.toBe(firstProviders)
  })

  it('does not recreate providers when unrelated config fields change', () => {
    mockCreateAllProviders.mockClear()

    const { result, rerender } = renderHook(
      (props: { config: Config }) => useProvider(props.config),
      { initialProps: { config: baseConfig } },
    )
    const firstProviders = result.current.providers

    expect(mockCreateAllProviders).toHaveBeenCalledTimes(1)

    // Change a non-provider config field (language)
    const newConfig: Config = { ...baseConfig, language: 'en' }
    rerender({ config: newConfig })

    // Providers should be reused (useMemo deps are provider configs only)
    expect(result.current.providers).toBe(firstProviders)
    expect(mockCreateAllProviders).toHaveBeenCalledTimes(1)
  })
})
