import { describe, it, expect } from 'vitest'
import { parseErrorMessage, throwProviderError } from '../error-parser'

describe('parseErrorMessage', () => {
  it('extracts error.message from OpenAI-style JSON', () => {
    const body = JSON.stringify({ error: { message: 'Invalid API key' } })
    expect(parseErrorMessage(401, body)).toBe('Invalid API key')
  })

  it('extracts top-level message from Bedrock-style JSON', () => {
    const body = JSON.stringify({ message: 'Access denied' })
    expect(parseErrorMessage(403, body)).toBe('Access denied')
  })

  it('extracts Message (capital M) from Bedrock-style JSON', () => {
    const body = JSON.stringify({ Message: 'Throttling exception' })
    expect(parseErrorMessage(429, body)).toBe('Throttling exception')
  })

  it('prefers error.message over top-level message', () => {
    const body = JSON.stringify({ error: { message: 'detailed' }, message: 'generic' })
    expect(parseErrorMessage(500, body)).toBe('detailed')
  })

  it('falls back to plain text body when JSON parse fails', () => {
    expect(parseErrorMessage(500, 'Internal Server Error')).toBe('Internal Server Error')
  })

  it('falls back to HTTP status when body is empty', () => {
    expect(parseErrorMessage(502, '')).toBe('HTTP 502')
  })

  it('falls back to HTTP status when JSON has no known message fields', () => {
    const body = JSON.stringify({ code: 'RATE_LIMIT' })
    expect(parseErrorMessage(429, body)).toBe('HTTP 429')
  })

  it('handles various HTTP status codes', () => {
    expect(parseErrorMessage(400, '')).toBe('HTTP 400')
    expect(parseErrorMessage(404, '')).toBe('HTTP 404')
    expect(parseErrorMessage(503, '')).toBe('HTTP 503')
  })

  it('handles deeply nested but valid JSON without known keys', () => {
    const body = JSON.stringify({ data: { nested: { deep: true } } })
    expect(parseErrorMessage(500, body)).toBe('HTTP 500')
  })

  it('handles JSON array body', () => {
    const body = JSON.stringify([{ error: 'something' }])
    expect(parseErrorMessage(500, body)).toBe('HTTP 500')
  })
})

describe('throwProviderError', () => {
  it('throws Error with parsed JSON message', async () => {
    const res = new Response(JSON.stringify({ error: { message: 'Rate limit exceeded' } }), {
      status: 429,
    })
    await expect(throwProviderError(res)).rejects.toThrow('Rate limit exceeded')
  })

  it('throws Error with plain text body', async () => {
    const res = new Response('Bad Gateway', { status: 502 })
    await expect(throwProviderError(res)).rejects.toThrow('Bad Gateway')
  })

  it('throws Error with HTTP status when body is empty', async () => {
    const res = new Response('', { status: 500 })
    await expect(throwProviderError(res)).rejects.toThrow('HTTP 500')
  })

  it('throws Error with Bedrock-style message field', async () => {
    const res = new Response(JSON.stringify({ message: 'Model not found' }), { status: 404 })
    await expect(throwProviderError(res)).rejects.toThrow('Model not found')
  })
})
