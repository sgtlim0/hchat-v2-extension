import { signRequest } from './aws-sigv4'
import type { AwsCredentials } from '../hooks/useConfig'

export type Provider = 'claude'

export interface ModelDef {
  id: string
  provider: Provider
  label: string
  shortLabel: string
  emoji: string
}

export const MODELS: ModelDef[] = [
  { id: 'us.anthropic.claude-sonnet-4-6-v1:0', provider: 'claude', label: 'Claude Sonnet 4.6 (권장)', shortLabel: 'Sonnet 4.6', emoji: '🟣' },
  { id: 'us.anthropic.claude-opus-4-6-v1:0', provider: 'claude', label: 'Claude Opus 4.6 (최고 성능)', shortLabel: 'Opus 4.6', emoji: '🟣' },
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
}

/** base64 -> UTF-8 string (multibyte safe) */
function b64toUtf8(b64: string): string {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder('utf-8').decode(bytes)
}

// ── Unified streaming caller via AWS Bedrock ──

export async function streamChat(opts: StreamOptions): Promise<string> {
  return streamChatLive(opts)
}

export async function streamChatLive(opts: StreamOptions): Promise<string> {
  const { aws, model, messages, systemPrompt, maxTokens = 2048, onChunk } = opts

  if (!aws.accessKeyId || !aws.secretAccessKey) {
    throw new Error('AWS 자격증명이 설정되지 않았습니다')
  }

  const region = aws.region || 'us-east-1'

  // Build Bedrock Anthropic request body
  const msgs = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role,
      content: typeof m.content === 'string'
        ? m.content
        : (m.content as ContentPart[]).map((p) =>
            p.type === 'text'
              ? { type: 'text', text: p.text }
              : { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: p.image_url.url.split(',')[1] } }
          ),
    }))

  const body: Record<string, unknown> = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    messages: msgs,
  }
  if (systemPrompt) body.system = systemPrompt

  const encodedModel = encodeURIComponent(model)
  const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodedModel}/invoke-with-response-stream`
  const bodyStr = JSON.stringify(body)

  const signedHeaders = await signRequest({
    method: 'POST',
    url,
    headers: { 'content-type': 'application/json' },
    body: bodyStr,
    accessKeyId: aws.accessKeyId,
    secretAccessKey: aws.secretAccessKey,
    region,
    service: 'bedrock',
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: signedHeaders,
    body: bodyStr,
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

  return readBedrockStream(res.body, onChunk)
}

/**
 * AWS Event Stream binary protocol parser
 * Each message: [4B totalLen][4B headersLen][4B preludeCRC][headers...][payload...][4B msgCRC]
 */
async function readBedrockStream(
  body: ReadableStream<Uint8Array>,
  onChunk: (text: string) => void
): Promise<string> {
  const reader = body.getReader()
  let fullText = ''
  let buffer = new Uint8Array(0)

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
              onChunk(inner.delta.text)
            }
          }
        } catch {
          // Non-JSON payload — ignore
        }
      }

      buffer = buffer.slice(totalLength)
    }
  }

  return fullText
}
