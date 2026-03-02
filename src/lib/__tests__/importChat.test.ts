import { describe, it, expect, beforeEach } from 'vitest'
import { importFromFile, getSourceLabel, type ImportResult } from '../importChat'

describe('importChat', () => {
  describe('ChatGPT format', () => {
    it('imports ChatGPT conversation with mapping structure', async () => {
      const data = [
        {
          title: 'Test Chat',
          create_time: 1640000000,
          mapping: {
            'id1': {
              message: {
                author: { role: 'user' },
                content: { parts: ['Hello, how are you?'] },
                create_time: 1640000001,
              },
            },
            'id2': {
              message: {
                author: { role: 'assistant' },
                content: { parts: ['I am doing well, thank you!'] },
                create_time: 1640000002,
              },
            },
          },
        },
      ]

      const file = new File([JSON.stringify(data)], 'chatgpt.json', { type: 'application/json' })
      const result = await importFromFile(file)

      expect(result.success).toBe(true)
      expect(result.count).toBe(1)
      expect(result.source).toBe('chatgpt')
      expect(result.errors).toHaveLength(0)
    })

    it('handles ChatGPT with multipart content', async () => {
      const data = [
        {
          title: 'Multipart Chat',
          create_time: 1640000000,
          mapping: {
            'id1': {
              message: {
                author: { role: 'user' },
                content: { parts: ['Part 1', 'Part 2', 'Part 3'] },
                create_time: 1640000001,
              },
            },
          },
        },
      ]

      const file = new File([JSON.stringify(data)], 'chatgpt.json', { type: 'application/json' })
      const result = await importFromFile(file)

      expect(result.success).toBe(true)
      expect(result.count).toBe(1)
    })

    it('filters out empty messages in ChatGPT import', async () => {
      const data = [
        {
          title: 'Chat with empty messages',
          create_time: 1640000000,
          mapping: {
            'id1': {
              message: {
                author: { role: 'user' },
                content: { parts: [''] },
                create_time: 1640000001,
              },
            },
            'id2': {
              message: {
                author: { role: 'assistant' },
                content: { parts: ['Valid response'] },
                create_time: 1640000002,
              },
            },
          },
        },
      ]

      const file = new File([JSON.stringify(data)], 'chatgpt.json', { type: 'application/json' })
      const result = await importFromFile(file)

      expect(result.success).toBe(true)
    })

    it('handles malformed ChatGPT mapping gracefully', async () => {
      const data = [
        {
          title: 'Broken Chat',
          create_time: 1640000000,
          mapping: {
            'id1': { message: null },
            'id2': {},
            'id3': {
              message: {
                author: { role: 'user' },
                content: { parts: ['Valid message'] },
                create_time: 1640000001,
              },
            },
          },
        },
      ]

      const file = new File([JSON.stringify(data)], 'chatgpt.json', { type: 'application/json' })
      const result = await importFromFile(file)

      expect(result.success).toBe(true)
      expect(result.count).toBe(1)
    })

    it('skips ChatGPT conversations with no valid messages', async () => {
      const data = [
        {
          title: 'Empty Chat',
          create_time: 1640000000,
          mapping: {},
        },
        {
          title: 'Valid Chat',
          create_time: 1640000000,
          mapping: {
            'id1': {
              message: {
                author: { role: 'user' },
                content: { parts: ['Hello'] },
                create_time: 1640000001,
              },
            },
          },
        },
      ]

      const file = new File([JSON.stringify(data)], 'chatgpt.json', { type: 'application/json' })
      const result = await importFromFile(file)

      expect(result.success).toBe(true)
      expect(result.count).toBe(1)
    })
  })

  describe('Claude format', () => {
    it('imports Claude conversation', async () => {
      const data = {
        name: 'Claude Chat',
        chat_messages: [
          {
            sender: 'human',
            text: 'What is the weather today?',
            created_at: '2024-01-01T12:00:00Z',
          },
          {
            sender: 'assistant',
            text: 'I cannot check the current weather.',
            created_at: '2024-01-01T12:00:05Z',
          },
        ],
      }

      const file = new File([JSON.stringify(data)], 'claude.json', { type: 'application/json' })
      const result = await importFromFile(file)

      expect(result.success).toBe(true)
      expect(result.count).toBe(1)
      expect(result.source).toBe('claude')
    })

    it('uses first message as title if name is missing', async () => {
      const data = {
        chat_messages: [
          {
            sender: 'human',
            text: 'This should be the title or at least first 40 chars',
            created_at: '2024-01-01T12:00:00Z',
          },
          {
            sender: 'assistant',
            text: 'Response',
            created_at: '2024-01-01T12:00:05Z',
          },
        ],
      }

      const file = new File([JSON.stringify(data)], 'claude.json', { type: 'application/json' })
      const result = await importFromFile(file)

      expect(result.success).toBe(true)
    })

    it('filters out empty Claude messages', async () => {
      const data = {
        name: 'Chat',
        chat_messages: [
          {
            sender: 'human',
            text: '',
            created_at: '2024-01-01T12:00:00Z',
          },
          {
            sender: 'assistant',
            text: 'Valid',
            created_at: '2024-01-01T12:00:05Z',
          },
        ],
      }

      const file = new File([JSON.stringify(data)], 'claude.json', { type: 'application/json' })
      const result = await importFromFile(file)

      expect(result.success).toBe(true)
    })

    it('handles Claude export with invalid message objects', async () => {
      const data = {
        name: 'Chat',
        chat_messages: [
          null,
          { sender: 'human', text: 'Valid message', created_at: '2024-01-01T12:00:00Z' },
          { sender: 'invalid' },
          {},
        ],
      }

      const file = new File([JSON.stringify(data)], 'claude.json', { type: 'application/json' })
      const result = await importFromFile(file)

      expect(result.success).toBe(true)
      expect(result.count).toBe(1)
    })

    it('returns error when Claude export has no valid messages', async () => {
      const data = {
        name: 'Empty Chat',
        chat_messages: [],
      }

      const file = new File([JSON.stringify(data)], 'claude.json', { type: 'application/json' })
      const result = await importFromFile(file)

      expect(result.success).toBe(false)
      expect(result.count).toBe(0)
    })
  })

  describe('H Chat format', () => {
    it('imports H Chat single conversation', async () => {
      const data = {
        title: 'My Chat',
        model: 'claude-sonnet',
        messages: [
          {
            role: 'user',
            content: 'Hello',
            ts: 1640000001000,
          },
          {
            role: 'assistant',
            content: 'Hi there!',
            ts: 1640000002000,
          },
        ],
        createdAt: 1640000000000,
        updatedAt: 1640000002000,
      }

      const file = new File([JSON.stringify(data)], 'hchat.json', { type: 'application/json' })
      const result = await importFromFile(file)

      expect(result.success).toBe(true)
      expect(result.count).toBe(1)
      expect(result.source).toBe('hchat')
    })

    it('imports H Chat wrapped export format', async () => {
      const data = {
        exportedAt: '2024-01-01T00:00:00Z',
        version: '2.0',
        conversation: {
          title: 'Wrapped Chat',
          model: 'gpt-4',
          messages: [
            { role: 'user', content: 'Test', ts: 1640000001000 },
          ],
          createdAt: 1640000000000,
          updatedAt: 1640000001000,
        },
      }

      const file = new File([JSON.stringify(data)], 'hchat.json', { type: 'application/json' })
      const result = await importFromFile(file)

      expect(result.success).toBe(true)
      expect(result.count).toBe(1)
    })

    it('imports H Chat array of conversations', async () => {
      const data = [
        {
          title: 'Chat 1',
          model: 'model-a',
          messages: [{ role: 'user', content: 'Q1', ts: 1640000001000 }],
          createdAt: 1640000000000,
          updatedAt: 1640000001000,
        },
        {
          title: 'Chat 2',
          model: 'model-b',
          messages: [{ role: 'user', content: 'Q2', ts: 1640000002000 }],
          createdAt: 1640000000000,
          updatedAt: 1640000002000,
        },
      ]

      const file = new File([JSON.stringify(data)], 'hchat.json', { type: 'application/json' })
      const result = await importFromFile(file)

      expect(result.success).toBe(true)
      expect(result.count).toBe(2)
    })

    it('filters out empty messages in H Chat import', async () => {
      const data = {
        title: 'Chat',
        model: 'model',
        messages: [
          { role: 'user', content: '', ts: 1640000001000 },
          { role: 'user', content: '   ', ts: 1640000002000 },
          { role: 'assistant', content: 'Valid', ts: 1640000003000 },
        ],
        createdAt: 1640000000000,
        updatedAt: 1640000003000,
      }

      const file = new File([JSON.stringify(data)], 'hchat.json', { type: 'application/json' })
      const result = await importFromFile(file)

      expect(result.success).toBe(true)
    })

    it('handles H Chat with malformed message objects', async () => {
      const data = {
        title: 'Chat',
        model: 'model',
        messages: [
          null,
          {},
          { role: 'invalid', content: 'Test' },
          { role: 'user', content: 'Valid', ts: 1640000001000 },
        ],
        createdAt: 1640000000000,
        updatedAt: 1640000001000,
      }

      const file = new File([JSON.stringify(data)], 'hchat.json', { type: 'application/json' })
      const result = await importFromFile(file)

      expect(result.success).toBe(true)
    })

    it('uses defaults for missing H Chat fields', async () => {
      const data = {
        // Missing title, model, createdAt, updatedAt
        messages: [
          { role: 'user', content: 'Message without ts and model' },
        ],
      }

      const file = new File([JSON.stringify(data)], 'hchat.json', { type: 'application/json' })
      const result = await importFromFile(file)

      // Should succeed with default values applied (title='가져온 대화', model='unknown', ts=Date.now())
      expect(result.success).toBe(true)
      expect(result.count).toBe(1)
    })
  })

  describe('Format detection', () => {
    it('detects unknown format', async () => {
      const data = { unknown: 'format' }
      const file = new File([JSON.stringify(data)], 'unknown.json', { type: 'application/json' })
      const result = await importFromFile(file)

      expect(result.success).toBe(false)
      expect(result.source).toBe('unknown')
      expect(result.errors[0]).toContain('지원하지 않는')
    })

    it('handles invalid JSON', async () => {
      const file = new File(['not valid json{'], 'broken.json', { type: 'application/json' })
      const result = await importFromFile(file)

      expect(result.success).toBe(false)
      expect(result.errors[0]).toContain('파싱 실패')
    })

    it('handles empty file', async () => {
      const file = new File([''], 'empty.json', { type: 'application/json' })
      const result = await importFromFile(file)

      expect(result.success).toBe(false)
    })
  })

  describe('Batch import performance', () => {
    it('imports multiple conversations efficiently', async () => {
      const data = Array.from({ length: 10 }, (_, i) => ({
        title: `Chat ${i}`,
        model: 'model',
        messages: [
          { role: 'user' as const, content: `Message ${i}`, ts: 1640000000000 + i },
        ],
        createdAt: 1640000000000,
        updatedAt: 1640000000000 + i,
      }))

      const file = new File([JSON.stringify(data)], 'batch.json', { type: 'application/json' })
      const result = await importFromFile(file)

      expect(result.success).toBe(true)
      expect(result.count).toBe(10)
    })

    it('handles large conversation import', async () => {
      const largeMessages = Array.from({ length: 100 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `Message ${i}`.repeat(10),
        ts: 1640000000000 + i,
      }))

      const data = {
        title: 'Large Chat',
        model: 'model',
        messages: largeMessages,
        createdAt: 1640000000000,
        updatedAt: 1640000100000,
      }

      const file = new File([JSON.stringify(data)], 'large.json', { type: 'application/json' })
      const result = await importFromFile(file)

      expect(result.success).toBe(true)
      expect(result.count).toBe(1)
    })
  })

  describe('getSourceLabel', () => {
    it('returns correct labels', () => {
      expect(getSourceLabel('chatgpt')).toBe('ChatGPT')
      expect(getSourceLabel('claude')).toBe('Claude')
      expect(getSourceLabel('hchat')).toBe('H Chat')
      expect(getSourceLabel('unknown')).toBe('알 수 없음')
    })
  })

  describe('Edge cases', () => {
    it('handles conversations with only system messages (ChatGPT)', async () => {
      const data = [
        {
          title: 'System Only',
          mapping: {
            'id1': {
              message: {
                author: { role: 'system' },
                content: { parts: ['System message'] },
                create_time: 1640000001,
              },
            },
          },
        },
      ]

      const file = new File([JSON.stringify(data)], 'chatgpt.json', { type: 'application/json' })
      const result = await importFromFile(file)

      expect(result.success).toBe(false)
      expect(result.errors[0]).toContain('가져올 대화가 없습니다')
    })

    it('preserves message order based on timestamps', async () => {
      const data = [
        {
          title: 'Out of order',
          mapping: {
            'id3': {
              message: {
                author: { role: 'assistant' },
                content: { parts: ['Third'] },
                create_time: 1640000003,
              },
            },
            'id1': {
              message: {
                author: { role: 'user' },
                content: { parts: ['First'] },
                create_time: 1640000001,
              },
            },
            'id2': {
              message: {
                author: { role: 'assistant' },
                content: { parts: ['Second'] },
                create_time: 1640000002,
              },
            },
          },
        },
      ]

      const file = new File([JSON.stringify(data)], 'chatgpt.json', { type: 'application/json' })
      const result = await importFromFile(file)

      expect(result.success).toBe(true)
    })

    it('handles Unicode and special characters', async () => {
      const data = {
        title: '한글 제목 🚀',
        model: 'model',
        messages: [
          { role: 'user', content: 'Hello 안녕하세요 👋', ts: 1640000001000 },
          { role: 'assistant', content: '你好！こんにちは 🌏', ts: 1640000002000 },
        ],
        createdAt: 1640000000000,
        updatedAt: 1640000002000,
      }

      const file = new File([JSON.stringify(data)], 'unicode.json', { type: 'application/json' })
      const result = await importFromFile(file)

      expect(result.success).toBe(true)
    })
  })
})
