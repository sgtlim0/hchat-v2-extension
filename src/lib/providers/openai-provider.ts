// providers/openai-provider.ts — OpenAI provider (direct fetch, no SDK)

import type { AIProvider, ModelDef, SendParams, ProviderType } from './types'
import { readSSEStream } from './sse-parser'
import { throwProviderError } from './error-parser'
import { convertToOpenAIMessages } from './message-converter'

export const OPENAI_MODELS: ModelDef[] = [
  {
    id: 'gpt-4o',
    provider: 'openai',
    label: 'GPT-4o',
    shortLabel: 'GPT-4o',
    emoji: '🟢',
    labelKey: 'multimodal',
    capabilities: ['chat', 'code', 'vision', 'reasoning'],
    cost: { input: 2.5, output: 10.0 },
  },
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    label: 'GPT-4o mini',
    shortLabel: 'GPT-4o mini',
    emoji: '🟢',
    labelKey: 'fast',
    capabilities: ['chat', 'code', 'fast'],
    cost: { input: 0.15, output: 0.6 },
  },
]

export class OpenAIProvider implements AIProvider {
  readonly type: ProviderType = 'openai'
  readonly models = OPENAI_MODELS

  constructor(private apiKey: string) {}

  isConfigured(): boolean {
    return !!this.apiKey
  }

  async *stream(params: SendParams): AsyncGenerator<string, string> {
    const { model, messages, systemPrompt, maxTokens = 2048, thinkingDepth } = params

    if (!this.isConfigured()) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다')
    }

    const effectiveMaxTokens = thinkingDepth === 'fast' ? Math.min(maxTokens, 1024) : maxTokens
    const bodyObj: Record<string, unknown> = {
      model,
      messages: convertToOpenAIMessages(messages, systemPrompt),
      max_tokens: effectiveMaxTokens,
      stream: true,
    }

    // Deep mode: request thorough reasoning via reasoning_effort (o-series models)
    if (thinkingDepth === 'deep') {
      bodyObj.reasoning_effort = 'high'
    }

    const body = JSON.stringify(bodyObj)

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body,
      signal: params.signal,
    })

    if (!res.ok) await throwProviderError(res)

    if (!res.body) throw new Error('응답 스트림이 없습니다')

    return yield* readSSEStream(
      res.body,
      (p: unknown) => {
        const obj = p as Record<string, unknown>
        const choices = obj?.choices as Array<Record<string, unknown>> | undefined
        const delta = choices?.[0]?.delta as Record<string, unknown> | undefined
        return delta?.content as string | undefined
      },
      { hasDoneSignal: true }
    )
  }

  async testConnection(): Promise<boolean> {
    if (!this.isConfigured()) return false
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
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
