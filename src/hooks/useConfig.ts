import { useState, useEffect, useCallback } from 'react'
import { Storage } from '../lib/storage'
import { SK } from '../lib/storageKeys'

export interface AwsCredentials {
  accessKeyId: string
  secretAccessKey: string
  region: string
}

export interface BudgetConfig {
  monthly: number         // Monthly budget in USD, 0 = disabled
  warnThreshold: number   // Warning threshold (%), default 70
  critThreshold: number   // Critical threshold (%), default 90
  webhookUrl: string      // Slack/Discord/generic webhook URL for alerts
  webhookEnabled: boolean // Whether webhook notification is enabled
}

export interface OllamaConfig {
  baseUrl: string
  modelFilter: string[]
}

export interface OpenRouterConfig {
  apiKey: string
  siteUrl: string
  siteName: string
}

export interface Config {
  aws: AwsCredentials
  openai: { apiKey: string }
  gemini: { apiKey: string }
  ollama: OllamaConfig
  openrouter: OpenRouterConfig
  defaultModel: string
  autoRouting: boolean
  theme: 'system' | 'dark' | 'light'
  language: string
  enableContentScript: boolean
  enableSearchEnhance: boolean
  enableWebSearch: boolean
  googleSearchApiKey: string
  googleSearchEngineId: string
  budget: BudgetConfig
}

const DEFAULTS: Config = {
  aws: { accessKeyId: '', secretAccessKey: '', region: 'us-east-1' },
  openai: { apiKey: '' },
  gemini: { apiKey: '' },
  ollama: { baseUrl: '', modelFilter: [] },
  openrouter: { apiKey: '', siteUrl: '', siteName: '' },
  defaultModel: 'us.anthropic.claude-sonnet-4-6',
  autoRouting: false,
  theme: 'system',
  language: 'ko',
  enableContentScript: true,
  enableSearchEnhance: true,
  enableWebSearch: true,
  googleSearchApiKey: '',
  googleSearchEngineId: '',
  budget: { monthly: 0, warnThreshold: 70, critThreshold: 90, webhookUrl: '', webhookEnabled: false },
}

const VALID_THEMES = ['system', 'dark', 'light'] as const

export function validateConfig(raw: unknown): { valid: boolean; data: Config; errors: string[] } {
  if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, data: DEFAULTS, errors: ['Config must be a non-null object'] }
  }
  const input = raw as Record<string, unknown>
  const errors: string[] = []

  const str = (v: unknown, fallback: string): string => {
    if (v === undefined) return fallback
    if (typeof v === 'string') return v
    errors.push(`Expected string, got ${typeof v}`)
    return fallback
  }
  const bool = (v: unknown, fallback: boolean): boolean => {
    if (v === undefined) return fallback
    if (typeof v === 'boolean') return v
    errors.push(`Expected boolean, got ${typeof v}`)
    return fallback
  }
  const num = (v: unknown, fallback: number): number => {
    if (v === undefined) return fallback
    if (typeof v === 'number' && !Number.isNaN(v)) return v
    errors.push(`Expected number, got ${typeof v}`)
    return fallback
  }
  const obj = (v: unknown): Record<string, unknown> =>
    (v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v)) ? v as Record<string, unknown> : {}
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []

  const rawAws = obj(input.aws)
  const rawOpenai = obj(input.openai)
  const rawGemini = obj(input.gemini)
  const rawOllama = obj(input.ollama)
  const rawOpenrouter = obj(input.openrouter)
  const rawBudget = obj(input.budget)

  const theme = typeof input.theme === 'string' && VALID_THEMES.includes(input.theme as typeof VALID_THEMES[number])
    ? input.theme as Config['theme']
    : (input.theme !== undefined && errors.push(`Invalid theme: ${String(input.theme)}`), DEFAULTS.theme)

  const data: Config = {
    aws: {
      accessKeyId: str(rawAws.accessKeyId, DEFAULTS.aws.accessKeyId),
      secretAccessKey: str(rawAws.secretAccessKey, DEFAULTS.aws.secretAccessKey),
      region: str(rawAws.region, DEFAULTS.aws.region),
    },
    openai: { apiKey: str(rawOpenai.apiKey, DEFAULTS.openai.apiKey) },
    gemini: { apiKey: str(rawGemini.apiKey, DEFAULTS.gemini.apiKey) },
    ollama: {
      baseUrl: str(rawOllama.baseUrl, DEFAULTS.ollama.baseUrl),
      modelFilter: strArr(rawOllama.modelFilter),
    },
    openrouter: {
      apiKey: str(rawOpenrouter.apiKey, DEFAULTS.openrouter.apiKey),
      siteUrl: str(rawOpenrouter.siteUrl, DEFAULTS.openrouter.siteUrl),
      siteName: str(rawOpenrouter.siteName, DEFAULTS.openrouter.siteName),
    },
    defaultModel: str(input.defaultModel, DEFAULTS.defaultModel),
    autoRouting: bool(input.autoRouting, DEFAULTS.autoRouting),
    theme,
    language: str(input.language, DEFAULTS.language),
    enableContentScript: bool(input.enableContentScript, DEFAULTS.enableContentScript),
    enableSearchEnhance: bool(input.enableSearchEnhance, DEFAULTS.enableSearchEnhance),
    enableWebSearch: bool(input.enableWebSearch, DEFAULTS.enableWebSearch),
    googleSearchApiKey: str(input.googleSearchApiKey, DEFAULTS.googleSearchApiKey),
    googleSearchEngineId: str(input.googleSearchEngineId, DEFAULTS.googleSearchEngineId),
    budget: {
      monthly: num(rawBudget.monthly, DEFAULTS.budget.monthly),
      warnThreshold: num(rawBudget.warnThreshold, DEFAULTS.budget.warnThreshold),
      critThreshold: num(rawBudget.critThreshold, DEFAULTS.budget.critThreshold),
      webhookUrl: str(rawBudget.webhookUrl, DEFAULTS.budget.webhookUrl),
      webhookEnabled: bool(rawBudget.webhookEnabled, DEFAULTS.budget.webhookEnabled),
    },
  }

  return { valid: errors.length === 0, data, errors }
}

export function useConfig() {
  const [config, setConfig] = useState<Config>(DEFAULTS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Storage.get<unknown>(SK.CONFIG).then((saved) => {
      if (saved) {
        const result = validateConfig(saved)
        if (!result.valid) {
          console.warn('Config validation errors (using defaults for invalid fields):', result.errors)
        }
        setConfig(result.data)
      }
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
        ollama: { ...c.ollama, ...(patch.ollama ?? {}) },
        openrouter: { ...c.openrouter, ...(patch.openrouter ?? {}) },
        budget: { ...c.budget, ...(patch.budget ?? {}) },
      }
      Storage.set(SK.CONFIG, updated)
      // Also store AWS credentials separately for background worker access
      if (patch.aws) {
        Storage.set(SK.CONFIG_AWS, updated.aws)
      }
      chrome.runtime.sendMessage({ type: 'CONFIG_UPDATED', config: updated }).catch(() => {})
      return updated
    })
  }, [])

  const hasAwsKey = useCallback(() => !!config.aws.accessKeyId && !!config.aws.secretAccessKey, [config])

  return { config, update, loaded, hasAwsKey }
}
