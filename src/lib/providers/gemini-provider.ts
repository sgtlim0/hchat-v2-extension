// providers/gemini-provider.ts — Google Gemini provider (direct fetch, no SDK)

import type { AIProvider, ModelDef, SendParams, ContentPart, ProviderType } from './types'
import { readSSEStream } from './sse-parser'
import { throwProviderError } from './error-parser'

export const GEMINI_MODELS: ModelDef[] = [
  {
    id: 'gemini-2.0-flash',
    provider: 'gemini',
    label: 'Gemini Flash 2.0',
    shortLabel: 'Flash 2.0',
    emoji: '🔵',
    labelKey: 'ultrafast',
    capabilities: ['chat', 'code', 'vision', 'fast'],
    cost: { input: 0.1, output: 0.4 },
  },
  {
    id: 'gemini-1.5-pro',
    provider: 'gemini',
    label: 'Gemini Pro 1.5',
    shortLabel: 'Pro 1.5',
    emoji: '🔵',
    labelKey: 'advanced',
    capabilities: ['chat', 'code', 'vision', 'reasoning'],
    cost: { input: 1.25, output: 5.0 },
  },
]

function convertToGeminiMessages(messages: SendParams['messages']) {
  const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = []

  for (const msg of messages) {
    if (msg.role === 'system') continue

    const role = msg.role === 'assistant' ? 'model' : 'user'

    if (typeof msg.content === 'string') {
      contents.push({ role, parts: [{ text: msg.content }] })
    } else {
      const parts = (msg.content as ContentPart[]).map((p) => {
        if (p.type === 'text') return { text: p.text }
        // Extract base64 data from data URL
        const url = p.image_url!.url
        const match = url.match(/^data:(.*?);base64,(.*)$/)
        if (match) {
          return { inline_data: { mime_type: match[1], data: match[2] } }
        }
        return { text: '[이미지]' }
      })
      contents.push({ role, parts })
    }
  }

  return contents
}

export class GeminiProvider implements AIProvider {
  readonly type: ProviderType = 'gemini'
  readonly models = GEMINI_MODELS

  constructor(private apiKey: string) {}

  isConfigured(): boolean {
    return !!this.apiKey
  }

  async *stream(params: SendParams): AsyncGenerator<string, string> {
    const { model, messages, systemPrompt, maxTokens = 2048, thinkingDepth } = params

    if (!this.isConfigured()) {
      throw new Error('Gemini API 키가 설정되지 않았습니다')
    }

    const effectiveMaxTokens = thinkingDepth === 'fast' ? Math.min(maxTokens, 1024) : maxTokens
    const contents = convertToGeminiMessages(messages)
    const generationConfig: Record<string, unknown> = { maxOutputTokens: effectiveMaxTokens }

    // Deep mode: enable Gemini thinking (2.0+ models with thinking support)
    if (thinkingDepth === 'deep') {
      generationConfig.thinkingConfig = { thinkingBudget: 10000 }
    }

    const body: Record<string, unknown> = {
      contents,
      generationConfig,
    }

    if (systemPrompt) {
      body.systemInstruction = { parts: [{ text: systemPrompt }] }
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify(body),
      signal: params.signal,
    })

    if (!res.ok) await throwProviderError(res)

    if (!res.body) throw new Error('응답 스트림이 없습니다')

    return yield* readSSEStream(
      res.body,
      (p: unknown) => {
        const obj = p as Record<string, unknown>
        const candidates = obj?.candidates as Array<Record<string, unknown>> | undefined
        const content = candidates?.[0]?.content as Record<string, unknown> | undefined
        const parts = content?.parts as Array<Record<string, unknown>> | undefined
        return parts?.[0]?.text as string | undefined
      }
    )
  }

  async testConnection(): Promise<boolean> {
    if (!this.isConfigured()) return false
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
      })
      return res.ok
    } catch {
      return false
    }
  }
}
