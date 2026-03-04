// providers/types.ts — Multi-provider type definitions

export type ProviderType = 'bedrock' | 'openai' | 'gemini'

export const PROVIDER_COLORS: Record<ProviderType, string> = {
  bedrock: '#ff9900',
  openai: '#10a37f',
  gemini: '#4285f4',
}

export type ModelCapability = 'chat' | 'code' | 'vision' | 'reasoning' | 'fast'

export interface ModelDef {
  id: string
  provider: ProviderType
  label: string
  shortLabel: string
  emoji: string
  labelKey?: string  // i18n key in modelLabels.* for translated suffix
  capabilities: ModelCapability[]
  cost: { input: number; output: number }  // USD per 1M tokens
}

export interface ContentPart {
  type: 'text' | 'image_url'
  text?: string
  image_url?: { url: string }
}

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string | ContentPart[]
}

export type ThinkingDepth = 'fast' | 'normal' | 'deep'

export interface SendParams {
  model: string
  messages: Message[]
  systemPrompt?: string
  maxTokens?: number
  signal?: AbortSignal
  thinkingDepth?: ThinkingDepth
}

/**
 * Unified AI Provider interface.
 * stream() returns an AsyncGenerator that yields chunks and returns full text.
 */
export interface AIProvider {
  readonly type: ProviderType
  readonly models: ModelDef[]
  isConfigured(): boolean
  stream(params: SendParams): AsyncGenerator<string, string>
  testConnection(): Promise<boolean>
}
