// lib/models.ts — Backward-compatible wrapper around new provider system
// All original exports are preserved for existing code that imports from here.

import { BedrockProvider } from './providers/bedrock-provider'
import type { AwsCredentials } from '../hooks/useConfig'
import type { ProviderType, ModelDef as NewModelDef } from './providers/types'

// Re-export types for backward compatibility
export type Provider = ProviderType | 'claude'

export interface ModelDef {
  id: string
  provider: Provider
  label: string
  shortLabel: string
  emoji: string
}

// Legacy MODELS array — Bedrock models only (for components not yet migrated)
export const MODELS: ModelDef[] = [
  { id: 'us.anthropic.claude-sonnet-4-6', provider: 'claude', label: 'Claude Sonnet 4.6 (권장)', shortLabel: 'Sonnet 4.6', emoji: '🟣' },
  { id: 'us.anthropic.claude-opus-4-6-v1', provider: 'claude', label: 'Claude Opus 4.6 (최고 성능)', shortLabel: 'Opus 4.6', emoji: '🟣' },
  { id: 'us.anthropic.claude-haiku-4-5-20251001-v1:0', provider: 'claude', label: 'Claude Haiku 4.5 (빠름)', shortLabel: 'Haiku 4.5', emoji: '🟣' },
]

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string | ContentPart[]
}

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface StreamOptions {
  aws: AwsCredentials
  model: string
  messages: Message[]
  systemPrompt?: string
  maxTokens?: number
  onChunk: (text: string) => void
  signal?: AbortSignal
}

/**
 * Backward-compatible streaming function.
 * Delegates to BedrockProvider internally.
 */
export async function streamChat(opts: StreamOptions): Promise<string> {
  return streamChatLive(opts)
}

export async function streamChatLive(opts: StreamOptions): Promise<string> {
  const { aws, model, messages, systemPrompt, maxTokens, onChunk, signal } = opts

  const provider = new BedrockProvider(aws)

  let fullText = ''
  const gen = provider.stream({ model, messages, systemPrompt, maxTokens, signal })

  for await (const chunk of gen) {
    onChunk(chunk)
    fullText += chunk
  }

  return fullText
}
