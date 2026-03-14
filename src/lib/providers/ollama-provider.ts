// providers/ollama-provider.ts — Ollama local LLM provider (direct fetch, no SDK)

import type { AIProvider, ModelDef, SendParams, ProviderType } from './types'
import { throwProviderError } from './error-parser'
import { convertToOpenAIMessages } from './message-converter'

const DEFAULT_BASE_URL = 'http://localhost:11434'

export interface OllamaConfig {
  baseUrl?: string
  modelFilter?: string[]
}

interface OllamaTagsResponse {
  models: Array<{ name: string; size: number }>
}

function toModelDef(model: { name: string }): ModelDef {
  const shortName = model.name.split(':')[0]
  return {
    id: model.name,
    provider: 'ollama',
    label: model.name,
    shortLabel: shortName,
    emoji: '\uD83E\uDDE0',
    capabilities: ['chat'],
    cost: { input: 0, output: 0 },
  }
}

export class OllamaProvider implements AIProvider {
  readonly type: ProviderType = 'ollama'
  readonly models: ModelDef[] = []

  private readonly baseUrl: string
  private readonly modelFilter: string[]

  constructor(config: OllamaConfig) {
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL
    this.modelFilter = config.modelFilter ?? []
  }

  isConfigured(): boolean {
    return !!this.baseUrl
  }

  async loadModels(): Promise<ModelDef[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`)
      if (!res.ok) return []

      const data: OllamaTagsResponse = await res.json()
      const allModels = (data.models ?? []).map(toModelDef)

      if (this.modelFilter.length === 0) {
        return allModels
      }

      return allModels.filter((m) =>
        this.modelFilter.some((f) => m.id.includes(f))
      )
    } catch {
      return []
    }
  }

  async *stream(params: SendParams): AsyncGenerator<string, string> {
    if (!this.isConfigured()) {
      throw new Error('Ollama 서버 URL이 설정되지 않았습니다')
    }

    const { model, messages, systemPrompt, signal } = params

    const body = JSON.stringify({
      model,
      messages: convertToOpenAIMessages(messages, systemPrompt, { textOnly: true }),
      stream: true,
    })

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal,
    })

    if (!res.ok) await throwProviderError(res)

    if (!res.body) throw new Error('응답 스트림이 없습니다')

    return yield* this.readNDJSONStream(res.body)
  }

  private async *readNDJSONStream(
    body: ReadableStream<Uint8Array>
  ): AsyncGenerator<string, string> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let fullText = ''
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          try {
            const parsed = JSON.parse(trimmed)
            if (parsed.done) continue

            const content = parsed.message?.content
            if (content) {
              fullText += content
              yield content
            }
          } catch {
            // Invalid JSON line, skip
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    return fullText
  }

  async testConnection(): Promise<boolean> {
    if (!this.isConfigured()) return false
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`)
      return res.ok
    } catch {
      return false
    }
  }
}
