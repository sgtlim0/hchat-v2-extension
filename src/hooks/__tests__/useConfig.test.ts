import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useConfig, type Config } from '../useConfig'
import { SK } from '../../lib/storageKeys'

describe('useConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('load config from storage', () => {
    it('loads saved config and deep-merges with defaults', async () => {
      const savedConfig: Partial<Config> = {
        defaultModel: 'custom-model',
        aws: { accessKeyId: 'saved-key', secretAccessKey: 'saved-secret', region: 'us-west-2' },
        openai: { apiKey: 'openai-key' },
        theme: 'dark',
      }

      await chrome.storage.local.set({ [SK.CONFIG]: savedConfig })

      const { result } = renderHook(() => useConfig())

      await waitFor(() => {
        expect(result.current.loaded).toBe(true)
      })

      expect(result.current.config.defaultModel).toBe('custom-model')
      expect(result.current.config.aws.accessKeyId).toBe('saved-key')
      expect(result.current.config.aws.region).toBe('us-west-2')
      expect(result.current.config.openai.apiKey).toBe('openai-key')
      expect(result.current.config.theme).toBe('dark')
      // Default values should still be present
      expect(result.current.config.language).toBe('ko')
      expect(result.current.config.autoRouting).toBe(false)
    })

    it('applies default values for missing keys', async () => {
      const { result } = renderHook(() => useConfig())

      await waitFor(() => {
        expect(result.current.loaded).toBe(true)
      })

      expect(result.current.config.defaultModel).toBe('us.anthropic.claude-sonnet-4-6')
      expect(result.current.config.theme).toBe('system')
      expect(result.current.config.language).toBe('ko')
      expect(result.current.config.autoRouting).toBe(false)
      expect(result.current.config.enableContentScript).toBe(true)
    })

    it('deep-merges nested aws object', async () => {
      // Only provide partial aws fields — omit region to test default preservation
      const partialConfig = {
        aws: { accessKeyId: 'new-key' },
      }

      await chrome.storage.local.set({ [SK.CONFIG]: partialConfig })

      const { result } = renderHook(() => useConfig())

      await waitFor(() => {
        expect(result.current.loaded).toBe(true)
      })

      expect(result.current.config.aws.accessKeyId).toBe('new-key')
      // Default region preserved when not provided in saved config
      expect(result.current.config.aws.region).toBe('us-east-1')
    })

    it('deep-merges nested openai object', async () => {
      const partialConfig: Partial<Config> = {
        openai: { apiKey: 'test-key' },
      }

      await chrome.storage.local.set({ [SK.CONFIG]: partialConfig })

      const { result } = renderHook(() => useConfig())

      await waitFor(() => {
        expect(result.current.loaded).toBe(true)
      })

      expect(result.current.config.openai.apiKey).toBe('test-key')
    })

    it('deep-merges nested gemini object', async () => {
      const partialConfig: Partial<Config> = {
        gemini: { apiKey: 'gemini-key' },
      }

      await chrome.storage.local.set({ [SK.CONFIG]: partialConfig })

      const { result } = renderHook(() => useConfig())

      await waitFor(() => {
        expect(result.current.loaded).toBe(true)
      })

      expect(result.current.config.gemini.apiKey).toBe('gemini-key')
    })

    it('deep-merges nested budget object', async () => {
      const partialConfig: Partial<Config> = {
        budget: { monthly: 50, warnThreshold: 80, critThreshold: 95, webhookUrl: '', webhookEnabled: false },
      }

      await chrome.storage.local.set({ [SK.CONFIG]: partialConfig })

      const { result } = renderHook(() => useConfig())

      await waitFor(() => {
        expect(result.current.loaded).toBe(true)
      })

      expect(result.current.config.budget.monthly).toBe(50)
      expect(result.current.config.budget.warnThreshold).toBe(80)
      expect(result.current.config.budget.critThreshold).toBe(95) // Spread overwrites with saved value
    })

    it('handles empty storage gracefully', async () => {
      const { result } = renderHook(() => useConfig())

      await waitFor(() => {
        expect(result.current.loaded).toBe(true)
      })

      expect(result.current.config).toBeDefined()
      expect(result.current.config.defaultModel).toBeTruthy()
    })

    it('handles null storage value', async () => {
      await chrome.storage.local.set({ [SK.CONFIG]: null })

      const { result } = renderHook(() => useConfig())

      await waitFor(() => {
        expect(result.current.loaded).toBe(true)
      })

      expect(result.current.config.defaultModel).toBe('us.anthropic.claude-sonnet-4-6')
    })
  })

  describe('update config', () => {
    it('updates config and saves to storage', async () => {
      const { result } = renderHook(() => useConfig())

      await waitFor(() => {
        expect(result.current.loaded).toBe(true)
      })

      await result.current.update({ defaultModel: 'new-model' })

      await waitFor(() => {
        expect(result.current.config.defaultModel).toBe('new-model')
      })

      const saved = await chrome.storage.local.get(SK.CONFIG)
      expect(saved[SK.CONFIG].defaultModel).toBe('new-model')
    })

    it('deep-merges nested objects on update', async () => {
      const { result } = renderHook(() => useConfig())

      await waitFor(() => {
        expect(result.current.loaded).toBe(true)
      })

      await result.current.update({
        aws: { accessKeyId: 'new-key', secretAccessKey: 'new-secret', region: 'ap-northeast-2' },
      })

      await waitFor(() => {
        expect(result.current.config.aws.accessKeyId).toBe('new-key')
      })

      // All aws fields should be updated via spread
      expect(result.current.config.aws.region).toBe('ap-northeast-2')
      expect(result.current.config.aws.secretAccessKey).toBe('new-secret')
    })

    it('preserves other config values on partial update', async () => {
      const initialConfig: Partial<Config> = {
        defaultModel: 'model-1',
        theme: 'dark',
        language: 'en',
      }

      await chrome.storage.local.set({ [SK.CONFIG]: initialConfig })

      const { result } = renderHook(() => useConfig())

      await waitFor(() => {
        expect(result.current.loaded).toBe(true)
      })

      await result.current.update({ defaultModel: 'model-2' })

      await waitFor(() => {
        expect(result.current.config.defaultModel).toBe('model-2')
      })

      expect(result.current.config.theme).toBe('dark')
      expect(result.current.config.language).toBe('en')
    })

    it('stores AWS credentials separately', async () => {
      const { result } = renderHook(() => useConfig())

      await waitFor(() => {
        expect(result.current.loaded).toBe(true)
      })

      await result.current.update({
        aws: { accessKeyId: 'key', secretAccessKey: 'secret', region: 'us-west-1' },
      })

      await waitFor(() => {
        expect(result.current.config.aws.accessKeyId).toBe('key')
      })

      const awsCreds = await chrome.storage.local.get(SK.CONFIG_AWS)
      expect(awsCreds[SK.CONFIG_AWS]).toEqual({
        accessKeyId: 'key',
        secretAccessKey: 'secret',
        region: 'us-west-1',
      })
    })

    it('sends CONFIG_UPDATED message on update', async () => {
      const { result } = renderHook(() => useConfig())

      await waitFor(() => {
        expect(result.current.loaded).toBe(true)
      })

      await result.current.update({ theme: 'light' })

      await waitFor(() => {
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'CONFIG_UPDATED',
            config: expect.objectContaining({ theme: 'light' }),
          })
        )
      })
    })

    it('handles sendMessage errors gracefully', async () => {
      const mockSendMessage = vi.mocked(chrome.runtime.sendMessage)
      mockSendMessage.mockRejectedValueOnce(new Error('Extension context invalidated'))

      const { result } = renderHook(() => useConfig())

      await waitFor(() => {
        expect(result.current.loaded).toBe(true)
      })

      // Should not throw
      await expect(result.current.update({ theme: 'light' })).resolves.not.toThrow()
    })

    it('updates multiple nested objects at once', async () => {
      const { result } = renderHook(() => useConfig())

      await waitFor(() => {
        expect(result.current.loaded).toBe(true)
      })

      await result.current.update({
        aws: { accessKeyId: 'aws-key', secretAccessKey: '', region: '' },
        openai: { apiKey: 'openai-key' },
        gemini: { apiKey: 'gemini-key' },
        budget: { monthly: 100, warnThreshold: 0, critThreshold: 0, webhookUrl: '', webhookEnabled: false },
      })

      await waitFor(() => {
        expect(result.current.config.aws.accessKeyId).toBe('aws-key')
      })

      expect(result.current.config.openai.apiKey).toBe('openai-key')
      expect(result.current.config.gemini.apiKey).toBe('gemini-key')
      expect(result.current.config.budget.monthly).toBe(100)
    })
  })

  describe('hasAwsKey', () => {
    it('returns false when AWS keys are empty', async () => {
      const { result } = renderHook(() => useConfig())

      await waitFor(() => {
        expect(result.current.loaded).toBe(true)
      })

      expect(result.current.hasAwsKey()).toBe(false)
    })

    it('returns true when AWS keys are set', async () => {
      const configWithAws: Partial<Config> = {
        aws: { accessKeyId: 'key', secretAccessKey: 'secret', region: 'us-east-1' },
      }

      await chrome.storage.local.set({ [SK.CONFIG]: configWithAws })

      const { result } = renderHook(() => useConfig())

      await waitFor(() => {
        expect(result.current.loaded).toBe(true)
      })

      expect(result.current.hasAwsKey()).toBe(true)
    })

    it('returns false when only accessKeyId is set', async () => {
      const configPartialAws: Partial<Config> = {
        aws: { accessKeyId: 'key', secretAccessKey: '', region: 'us-east-1' },
      }

      await chrome.storage.local.set({ [SK.CONFIG]: configPartialAws })

      const { result } = renderHook(() => useConfig())

      await waitFor(() => {
        expect(result.current.loaded).toBe(true)
      })

      expect(result.current.hasAwsKey()).toBe(false)
    })

    it('updates when AWS keys are added', async () => {
      const { result } = renderHook(() => useConfig())

      await waitFor(() => {
        expect(result.current.loaded).toBe(true)
      })

      expect(result.current.hasAwsKey()).toBe(false)

      await result.current.update({
        aws: { accessKeyId: 'key', secretAccessKey: 'secret', region: 'us-east-1' },
      })

      await waitFor(() => {
        expect(result.current.hasAwsKey()).toBe(true)
      })
    })
  })

  describe('loaded state', () => {
    it('starts with loaded: false', () => {
      const { result } = renderHook(() => useConfig())
      expect(result.current.loaded).toBe(false)
    })

    it('sets loaded: true after loading from storage', async () => {
      const { result } = renderHook(() => useConfig())

      await waitFor(() => {
        expect(result.current.loaded).toBe(true)
      })
    })
  })
})
