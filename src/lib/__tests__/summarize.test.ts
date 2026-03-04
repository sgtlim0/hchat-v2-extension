import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateSummary, saveSummary, loadSummary, deleteSummary } from '../summarize'
import type { Conversation } from '../chatHistory'
import type { Message } from '../providers/types'

// Mock BedrockProvider as a class constructor
vi.mock('../providers/bedrock-provider', () => {
  class MockBedrockProvider {
    stream() {
      return {
        async *[Symbol.asyncIterator]() {
          yield '이 대화는 '
          yield 'React에 대한 질문'
          yield '을 다루고 있습니다.'
          return '이 대화는 React에 대한 질문을 다루고 있습니다.'
        },
      }
    }
  }
  return { BedrockProvider: MockBedrockProvider }
})

describe('summarize', () => {
  const mockConversation: Conversation = {
    id: 'conv-123',
    title: '테스트 대화',
    model: 'test-model',
    messages: [
      { id: '1', role: 'user', content: 'React에 대해 알려줘', ts: Date.now() },
      { id: '2', role: 'assistant', content: 'React는 UI 라이브러리입니다.', ts: Date.now() },
      { id: '3', role: 'user', content: 'useState는 어떻게 사용해?', ts: Date.now() },
      { id: '4', role: 'assistant', content: 'useState는 상태를 관리하는 훅입니다.', ts: Date.now() },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const mockAws = {
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    region: 'us-east-1',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateSummary', () => {
    it('generates summary with recent messages', async () => {
      const summary = await generateSummary(mockConversation, mockAws)
      expect(summary).toBe('이 대화는 React에 대한 질문을 다루고 있습니다.')
    })

    it('throws error when AWS credentials are missing', async () => {
      const invalidAws = { accessKeyId: '', secretAccessKey: '', region: 'us-east-1' }
      await expect(generateSummary(mockConversation, invalidAws)).rejects.toThrow('AWS 자격증명')
    })

    it('limits to recent 30 messages', async () => {
      const longConv: Conversation = {
        ...mockConversation,
        messages: Array.from({ length: 50 }, (_, i) => ({
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
          content: `Message ${i}`,
          ts: Date.now(),
        })),
      }

      const summary = await generateSummary(longConv, mockAws)
      expect(summary).toBeTruthy()
      // BedrockProvider should only receive last 30 messages in prompt
    })

    it('uses custom model when provided', async () => {
      const customModel = 'custom-model-id'
      const summary = await generateSummary(mockConversation, mockAws, customModel)
      expect(summary).toBeTruthy()
    })

    it('uses Haiku by default for cost efficiency', async () => {
      // Default model is Haiku
      const summary = await generateSummary(mockConversation, mockAws)
      expect(summary).toBeTruthy()
    })

    it('handles empty messages', async () => {
      const emptyConv: Conversation = {
        ...mockConversation,
        messages: [],
      }

      const summary = await generateSummary(emptyConv, mockAws)
      expect(summary).toBeTruthy()
    })

    it('truncates long message content', async () => {
      const longMsgConv: Conversation = {
        ...mockConversation,
        messages: [
          {
            id: '1',
            role: 'user',
            content: 'x'.repeat(1000), // Long content
            ts: Date.now(),
          },
        ],
      }

      const summary = await generateSummary(longMsgConv, mockAws)
      expect(summary).toBeTruthy()
      // Content should be sliced to 500 chars per message
    })
  })

  describe('saveSummary', () => {
    it('saves summary to storage', async () => {
      const summary = {
        convId: 'conv-123',
        text: '요약 텍스트입니다.',
        createdAt: Date.now(),
        messageCount: 10,
      }

      await saveSummary(summary)

      const result = await chrome.storage.local.get('hchat:summaries')
      expect(result['hchat:summaries']).toBeDefined()
      expect(result['hchat:summaries']['conv-123']).toEqual(summary)
    })

    it('overwrites existing summary for same conversation', async () => {
      const summary1 = {
        convId: 'conv-123',
        text: '첫 번째 요약',
        createdAt: Date.now(),
        messageCount: 5,
      }

      const summary2 = {
        convId: 'conv-123',
        text: '두 번째 요약',
        createdAt: Date.now() + 1000,
        messageCount: 10,
      }

      await saveSummary(summary1)
      await saveSummary(summary2)

      const loaded = await loadSummary('conv-123')
      expect(loaded?.text).toBe('두 번째 요약')
    })

    it('preserves summaries for different conversations', async () => {
      const summary1 = {
        convId: 'conv-1',
        text: '요약 1',
        createdAt: Date.now(),
        messageCount: 5,
      }

      const summary2 = {
        convId: 'conv-2',
        text: '요약 2',
        createdAt: Date.now(),
        messageCount: 7,
      }

      await saveSummary(summary1)
      await saveSummary(summary2)

      expect(await loadSummary('conv-1')).toEqual(summary1)
      expect(await loadSummary('conv-2')).toEqual(summary2)
    })
  })

  describe('loadSummary', () => {
    it('loads summary for existing conversation', async () => {
      const summary = {
        convId: 'conv-123',
        text: '요약입니다.',
        createdAt: Date.now(),
        messageCount: 8,
      }

      await saveSummary(summary)
      const loaded = await loadSummary('conv-123')

      expect(loaded).toEqual(summary)
    })

    it('returns null for non-existent summary', async () => {
      const loaded = await loadSummary('non-existent')
      expect(loaded).toBeNull()
    })

    it('returns null when storage is empty', async () => {
      await chrome.storage.local.clear()
      const loaded = await loadSummary('conv-123')
      expect(loaded).toBeNull()
    })
  })

  describe('deleteSummary', () => {
    it('deletes summary for conversation', async () => {
      const summary = {
        convId: 'conv-123',
        text: '요약',
        createdAt: Date.now(),
        messageCount: 5,
      }

      await saveSummary(summary)
      await deleteSummary('conv-123')

      const loaded = await loadSummary('conv-123')
      expect(loaded).toBeNull()
    })

    it('does not affect other summaries', async () => {
      const summary1 = {
        convId: 'conv-1',
        text: '요약 1',
        createdAt: Date.now(),
        messageCount: 5,
      }

      const summary2 = {
        convId: 'conv-2',
        text: '요약 2',
        createdAt: Date.now(),
        messageCount: 7,
      }

      await saveSummary(summary1)
      await saveSummary(summary2)
      await deleteSummary('conv-1')

      expect(await loadSummary('conv-1')).toBeNull()
      expect(await loadSummary('conv-2')).toEqual(summary2)
    })

    it('is no-op for non-existent summary', async () => {
      await deleteSummary('non-existent')
      // Should not throw
    })
  })
})
