// hooks/useProvider.ts — Memoized provider instances and utilities

import { useMemo, useCallback } from 'react'
import type { Config } from './useConfig'
import type { AIProvider, ModelDef } from '../lib/providers/types'
import { createAllProviders, getAllModels, getProviderForModel, getModelDef } from '../lib/providers/provider-factory'
import { routeModel } from '../lib/providers/model-router'

export function useProvider(config: Config) {
  const providers = useMemo<AIProvider[]>(
    () => createAllProviders({
      bedrock: config.aws,
      openai: config.openai,
      gemini: config.gemini,
      ollama: config.ollama.baseUrl ? config.ollama : undefined,
      openrouter: config.openrouter.apiKey ? config.openrouter : undefined,
    }),
    [config.aws, config.openai, config.gemini, config.ollama, config.openrouter]
  )

  const allModels = useMemo<ModelDef[]>(
    () => getAllModels(providers),
    [providers]
  )

  const configuredModels = useMemo<ModelDef[]>(
    () => allModels.filter((m) => {
      const p = getProviderForModel(m.id, providers)
      return p?.isConfigured()
    }),
    [allModels, providers]
  )

  const getProvider = useCallback(
    (modelId: string): AIProvider | undefined => getProviderForModel(modelId, providers),
    [providers]
  )

  const getModel = useCallback(
    (modelId: string): ModelDef | undefined => getModelDef(modelId, providers),
    [providers]
  )

  const route = useCallback(
    (prompt: string, hasImage = false): string | null => routeModel(prompt, providers, hasImage),
    [providers]
  )

  const hasAnyKey = useMemo(
    () => providers.some((p) => p.isConfigured()),
    [providers]
  )

  return { providers, allModels, configuredModels, getProvider, getModel, route, hasAnyKey }
}
