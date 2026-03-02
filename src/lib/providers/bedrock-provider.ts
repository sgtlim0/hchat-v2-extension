// providers/bedrock-provider.ts — AWS Bedrock (Claude) provider

import { signRequest } from '../aws-sigv4'
import type { AIProvider, ModelDef, SendParams, ContentPart, ProviderType } from './types'

export interface BedrockCredentials {
  accessKeyId: string
  secretAccessKey: string
  region: string
}

const BEDROCK_MODELS: ModelDef[] = [
  {
    id: 'us.anthropic.claude-sonnet-4-6',
    provider: 'bedrock',
    label: 'Claude Sonnet 4.6',
    shortLabel: 'Sonnet 4.6',
    emoji: '🟣',
    labelKey: 'recommended',
    capabilities: ['chat', 'code', 'vision', 'reasoning'],
    cost: { input: 3.0, output: 15.0 },
  },
  {
    id: 'us.anthropic.claude-opus-4-6-v1',
    provider: 'bedrock',
    label: 'Claude Opus 4.6',
    shortLabel: 'Opus 4.6',
    emoji: '🟣',
    labelKey: 'bestPerformance',
    capabilities: ['chat', 'code', 'vision', 'reasoning'],
    cost: { input: 15.0, output: 75.0 },
  },
  {
    id: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    provider: 'bedrock',
    label: 'Claude Haiku 4.5',
    shortLabel: 'Haiku 4.5',
    emoji: '🟣',
    labelKey: 'fast',
    capabilities: ['chat', 'code', 'fast'],
    cost: { input: 0.8, output: 4.0 },
  },
]

function b64toUtf8(b64: string): string {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder('utf-8').decode(bytes)
}

export class BedrockProvider implements AIProvider {
  readonly type: ProviderType = 'bedrock'
  readonly models = BEDROCK_MODELS

  constructor(private credentials: BedrockCredentials) {}

  isConfigured(): boolean {
    return !!this.credentials.accessKeyId && !!this.credentials.secretAccessKey
  }

  async *stream(params: SendParams): AsyncGenerator<string, string> {
    const { model, messages, systemPrompt, maxTokens = 2048 } = params

    if (!this.isConfigured()) {
      throw new Error('AWS 자격증명이 설정되지 않았습니다')
    }

    const region = this.credentials.region || 'us-east-1'

    const msgs = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role,
        content: typeof m.content === 'string'
          ? m.content
          : (m.content as ContentPart[]).map((p) =>
              p.type === 'text'
                ? { type: 'text', text: p.text }
                : { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: p.image_url!.url.split(',')[1] } }
            ),
      }))

    const effectiveMaxTokens = params.thinkingDepth === 'fast' ? Math.min(maxTokens, 1024) : maxTokens

    const body: Record<string, unknown> = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: effectiveMaxTokens,
      messages: msgs,
    }
    if (systemPrompt) body.system = systemPrompt

    if (params.thinkingDepth === 'deep') {
      body.thinking = { type: 'enabled', budget_tokens: 10000 }
      delete body.temperature
    }

    const encodedModel = encodeURIComponent(model)
    const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodedModel}/invoke-with-response-stream`
    const bodyStr = JSON.stringify(body)

    const signedHeaders = await signRequest({
      method: 'POST',
      url,
      headers: { 'content-type': 'application/json' },
      body: bodyStr,
      accessKeyId: this.credentials.accessKeyId,
      secretAccessKey: this.credentials.secretAccessKey,
      region,
      service: 'bedrock',
    })

    const res = await fetch(url, {
      method: 'POST',
      headers: signedHeaders,
      body: bodyStr,
      signal: params.signal,
    })

    if (!res.ok) {
      const errText = await res.text()
      let errMsg = `HTTP ${res.status}`
      try {
        const errJson = JSON.parse(errText)
        errMsg = errJson.message ?? errJson.Message ?? errMsg
      } catch {
        errMsg = errText || errMsg
      }
      throw new Error(errMsg)
    }

    if (!res.body) throw new Error('응답 스트림이 없습니다')

    return yield* this.readBedrockStream(res.body)
  }

  private async *readBedrockStream(body: ReadableStream<Uint8Array>): AsyncGenerator<string, string> {
    const reader = body.getReader()
    let fullText = ''
    let buffer = new Uint8Array(0)

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const merged = new Uint8Array(buffer.length + value.length)
        merged.set(buffer)
        merged.set(value, buffer.length)
        buffer = merged

        while (buffer.length >= 12) {
          const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
          const totalLength = view.getUint32(0)
          const headersLength = view.getUint32(4)

          if (buffer.length < totalLength) break

          const payloadOffset = 12 + headersLength
          const payloadLength = totalLength - headersLength - 16

          if (payloadLength > 0) {
            const payload = buffer.slice(payloadOffset, payloadOffset + payloadLength)
            const payloadStr = new TextDecoder('utf-8').decode(payload)

            try {
              const event = JSON.parse(payloadStr)
              if (event.bytes) {
                const decoded = b64toUtf8(event.bytes)
                const inner = JSON.parse(decoded)
                if (inner.type === 'content_block_delta' && inner.delta?.text) {
                  fullText += inner.delta.text
                  yield inner.delta.text
                }
              }
            } catch {
              // Non-JSON payload — ignore
            }
          }

          buffer = buffer.slice(totalLength)
        }
      }
    } finally {
      reader.releaseLock()
    }

    return fullText
  }

  async testConnection(): Promise<boolean> {
    if (!this.isConfigured()) return false
    const region = this.credentials.region || 'us-east-1'
    const model = this.models[0].id
    const bodyStr = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }],
    })
    const encodedModel = encodeURIComponent(model)
    const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodedModel}/invoke`

    try {
      const signedHeaders = await signRequest({
        method: 'POST',
        url,
        headers: { 'content-type': 'application/json' },
        body: bodyStr,
        accessKeyId: this.credentials.accessKeyId,
        secretAccessKey: this.credentials.secretAccessKey,
        region,
        service: 'bedrock',
      })
      const resp = await fetch(url, { method: 'POST', headers: signedHeaders, body: bodyStr })
      return resp.ok
    } catch {
      return false
    }
  }
}
