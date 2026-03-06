// providers/openrouter-provider.ts — OpenRouter provider (OpenAI-compatible API, direct fetch)

import type { AIProvider, ModelDef, SendParams, ContentPart, ProviderType } from './types'

export interface OpenRouterConfig {
  apiKey: string
  siteUrl?: string
  siteName?: string
}

const OPENROUTER_TYPE: ProviderType = 'openrouter'

export const OPENROUTER_MODELS: ModelDef[] = [
  {
    id: 'meta-llama/llama-3-70b',
    provider: OPENROUTER_TYPE,
    label: 'Llama 3 70B',
    shortLabel: 'Llama 70B',
    emoji: '🦙',
    capabilities: ['chat', 'code', 'reasoning'],
    cost: { input: 0.59, output: 0.79 },
  },
  {
    id: 'mistralai/mistral-7b',
    provider: OPENROUTER_TYPE,
    label: 'Mistral 7B',
    shortLabel: 'Mistral 7B',
    emoji: '🌀',
    capabilities: ['chat', 'code', 'fast'],
    cost: { input: 0.06, output: 0.06 },
  },
  {
    id: 'qwen/qwen-2-72b',
    provider: OPENROUTER_TYPE,
    label: 'Qwen 2 72B',
    shortLabel: 'Qwen 72B',
    emoji: '🐼',
    capabilities: ['chat', 'code', 'reasoning'],
    cost: { input: 0.56, output: 0.77 },
  },
  {
    id: 'google/gemma-2-27b',
    provider: OPENROUTER_TYPE,
    label: 'Gemma 2 27B',
    shortLabel: 'Gemma 27B',
    emoji: '💎',
    capabilities: ['chat', 'code'],
    cost: { input: 0.27, output: 0.27 },
  },
  {
    id: 'anthropic/claude-3-haiku',
    provider: OPENROUTER_TYPE,
    label: 'Claude 3 Haiku (via OpenRouter)',
    shortLabel: 'Claude Haiku',
    emoji: '⚡',
    labelKey: 'fast',
    capabilities: ['chat', 'code', 'fast'],
    cost: { input: 0.25, output: 1.25 },
  },
]

const API_URL = 'https://openrouter.ai/api/v1/chat/completions'

function convertMessages(messages: SendParams['messages'], systemPrompt?: string) {
  const result: Array<{ role: string; content: string | Array<Record<string, unknown>> }> = []

  if (systemPrompt) {
    result.push({ role: 'system', content: systemPrompt })
  }

  for (const msg of messages) {
    if (msg.role === 'system') continue

    if (typeof msg.content === 'string') {
      result.push({ role: msg.role, content: msg.content })
    } else {
      const parts = (msg.content as ContentPart[]).map((p) => {
        if (p.type === 'text') return { type: 'text', text: p.text }
        return { type: 'image_url', image_url: { url: p.image_url!.url } }
      })
      result.push({ role: msg.role, content: parts })
    }
  }

  return result
}

export class OpenRouterProvider implements AIProvider {
  readonly type: ProviderType = OPENROUTER_TYPE
  readonly models = OPENROUTER_MODELS

  private readonly config: OpenRouterConfig

  constructor(config: OpenRouterConfig) {
    this.config = config
  }

  isConfigured(): boolean {
    return !!this.config.apiKey
  }

  async *stream(params: SendParams): AsyncGenerator<string, string> {
    const { model, messages, systemPrompt, maxTokens = 2048, thinkingDepth } = params

    if (!this.isConfigured()) {
      throw new Error('OpenRouter API 키가 설정되지 않았습니다')
    }

    const effectiveMaxTokens = thinkingDepth === 'fast' ? Math.min(maxTokens, 1024) : maxTokens
    const body = JSON.stringify({
      model,
      messages: convertMessages(messages, systemPrompt),
      max_tokens: effectiveMaxTokens,
      stream: true,
    })

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
    }

    if (this.config.siteUrl) {
      headers['HTTP-Referer'] = this.config.siteUrl
    }
    if (this.config.siteName) {
      headers['X-Title'] = this.config.siteName
    }

    const res = await fetch(API_URL, {
      method: 'POST',
      headers,
      body,
      signal: params.signal,
    })

    if (!res.ok) {
      const errText = await res.text()
      let errMsg = `HTTP ${res.status}`
      try {
        const errJson = JSON.parse(errText)
        errMsg = errJson.error?.message ?? errMsg
      } catch {
        errMsg = errText || errMsg
      }
      throw new Error(errMsg)
    }

    if (!res.body) throw new Error('응답 스트림이 없습니다')

    return yield* this.readSSEStream(res.body)
  }

  private async *readSSEStream(body: ReadableStream<Uint8Array>): AsyncGenerator<string, string> {
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
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
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
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      }

      const res = await fetch(API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'mistralai/mistral-7b',
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5,
        }),
      })
      return res.ok
    } catch {
      return false
    }
  }
}
