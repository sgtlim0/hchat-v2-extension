// providers/sse-parser.ts — Unified SSE stream parser for OpenAI, Gemini, OpenRouter

export interface SSEParserOptions {
  hasDoneSignal?: boolean
}

/**
 * Reads an SSE (Server-Sent Events) stream and yields extracted content chunks.
 * @param body - ReadableStream from a fetch response
 * @param extractContent - Callback to extract text content from a parsed JSON object
 * @param options - Optional: hasDoneSignal for OpenAI/OpenRouter `[DONE]` signal handling
 * @returns AsyncGenerator that yields content chunks and returns the full concatenated text
 */
export async function* readSSEStream(
  body: ReadableStream<Uint8Array>,
  extractContent: (parsed: unknown) => string | undefined,
  options?: SSEParserOptions
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
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (options?.hasDoneSignal && data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          const content = extractContent(parsed)
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
