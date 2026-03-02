// providers/openai-provider.ts — OpenAI provider (direct fetch, no SDK)

import type { AIProvider, ModelDef, SendParams, ContentPart, ProviderType } from './types'

const OPENAI_MODELS: ModelDef[] = [
  {
    id: 'gpt-4o',
    provider: 'openai',
    label: 'GPT-4o (멀티모달)',
    shortLabel: 'GPT-4o',
    emoji: '🟢',
    capabilities: ['chat', 'code', 'vision', 'reasoning'],
    cost: { input: 2.5, output: 10.0 },
  },
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    label: 'GPT-4o mini (빠름)',
    shortLabel: 'GPT-4o mini',
    emoji: '🟢',
    capabilities: ['chat', 'code', 'fast'],
    cost: { input: 0.15, output: 0.6 },
  },
]

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

export class OpenAIProvider implements AIProvider {
  readonly type: ProviderType = 'openai'
  readonly models = OPENAI_MODELS

  constructor(private apiKey: string) {}

  isConfigured(): boolean {
    return !!this.apiKey
  }

  async *stream(params: SendParams): AsyncGenerator<string, string> {
    const { model, messages, systemPrompt, maxTokens = 2048 } = params

    if (!this.isConfigured()) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다')
    }

    const body = JSON.stringify({
      model,
      messages: convertMessages(messages, systemPrompt),
      max_tokens: maxTokens,
      stream: true,
    })

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
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
