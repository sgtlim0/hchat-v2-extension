import { useState, useEffect, useCallback } from 'react'
import { Storage } from '../lib/storage'

export interface AwsCredentials {
  accessKeyId: string
  secretAccessKey: string
  region: string
}

export interface Config {
  aws: AwsCredentials
  openai: { apiKey: string }
  gemini: { apiKey: string }
  defaultModel: string
  autoRouting: boolean
  theme: 'dark' | 'light'
  language: string
  enableContentScript: boolean
  enableSearchEnhance: boolean
  enableWebSearch: boolean
  googleSearchApiKey: string
  googleSearchEngineId: string
}

const DEFAULTS: Config = {
  aws: { accessKeyId: '', secretAccessKey: '', region: 'us-east-1' },
  openai: { apiKey: '' },
  gemini: { apiKey: '' },
  defaultModel: 'us.anthropic.claude-sonnet-4-6',
  autoRouting: false,
  theme: 'dark',
  language: 'ko',
  enableContentScript: true,
  enableSearchEnhance: true,
  enableWebSearch: true,
  googleSearchApiKey: '',
  googleSearchEngineId: '',
}

export function useConfig() {
  const [config, setConfig] = useState<Config>(DEFAULTS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Storage.get<Config>('hchat:config').then((saved) => {
      if (saved) setConfig((c) => ({
        ...c,
        ...saved,
        aws: { ...c.aws, ...(saved.aws ?? {}) },
        openai: { ...c.openai, ...(saved.openai ?? {}) },
        gemini: { ...c.gemini, ...(saved.gemini ?? {}) },
      }))
      setLoaded(true)
    })
  }, [])

  const update = useCallback(async (patch: Partial<Config>) => {
    setConfig((c) => {
      const updated = {
        ...c,
        ...patch,
        aws: { ...c.aws, ...(patch.aws ?? {}) },
        openai: { ...c.openai, ...(patch.openai ?? {}) },
        gemini: { ...c.gemini, ...(patch.gemini ?? {}) },
      }
      Storage.set('hchat:config', updated)
      // Also store AWS credentials separately for background worker access
      if (patch.aws) {
        Storage.set('hchat:config:aws', updated.aws)
      }
      chrome.runtime.sendMessage({ type: 'CONFIG_UPDATED', config: updated }).catch(() => {})
      return updated
    })
  }, [])

  const hasAwsKey = useCallback(() => !!config.aws.accessKeyId && !!config.aws.secretAccessKey, [config])

  return { config, update, loaded, hasAwsKey }
}
