import { describe, it, expect, vi, beforeEach } from 'vitest'

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

describe('ChatHistory', () => {
  describe('create', () => {
    it('creates a conversation with default title', async () => {
      const conv = await ChatHistory.create('claude-sonnet')
      expect(conv.id).toBeTruthy()
      expect(conv.title).toBe('새 대화')
      expect(conv.model).toBe('claude-sonnet')
      expect(conv.messages).toEqual([])
      expect(conv.createdAt).toBeGreaterThan(0)
    })

    it('adds conversation to index', async () => {
      await ChatHistory.create('model-a')
      const idx = await ChatHistory.listIndex()
      expect(idx).toHaveLength(1)
    })

    it('prepends to index (newest first)', async () => {
      const c1 = await ChatHistory.create('m1')
      const c2 = await ChatHistory.create('m2')
      const idx = await ChatHistory.listIndex()
      expect(idx[0].id).toBe(c2.id)
      expect(idx[1].id).toBe(c1.id)
    })
  })

  describe('get', () => {
    it('returns null for nonexistent conversation', async () => {
      expect(await ChatHistory.get('fake-id')).toBeNull()
    })

    it('returns created conversation', async () => {
      const created = await ChatHistory.create('model')
      const fetched = await ChatHistory.get(created.id)
      expect(fetched).not.toBeNull()
      expect(fetched!.id).toBe(created.id)
    })
  })

  describe('addMessage', () => {
    it('adds a user message', async () => {
      const conv = await ChatHistory.create('model')
      const msg = await ChatHistory.addMessage(conv.id, { role: 'user', content: 'Hello' })
      expect(msg.id).toBeTruthy()
      expect(msg.role).toBe('user')
      expect(msg.content).toBe('Hello')
      expect(msg.ts).toBeGreaterThan(0)
    })

    it('throws for nonexistent conversation', async () => {
      await expect(
        ChatHistory.addMessage('fake-id', { role: 'user', content: 'test' }),
      ).rejects.toThrow('Conversation not found')
    })

    it('auto-titles after 2 messages when title is default', async () => {
      const conv = await ChatHistory.create('model')
      await ChatHistory.addMessage(conv.id, { role: 'user', content: 'My first question about React' })
      await ChatHistory.addMessage(conv.id, { role: 'assistant', content: 'Sure!' })
      const updated = await ChatHistory.get(conv.id)
      expect(updated!.title).toBe('My first question about React'.slice(0, 40))
    })

    it('does not auto-title if title was changed', async () => {
      const conv = await ChatHistory.create('model')
      // Manually change title (simulating user rename)
      const fetched = await ChatHistory.get(conv.id)
      fetched!.title = 'Custom Title'
      await chrome.storage.local.set({ [`hchat:conv:${conv.id}`]: fetched })

      await ChatHistory.addMessage(conv.id, { role: 'user', content: 'Hello' })
      await ChatHistory.addMessage(conv.id, { role: 'assistant', content: 'Hi' })
      const updated = await ChatHistory.get(conv.id)
      expect(updated!.title).toBe('Custom Title')
    })
  })

  describe('updateLastMessage', () => {
    it('patches the last message', async () => {
      const conv = await ChatHistory.create('m')
      await ChatHistory.addMessage(conv.id, { role: 'user', content: 'q' })
      await ChatHistory.addMessage(conv.id, { role: 'assistant', content: 'partial', streaming: true })
      await ChatHistory.updateLastMessage(conv.id, { content: 'full answer', streaming: false })
      const updated = await ChatHistory.get(conv.id)
      const last = updated!.messages[updated!.messages.length - 1]
      expect(last.content).toBe('full answer')
      expect(last.streaming).toBe(false)
    })

    it('is no-op for empty conversation', async () => {
      const conv = await ChatHistory.create('m')
      await ChatHistory.updateLastMessage(conv.id, { content: 'nope' })
      const updated = await ChatHistory.get(conv.id)
      expect(updated!.messages).toHaveLength(0)
    })
  })

  describe('delete', () => {
    it('removes conversation and updates index', async () => {
      const conv = await ChatHistory.create('m')
      await ChatHistory.delete(conv.id)
      expect(await ChatHistory.get(conv.id)).toBeNull()
      const idx = await ChatHistory.listIndex()
      expect(idx.find((c) => c.id === conv.id)).toBeUndefined()
    })
  })

  describe('pin', () => {
    it('pins a conversation in the index', async () => {
      const conv = await ChatHistory.create('m')
      await ChatHistory.pin(conv.id, true)
      const idx = await ChatHistory.listIndex()
      expect(idx[0].pinned).toBe(true)
    })

    it('unpins a conversation', async () => {
      const conv = await ChatHistory.create('m')
      await ChatHistory.pin(conv.id, true)
      await ChatHistory.pin(conv.id, false)
      const idx = await ChatHistory.listIndex()
      expect(idx[0].pinned).toBe(false)
    })
  })

  describe('tags', () => {
    it('sets tags on a conversation', async () => {
      const conv = await ChatHistory.create('m')
      await ChatHistory.setTags(conv.id, ['tag1', 'tag2'])
      const updated = await ChatHistory.get(conv.id)
      expect(updated!.tags).toEqual(['tag1', 'tag2'])
    })

    it('adds a tag without duplicates', async () => {
      const conv = await ChatHistory.create('m')
      await ChatHistory.addTag(conv.id, 'a')
      await ChatHistory.addTag(conv.id, 'a')
      const updated = await ChatHistory.get(conv.id)
      expect(updated!.tags).toEqual(['a'])
    })

    it('removes a tag', async () => {
      const conv = await ChatHistory.create('m')
      await ChatHistory.setTags(conv.id, ['a', 'b', 'c'])
      await ChatHistory.removeTag(conv.id, 'b')
      const updated = await ChatHistory.get(conv.id)
      expect(updated!.tags).toEqual(['a', 'c'])
    })
  })

  describe('fork', () => {
    it('creates a forked conversation up to a message', async () => {
      const conv = await ChatHistory.create('m')
      const m1 = await ChatHistory.addMessage(conv.id, { role: 'user', content: 'q1' })
      await ChatHistory.addMessage(conv.id, { role: 'assistant', content: 'a1' })
      await ChatHistory.addMessage(conv.id, { role: 'user', content: 'q2' })

      const forked = await ChatHistory.fork(conv.id, m1.id)
      expect(forked).not.toBeNull()
      expect(forked!.title).toContain('(분기)')
      expect(forked!.messages).toHaveLength(1)
      expect(forked!.messages[0].content).toBe('q1')
      // Forked messages should have new IDs
      expect(forked!.messages[0].id).not.toBe(m1.id)
    })

    it('returns null for nonexistent conversation', async () => {
      expect(await ChatHistory.fork('fake', 'fake-msg')).toBeNull()
    })

    it('returns null for nonexistent message', async () => {
      const conv = await ChatHistory.create('m')
      expect(await ChatHistory.fork(conv.id, 'fake-msg')).toBeNull()
    })
  })

  describe('truncateAfter', () => {
    it('removes messages from the given ID onward', async () => {
      const conv = await ChatHistory.create('m')
      await ChatHistory.addMessage(conv.id, { role: 'user', content: 'q1' })
      const m2 = await ChatHistory.addMessage(conv.id, { role: 'assistant', content: 'a1' })
      await ChatHistory.addMessage(conv.id, { role: 'user', content: 'q2' })

      const remaining = await ChatHistory.truncateAfter(conv.id, m2.id)
      expect(remaining).toHaveLength(1)
      expect(remaining[0].content).toBe('q1')
    })
  })

  describe('message pins', () => {
    it('toggles message pin', async () => {
      const conv = await ChatHistory.create('m')
      const msg = await ChatHistory.addMessage(conv.id, { role: 'user', content: 'pin me' })
      const pinned = await ChatHistory.toggleMessagePin(conv.id, msg.id)
      expect(pinned).toBe(true)
      const unpinned = await ChatHistory.toggleMessagePin(conv.id, msg.id)
      expect(unpinned).toBe(false)
    })

    it('gets pinned messages', async () => {
      const conv = await ChatHistory.create('m')
      const m1 = await ChatHistory.addMessage(conv.id, { role: 'user', content: 'pinned' })
      await ChatHistory.addMessage(conv.id, { role: 'assistant', content: 'not pinned' })
      await ChatHistory.toggleMessagePin(conv.id, m1.id)

      const pinned = await ChatHistory.getPinnedMessages(conv.id)
      expect(pinned).toHaveLength(1)
      expect(pinned[0].content).toBe('pinned')
    })
  })

  describe('updateMessage', () => {
    it('updates message content', async () => {
      const conv = await ChatHistory.create('m')
      const msg = await ChatHistory.addMessage(conv.id, { role: 'user', content: 'original' })
      await ChatHistory.updateMessage(conv.id, msg.id, 'edited')
      const updated = await ChatHistory.get(conv.id)
      expect(updated!.messages[0].content).toBe('edited')
    })
  })

  describe('setPersona', () => {
    it('sets persona on conversation', async () => {
      const conv = await ChatHistory.create('m')
      await ChatHistory.setPersona(conv.id, 'persona-123')
      const updated = await ChatHistory.get(conv.id)
      expect(updated!.personaId).toBe('persona-123')
    })
  })
})
