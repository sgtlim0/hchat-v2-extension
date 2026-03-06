// providers/provider-factory.ts — Create and manage provider instances

import type { AIProvider, ModelDef, ProviderType } from './types'
import { BedrockProvider, BEDROCK_MODELS, type BedrockCredentials } from './bedrock-provider'
import { OpenAIProvider, OPENAI_MODELS } from './openai-provider'
import { GeminiProvider, GEMINI_MODELS } from './gemini-provider'
import { OllamaProvider, type OllamaConfig } from './ollama-provider'
import { OpenRouterProvider, OPENROUTER_MODELS, type OpenRouterConfig } from './openrouter-provider'

/** Static list of all model definitions (no credentials needed) */
const ALL_STATIC_MODELS: ModelDef[] = [
  ...BEDROCK_MODELS,
  ...OPENAI_MODELS,
  ...GEMINI_MODELS,
  ...OPENROUTER_MODELS,
]

export interface ProviderConfigs {
  bedrock: BedrockCredentials
  openai: { apiKey: string }
  gemini: { apiKey: string }
  ollama?: OllamaConfig
  openrouter?: OpenRouterConfig
}

export function createProvider(type: ProviderType, configs: ProviderConfigs): AIProvider {
  switch (type) {
    case 'bedrock':
      return new BedrockProvider(configs.bedrock)
    case 'openai':
      return new OpenAIProvider(configs.openai.apiKey)
    case 'gemini':
      return new GeminiProvider(configs.gemini.apiKey)
    case 'ollama':
      return new OllamaProvider(configs.ollama ?? {})
    case 'openrouter':
      return new OpenRouterProvider(configs.openrouter ?? { apiKey: '' })
  }
}

export function createAllProviders(configs: ProviderConfigs): AIProvider[] {
  const providers: AIProvider[] = [
    new BedrockProvider(configs.bedrock),
    new OpenAIProvider(configs.openai.apiKey),
    new GeminiProvider(configs.gemini.apiKey),
  ]

  if (configs.ollama) {
    providers.push(new OllamaProvider(configs.ollama))
  }

  if (configs.openrouter) {
    providers.push(new OpenRouterProvider(configs.openrouter))
  }

  return providers
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

/** Get model emoji without needing provider instances (uses static model definitions) */
export function getModelEmoji(modelId: string): string {
  return ALL_STATIC_MODELS.find((m) => m.id === modelId)?.emoji ?? '🤖'
}

/** Get static model definition without needing provider instances */
export function getStaticModelDef(modelId: string): ModelDef | undefined {
  return ALL_STATIC_MODELS.find((m) => m.id === modelId)
}
