// providers/message-converter.ts — Unified OpenAI-format message converter

import type { SendParams, ContentPart } from './types'

export interface ConvertOptions {
  textOnly?: boolean
}

/**
 * Convert internal messages to OpenAI-compatible format.
 * Used by OpenAI, OpenRouter, and Ollama (with textOnly option).
 *
 * @param messages - Internal message array
 * @param systemPrompt - Optional system prompt (prepended as system role)
 * @param options - textOnly: flatten multimodal content to text (for Ollama)
 */
export function convertToOpenAIMessages(
  messages: SendParams['messages'],
  systemPrompt?: string,
  options?: ConvertOptions
): Array<{ role: string; content: string | Array<Record<string, unknown>> }> {
  const result: Array<{ role: string; content: string | Array<Record<string, unknown>> }> = []

  if (systemPrompt) {
    result.push({ role: 'system', content: systemPrompt })
  }

  for (const msg of messages) {
    if (msg.role === 'system') continue

    if (typeof msg.content === 'string') {
      result.push({ role: msg.role, content: msg.content })
    } else if (options?.textOnly) {
      const text = (msg.content as ContentPart[]).map((p) => p.text ?? '').join('')
      result.push({ role: msg.role, content: text })
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
