// providers/provider-factory.ts — Create and manage provider instances

import type { AIProvider, ModelDef, ProviderType } from './types'
import { BedrockProvider, type BedrockCredentials } from './bedrock-provider'
import { OpenAIProvider } from './openai-provider'
import { GeminiProvider } from './gemini-provider'

export interface ProviderConfigs {
  bedrock: BedrockCredentials
  openai: { apiKey: string }
  gemini: { apiKey: string }
}

export function createProvider(type: ProviderType, configs: ProviderConfigs): AIProvider {
  switch (type) {
    case 'bedrock':
      return new BedrockProvider(configs.bedrock)
    case 'openai':
      return new OpenAIProvider(configs.openai.apiKey)
    case 'gemini':
      return new GeminiProvider(configs.gemini.apiKey)
  }
}

export function createAllProviders(configs: ProviderConfigs): AIProvider[] {
  return [
    new BedrockProvider(configs.bedrock),
    new OpenAIProvider(configs.openai.apiKey),
    new GeminiProvider(configs.gemini.apiKey),
  ]
}

export function getAllModels(providers: AIProvider[]): ModelDef[] {
  return providers.flatMap((p) => p.models)
}

export function getProviderForModel(
  modelId: string,
  providers: AIProvider[]
): AIProvider | undefined {
  return providers.find((p) => p.models.some((m) => m.id === modelId))
}

export function getModelDef(modelId: string, providers: AIProvider[]): ModelDef | undefined {
  for (const p of providers) {
    const m = p.models.find((m) => m.id === modelId)
    if (m) return m
  }
  return undefined
}
