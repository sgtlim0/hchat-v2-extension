import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  exportConversation,
  downloadBlob,
  copyConversationAsMarkdown,
  type ExportOptions,
} from '../exportChat'
import type { Conversation } from '../chatHistory'

describe('exportChat', () => {
  const mockConversation: Conversation = {
    id: 'test-conv-1',
    title: 'Test Conversation',
    model: 'gpt-4o',
    messages: [
      {
        id: '1',
        role: 'user',
        content: 'Hello, how are you?',
        ts: 1704067200000, // 2024-01-01 00:00:00
        streaming: false,
      },
      {
        id: '2',
        role: 'assistant',
        content: 'I am doing well, thank you!',
        ts: 1704067205000,
        streaming: false,
      },
      {
        id: '3',
        role: 'user',
        content: 'Can you help me with code?',
        ts: 1704067210000,
        streaming: false,
      },
      {
        id: '4',
        role: 'assistant',
        content: 'Currently streaming...',
        ts: 1704067215000,
        streaming: true, // Should be filtered out
      },
    ],
    createdAt: 1704067200000,
    updatedAt: 1704067215000,
  }

  describe('exportConversation - Markdown format', () => {
    it('exports conversation to markdown', async () => {
      const blob = exportConversation({
        format: 'markdown',
        conversation: mockConversation,
      })

      const text = await blob.text()
      expect(text).toContain('# Test Conversation')
      expect(text).toContain('### User')
      expect(text).toContain('### Assistant')
      expect(text).toContain('Hello, how are you?')
      expect(text).toContain('I am doing well, thank you!')
    })

    it('excludes streaming messages', async () => {
      const blob = exportConversation({
        format: 'markdown',
        conversation: mockConversation,
      })

      const text = await blob.text()
      expect(text).not.toContain('Currently streaming...')
    })

    it('includes timestamps when requested', async () => {
      const blob = exportConversation({
        format: 'markdown',
        conversation: mockConversation,
        includeTimestamps: true,
      })

      const text = await blob.text()
      expect(text).toMatch(/### User \(.*\)/)
      expect(text).toMatch(/### Assistant \(.*\)/)
    })

    it('includes model info when requested', async () => {
      const blob = exportConversation({
        format: 'markdown',
        conversation: mockConversation,
        includeModelInfo: true,
      })

      const text = await blob.text()
      expect(text).toContain('> Model: gpt-4o')
      expect(text).toContain('Created:')
    })

    it('returns blob with correct MIME type', () => {
      const blob = exportConversation({
        format: 'markdown',
        conversation: mockConversation,
      })

      expect(blob.type).toBe('text/markdown;charset=utf-8')
    })
  })

  describe('exportConversation - HTML format', () => {
    it('exports conversation to HTML', async () => {
      const blob = exportConversation({
        format: 'html',
        conversation: mockConversation,
      })

      const text = await blob.text()
      expect(text).toContain('<!DOCTYPE html>')
      expect(text).toContain('<html lang="ko">')
      expect(text).toContain('<title>Test Conversation</title>')
      expect(text).toContain('Hello, how are you?')
    })

    it('escapes HTML entities', async () => {
      const htmlConv: Conversation = {
        ...mockConversation,
        messages: [
          {
            id: '1',
            role: 'user',
            content: '<script>alert("xss")</script> & < >',
            ts: Date.now(),
            streaming: false,
          },
        ],
      }

      const blob = exportConversation({
        format: 'html',
        conversation: htmlConv,
      })

      const text = await blob.text()
      expect(text).toContain('&lt;script&gt;')
      expect(text).toContain('&amp;')
      expect(text).toContain('&lt;')
      expect(text).toContain('&gt;')
      expect(text).not.toContain('<script>alert')
    })

    it('converts newlines to <br> tags', async () => {
      const multilineConv: Conversation = {
        ...mockConversation,
        messages: [
          {
            id: '1',
            role: 'user',
            content: 'Line 1\nLine 2\nLine 3',
            ts: Date.now(),
            streaming: false,
          },
        ],
      }

      const blob = exportConversation({
        format: 'html',
        conversation: multilineConv,
      })

      const text = await blob.text()
      expect(text).toContain('Line 1<br>Line 2<br>Line 3')
    })

    it('applies correct CSS classes', async () => {
      const blob = exportConversation({
        format: 'html',
        conversation: mockConversation,
      })

      const text = await blob.text()
      expect(text).toContain('class="msg msg-user"')
      expect(text).toContain('class="msg msg-ai"')
    })

    it('returns blob with correct MIME type', () => {
      const blob = exportConversation({
        format: 'html',
        conversation: mockConversation,
      })

      expect(blob.type).toBe('text/html;charset=utf-8')
    })
  })

  describe('exportConversation - JSON format', () => {
    it('exports conversation to JSON', async () => {
      const blob = exportConversation({
        format: 'json',
        conversation: mockConversation,
      })

      const text = await blob.text()
      const data = JSON.parse(text)

      expect(data).toHaveProperty('exportedAt')
      expect(data.version).toBe('2.0')
      expect(data.conversation.id).toBe('test-conv-1')
      expect(data.conversation.title).toBe('Test Conversation')
    })

    it('excludes streaming messages in JSON export', async () => {
      const blob = exportConversation({
        format: 'json',
        conversation: mockConversation,
      })

      const text = await blob.text()
      const data = JSON.parse(text)

      expect(data.conversation.messages).toHaveLength(3)
      expect(data.conversation.messages.every((m: { streaming: boolean }) => !m.streaming)).toBe(true)
    })

    it('preserves message structure', async () => {
      const blob = exportConversation({
        format: 'json',
        conversation: mockConversation,
      })

      const text = await blob.text()
      const data = JSON.parse(text)
      const msg = data.conversation.messages[0]

      expect(msg).toHaveProperty('id')
      expect(msg).toHaveProperty('role')
      expect(msg).toHaveProperty('content')
      expect(msg).toHaveProperty('ts')
    })

    it('returns blob with correct MIME type', () => {
      const blob = exportConversation({
        format: 'json',
        conversation: mockConversation,
      })

      expect(blob.type).toBe('application/json;charset=utf-8')
    })

    it('formats JSON with indentation', async () => {
      const blob = exportConversation({
        format: 'json',
        conversation: mockConversation,
      })

      const text = await blob.text()
      // Check for indentation (2 spaces)
      expect(text).toContain('  "exportedAt"')
      expect(text).toContain('  "version"')
    })
  })

  describe('exportConversation - TXT format', () => {
    it('exports conversation to plain text', async () => {
      const blob = exportConversation({
        format: 'txt',
        conversation: mockConversation,
      })

      const text = await blob.text()
      expect(text).toContain('Test Conversation')
      expect(text).toContain('========================================')
      expect(text).toContain('[User]')
      expect(text).toContain('[Assistant]')
      expect(text).toContain('Hello, how are you?')
    })

    it('separates messages with horizontal rules', async () => {
      const blob = exportConversation({
        format: 'txt',
        conversation: mockConversation,
      })

      const text = await blob.text()
      expect(text).toContain('---')
    })

    it('excludes streaming messages', async () => {
      const blob = exportConversation({
        format: 'txt',
        conversation: mockConversation,
      })

      const text = await blob.text()
      expect(text).not.toContain('Currently streaming...')
    })

    it('returns blob with correct MIME type', () => {
      const blob = exportConversation({
        format: 'txt',
        conversation: mockConversation,
      })

      expect(blob.type).toBe('text/plain;charset=utf-8')
    })
  })

  describe('downloadBlob', () => {
    let createElementSpy: ReturnType<typeof vi.spyOn>
    let createObjectURLSpy: ReturnType<typeof vi.spyOn>
    let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>
    let mockAnchor: HTMLAnchorElement

    beforeEach(() => {
      mockAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
      } as unknown as HTMLAnchorElement

      createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor)
      createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
      revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    })

    afterEach(() => {
      createElementSpy.mockRestore()
      createObjectURLSpy.mockRestore()
      revokeObjectURLSpy.mockRestore()
    })

    it('creates object URL from blob', () => {
      const blob = new Blob(['test'], { type: 'text/plain' })
      downloadBlob(blob, 'test.txt')

      expect(createObjectURLSpy).toHaveBeenCalledWith(blob)
    })

    it('sets correct download filename', () => {
      const blob = new Blob(['test'], { type: 'text/plain' })
      downloadBlob(blob, 'my-file.txt')

      expect(mockAnchor.download).toBe('my-file.txt')
    })

    it('triggers download click', () => {
      const blob = new Blob(['test'], { type: 'text/plain' })
      downloadBlob(blob, 'test.txt')

      expect(mockAnchor.click).toHaveBeenCalled()
    })

    it('revokes object URL after download', () => {
      const blob = new Blob(['test'], { type: 'text/plain' })
      downloadBlob(blob, 'test.txt')

      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url')
    })
  })

  describe('copyConversationAsMarkdown', () => {
    let writeTextSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      // Mock navigator.clipboard
      if (!navigator.clipboard) {
        Object.defineProperty(navigator, 'clipboard', {
          value: { writeText: vi.fn().mockResolvedValue(undefined) },
          writable: true,
        })
      }
      writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
    })

    afterEach(() => {
      if (writeTextSpy) {
        writeTextSpy.mockRestore()
      }
    })

    it('copies conversation as markdown to clipboard', async () => {
      await copyConversationAsMarkdown(mockConversation)

      expect(writeTextSpy).toHaveBeenCalledWith(expect.stringContaining('# Test Conversation'))
    })

    it('excludes timestamps by default', async () => {
      await copyConversationAsMarkdown(mockConversation)

      const [[copiedText]] = writeTextSpy.mock.calls
      expect(copiedText).not.toMatch(/### User \(.*\)/)
    })

    it('includes all non-streaming messages', async () => {
      await copyConversationAsMarkdown(mockConversation)

      const [[copiedText]] = writeTextSpy.mock.calls
      expect(copiedText).toContain('Hello, how are you?')
      expect(copiedText).toContain('I am doing well, thank you!')
      expect(copiedText).toContain('Can you help me with code?')
      expect(copiedText).not.toContain('Currently streaming...')
    })
  })

  describe('empty messages handling', () => {
    const emptyConv: Conversation = {
      ...mockConversation,
      messages: [],
    }

    it('handles empty messages in markdown', async () => {
      const blob = exportConversation({
        format: 'markdown',
        conversation: emptyConv,
      })

      const text = await blob.text()
      expect(text).toContain('# Test Conversation')
      expect(text).toBeDefined()
    })

    it('handles empty messages in HTML', async () => {
      const blob = exportConversation({
        format: 'html',
        conversation: emptyConv,
      })

      const text = await blob.text()
      expect(text).toContain('<!DOCTYPE html>')
      expect(text).toBeDefined()
    })

    it('handles empty messages in JSON', async () => {
      const blob = exportConversation({
        format: 'json',
        conversation: emptyConv,
      })

      const text = await blob.text()
      const data = JSON.parse(text)
      expect(data.conversation.messages).toEqual([])
    })

    it('handles empty messages in TXT', async () => {
      const blob = exportConversation({
        format: 'txt',
        conversation: emptyConv,
      })

      const text = await blob.text()
      expect(text).toContain('Test Conversation')
      expect(text).toBeDefined()
    })
  })
})
