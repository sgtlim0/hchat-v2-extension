import { describe, it, expect, vi } from 'vitest'

vi.mock('../../i18n', () => ({
  t: vi.fn((key: string) => {
    const map: Record<string, string> = {
      'aiPrompts.newConversation': '새 대화',
      'chat.forkSuffix': '(분기)',
    }
    return map[key] ?? key
  }),
}))

import { ChatHistory } from '../chatHistory'

describe('ChatHistory branch coverage', () => {
  describe('updateLastMessage', () => {
    it('is no-op for non-existent conversation', async () => {
      await ChatHistory.updateLastMessage('non-existent', { content: 'nope' })
      // should not throw
    })
  })

  describe('pin', () => {
    it('is no-op for non-existent id in index', async () => {
      await ChatHistory.pin('non-existent', true)
      const idx = await ChatHistory.listIndex()
      expect(idx).toHaveLength(0)
    })
  })

  describe('setTags', () => {
    it('is no-op for non-existent conversation', async () => {
      await ChatHistory.setTags('non-existent', ['tag1'])
      // should not throw
    })

    it('is no-op when conv exists but not in index', async () => {
      const conv = await ChatHistory.create('m')
      // Clear index manually
      await chrome.storage.local.set({ 'hchat:conv-index': [] })
      await ChatHistory.setTags(conv.id, ['tag'])
      const fetched = await ChatHistory.get(conv.id)
      expect(fetched!.tags).toEqual(['tag'])
    })
  })

  describe('addTag', () => {
    it('is no-op for non-existent conversation', async () => {
      await ChatHistory.addTag('non-existent', 'tag')
      // should not throw
    })
  })

  describe('removeTag', () => {
    it('is no-op for non-existent conversation', async () => {
      await ChatHistory.removeTag('non-existent', 'tag')
      // should not throw
    })

    it('handles removing non-existent tag', async () => {
      const conv = await ChatHistory.create('m')
      await ChatHistory.setTags(conv.id, ['a', 'b'])
      await ChatHistory.removeTag(conv.id, 'x')
      const updated = await ChatHistory.get(conv.id)
      expect(updated!.tags).toEqual(['a', 'b'])
    })
  })

  describe('setFolder', () => {
    it('is no-op for non-existent conversation', async () => {
      await ChatHistory.setFolder('non-existent', 'folder-1')
      // should not throw
    })

    it('sets folder on conversation and updates index', async () => {
      const conv = await ChatHistory.create('m')
      await ChatHistory.setFolder(conv.id, 'folder-1')
      const fetched = await ChatHistory.get(conv.id)
      expect(fetched!.folderId).toBe('folder-1')
      const idx = await ChatHistory.listIndex()
      expect(idx[0].folderId).toBe('folder-1')
    })

    it('clears folder with undefined', async () => {
      const conv = await ChatHistory.create('m')
      await ChatHistory.setFolder(conv.id, 'folder-1')
      await ChatHistory.setFolder(conv.id, undefined)
      const fetched = await ChatHistory.get(conv.id)
      expect(fetched!.folderId).toBeUndefined()
    })

    it('is no-op when conv exists but not in index', async () => {
      const conv = await ChatHistory.create('m')
      await chrome.storage.local.set({ 'hchat:conv-index': [] })
      await ChatHistory.setFolder(conv.id, 'f1')
      const fetched = await ChatHistory.get(conv.id)
      expect(fetched!.folderId).toBe('f1')
    })
  })

  describe('setPersona', () => {
    it('is no-op for non-existent conversation', async () => {
      await ChatHistory.setPersona('non-existent', 'persona-1')
      // should not throw
    })
  })

  describe('updateMessage', () => {
    it('is no-op for non-existent conversation', async () => {
      await ChatHistory.updateMessage('non-existent', 'msg-1', 'content')
      // should not throw
    })

    it('is no-op for non-existent message id', async () => {
      const conv = await ChatHistory.create('m')
      await ChatHistory.addMessage(conv.id, { role: 'user', content: 'test' })
      await ChatHistory.updateMessage(conv.id, 'non-existent', 'new content')
      const fetched = await ChatHistory.get(conv.id)
      expect(fetched!.messages[0].content).toBe('test')
    })
  })

  describe('truncateAfter', () => {
    it('returns empty array for non-existent conversation', async () => {
      const result = await ChatHistory.truncateAfter('non-existent', 'msg-1')
      expect(result).toEqual([])
    })

    it('returns all messages when msgId not found', async () => {
      const conv = await ChatHistory.create('m')
      await ChatHistory.addMessage(conv.id, { role: 'user', content: 'q1' })
      const result = await ChatHistory.truncateAfter(conv.id, 'non-existent')
      expect(result).toHaveLength(1)
    })
  })

  describe('toggleMessagePin', () => {
    it('returns false for non-existent conversation', async () => {
      expect(await ChatHistory.toggleMessagePin('non-existent', 'msg-1')).toBe(false)
    })

    it('returns false for non-existent message', async () => {
      const conv = await ChatHistory.create('m')
      expect(await ChatHistory.toggleMessagePin(conv.id, 'non-existent')).toBe(false)
    })
  })

  describe('getPinnedMessages', () => {
    it('returns empty for non-existent conversation', async () => {
      expect(await ChatHistory.getPinnedMessages('non-existent')).toEqual([])
    })
  })

  describe('fork', () => {
    it('preserves tags from source', async () => {
      const conv = await ChatHistory.create('m')
      await ChatHistory.setTags(conv.id, ['important'])
      const msg = await ChatHistory.addMessage(conv.id, { role: 'user', content: 'q1' })
      const forked = await ChatHistory.fork(conv.id, msg.id)
      expect(forked!.tags).toEqual(['important'])
    })

    it('preserves personaId from source', async () => {
      const conv = await ChatHistory.create('m')
      await ChatHistory.setPersona(conv.id, 'persona-1')
      const msg = await ChatHistory.addMessage(conv.id, { role: 'user', content: 'q1' })
      const forked = await ChatHistory.fork(conv.id, msg.id)
      expect(forked!.personaId).toBe('persona-1')
    })
  })

  describe('addMessage auto-title', () => {
    it('auto-titles with "New conversation" (English)', async () => {
      const conv = await ChatHistory.create('m')
      // Manually set English title
      const fetched = await ChatHistory.get(conv.id)
      fetched!.title = 'New conversation'
      await chrome.storage.local.set({ [`hchat:conv:${conv.id}`]: fetched })

      await ChatHistory.addMessage(conv.id, { role: 'user', content: 'A long question here' })
      await ChatHistory.addMessage(conv.id, { role: 'assistant', content: 'Answer' })

      const updated = await ChatHistory.get(conv.id)
      expect(updated!.title).toBe('A long question here'.slice(0, 40))
    })

    it('does not auto-title when fewer than 2 messages', async () => {
      const conv = await ChatHistory.create('m')
      await ChatHistory.addMessage(conv.id, { role: 'user', content: 'Question' })
      const updated = await ChatHistory.get(conv.id)
      expect(updated!.title).toBe('새 대화')
    })
  })

  describe('_updateIndex', () => {
    it('handles conversation not in index gracefully', async () => {
      const conv = await ChatHistory.create('m')
      // Clear index
      await chrome.storage.local.set({ 'hchat:conv-index': [] })
      // Add message triggers _updateIndex
      await ChatHistory.addMessage(conv.id, { role: 'user', content: 'test' })
      // Should not throw
    })
  })
})
