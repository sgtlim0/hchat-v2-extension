import { describe, it, expect } from 'vitest'
import { convertToOpenAIMessages } from '../message-converter'
import type { Message } from '../types'

describe('convertToOpenAIMessages', () => {
  describe('system prompt handling', () => {
    it('prepends system prompt as system role message', () => {
      const messages: Message[] = [{ role: 'user', content: 'Hello' }]
      const result = convertToOpenAIMessages(messages, 'You are helpful')
      expect(result[0]).toEqual({ role: 'system', content: 'You are helpful' })
      expect(result[1]).toEqual({ role: 'user', content: 'Hello' })
    })

    it('omits system message when systemPrompt is undefined', () => {
      const messages: Message[] = [{ role: 'user', content: 'Hi' }]
      const result = convertToOpenAIMessages(messages)
      expect(result).toEqual([{ role: 'user', content: 'Hi' }])
    })

    it('omits system message when systemPrompt is empty string', () => {
      const messages: Message[] = [{ role: 'user', content: 'Hi' }]
      const result = convertToOpenAIMessages(messages, '')
      expect(result).toEqual([{ role: 'user', content: 'Hi' }])
    })
  })

  describe('string content messages', () => {
    it('passes string content through directly', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Question' },
        { role: 'assistant', content: 'Answer' },
      ]
      const result = convertToOpenAIMessages(messages)
      expect(result).toEqual([
        { role: 'user', content: 'Question' },
        { role: 'assistant', content: 'Answer' },
      ])
    })

    it('filters out system role messages from input', () => {
      const messages: Message[] = [
        { role: 'system', content: 'ignored' },
        { role: 'user', content: 'kept' },
      ]
      const result = convertToOpenAIMessages(messages)
      expect(result).toEqual([{ role: 'user', content: 'kept' }])
    })
  })

  describe('multimodal content (default mode)', () => {
    it('converts text parts', () => {
      const messages: Message[] = [{
        role: 'user',
        content: [{ type: 'text', text: 'Describe this' }],
      }]
      const result = convertToOpenAIMessages(messages)
      expect(result[0].content).toEqual([{ type: 'text', text: 'Describe this' }])
    })

    it('converts image parts to image_url format', () => {
      const messages: Message[] = [{
        role: 'user',
        content: [
          { type: 'text', text: 'What is this?' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
        ],
      }]
      const result = convertToOpenAIMessages(messages)
      const parts = result[0].content as Array<Record<string, unknown>>
      expect(parts).toHaveLength(2)
      expect(parts[0]).toEqual({ type: 'text', text: 'What is this?' })
      expect(parts[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } })
    })
  })

  describe('textOnly mode (for Ollama)', () => {
    it('flattens multimodal content to text only', () => {
      const messages: Message[] = [{
        role: 'user',
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'world' },
        ],
      }]
      const result = convertToOpenAIMessages(messages, undefined, { textOnly: true })
      expect(result[0]).toEqual({ role: 'user', content: 'Hello world' })
    })

    it('ignores image parts in textOnly mode', () => {
      const messages: Message[] = [{
        role: 'user',
        content: [
          { type: 'text', text: 'See this: ' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } },
        ],
      }]
      const result = convertToOpenAIMessages(messages, undefined, { textOnly: true })
      expect(result[0]).toEqual({ role: 'user', content: 'See this: ' })
    })

    it('handles string content normally in textOnly mode', () => {
      const messages: Message[] = [{ role: 'user', content: 'plain text' }]
      const result = convertToOpenAIMessages(messages, undefined, { textOnly: true })
      expect(result[0]).toEqual({ role: 'user', content: 'plain text' })
    })
  })

  describe('combined scenarios', () => {
    it('handles system prompt + mixed content types', () => {
      const messages: Message[] = [
        { role: 'user', content: 'text message' },
        { role: 'assistant', content: 'response' },
        { role: 'user', content: [{ type: 'text', text: 'multimodal' }] },
      ]
      const result = convertToOpenAIMessages(messages, 'Be concise')
      expect(result).toHaveLength(4)
      expect(result[0].role).toBe('system')
      expect(result[1].content).toBe('text message')
      expect(result[3].content).toEqual([{ type: 'text', text: 'multimodal' }])
    })

    it('returns empty array for empty messages without system prompt', () => {
      const result = convertToOpenAIMessages([])
      expect(result).toEqual([])
    })

    it('returns only system message for empty messages with system prompt', () => {
      const result = convertToOpenAIMessages([], 'system')
      expect(result).toEqual([{ role: 'system', content: 'system' }])
    })
  })
})
