import { describe, it, expect, vi } from 'vitest'
import { MessageQueue, type QueuedMessage } from '../messageQueue'
import { Storage } from '../storage'
import { SK } from '../storageKeys'

describe('MessageQueue', () => {
  describe('enqueue', () => {
    it('adds a message to an empty queue', async () => {
      const msg = await MessageQueue.enqueue({
        convId: 'conv-1',
        text: 'hello',
        model: 'claude-3',
      })

      expect(msg.id).toBeDefined()
      expect(msg.convId).toBe('conv-1')
      expect(msg.text).toBe('hello')
      expect(msg.model).toBe('claude-3')
      expect(msg.queuedAt).toBeGreaterThan(0)

      const all = await MessageQueue.getAll()
      expect(all).toHaveLength(1)
      expect(all[0].id).toBe(msg.id)
    })

    it('appends to existing queue preserving order', async () => {
      await MessageQueue.enqueue({ convId: 'c1', text: 'first', model: 'm1' })
      await MessageQueue.enqueue({ convId: 'c2', text: 'second', model: 'm2' })
      await MessageQueue.enqueue({ convId: 'c3', text: 'third', model: 'm3' })

      const all = await MessageQueue.getAll()
      expect(all).toHaveLength(3)
      expect(all[0].text).toBe('first')
      expect(all[1].text).toBe('second')
      expect(all[2].text).toBe('third')
    })

    it('includes optional opts', async () => {
      const msg = await MessageQueue.enqueue({
        convId: 'c1',
        text: 'test',
        model: 'm1',
        opts: { imageBase64: 'data:image/png;base64,...' },
      })

      expect(msg.opts).toEqual({ imageBase64: 'data:image/png;base64,...' })
    })
  })

  describe('dequeue', () => {
    it('returns null from empty queue', async () => {
      const msg = await MessageQueue.dequeue()
      expect(msg).toBeNull()
    })

    it('returns and removes the oldest message (FIFO)', async () => {
      await MessageQueue.enqueue({ convId: 'c1', text: 'first', model: 'm1' })
      await MessageQueue.enqueue({ convId: 'c2', text: 'second', model: 'm2' })

      const first = await MessageQueue.dequeue()
      expect(first!.text).toBe('first')

      const remaining = await MessageQueue.getAll()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].text).toBe('second')
    })

    it('empties queue after dequeuing all', async () => {
      await MessageQueue.enqueue({ convId: 'c1', text: 'only', model: 'm1' })
      await MessageQueue.dequeue()

      const all = await MessageQueue.getAll()
      expect(all).toHaveLength(0)
    })
  })

  describe('getAll', () => {
    it('returns empty array when no queue exists', async () => {
      const all = await MessageQueue.getAll()
      expect(all).toEqual([])
    })

    it('returns all queued messages', async () => {
      await MessageQueue.enqueue({ convId: 'c1', text: 'a', model: 'm1' })
      await MessageQueue.enqueue({ convId: 'c2', text: 'b', model: 'm2' })

      const all = await MessageQueue.getAll()
      expect(all).toHaveLength(2)
    })
  })

  describe('clear', () => {
    it('removes all queued messages', async () => {
      await MessageQueue.enqueue({ convId: 'c1', text: 'a', model: 'm1' })
      await MessageQueue.enqueue({ convId: 'c2', text: 'b', model: 'm2' })

      await MessageQueue.clear()

      const all = await MessageQueue.getAll()
      expect(all).toEqual([])
    })

    it('is safe to call on empty queue', async () => {
      await MessageQueue.clear()
      const all = await MessageQueue.getAll()
      expect(all).toEqual([])
    })
  })

  describe('processQueue', () => {
    it('processes messages in FIFO order', async () => {
      await MessageQueue.enqueue({ convId: 'c1', text: 'first', model: 'm1' })
      await MessageQueue.enqueue({ convId: 'c2', text: 'second', model: 'm2' })
      await MessageQueue.enqueue({ convId: 'c3', text: 'third', model: 'm3' })

      const processed: string[] = []
      const sendFn = vi.fn(async (msg: QueuedMessage) => {
        processed.push(msg.text)
      })

      const result = await MessageQueue.processQueue(sendFn)

      expect(result).toEqual({ sent: 3, failed: 0 })
      expect(processed).toEqual(['first', 'second', 'third'])
      expect(sendFn).toHaveBeenCalledTimes(3)

      const remaining = await MessageQueue.getAll()
      expect(remaining).toHaveLength(0)
    })

    it('returns zero counts on empty queue', async () => {
      const sendFn = vi.fn()
      const result = await MessageQueue.processQueue(sendFn)

      expect(result).toEqual({ sent: 0, failed: 0 })
      expect(sendFn).not.toHaveBeenCalled()
    })

    it('handles send failures gracefully and retains failed messages', async () => {
      await MessageQueue.enqueue({ convId: 'c1', text: 'ok', model: 'm1' })
      await MessageQueue.enqueue({ convId: 'c2', text: 'fail', model: 'm2' })
      await MessageQueue.enqueue({ convId: 'c3', text: 'ok2', model: 'm3' })

      const sendFn = vi.fn(async (msg: QueuedMessage) => {
        if (msg.text === 'fail') throw new Error('Network error')
      })

      const result = await MessageQueue.processQueue(sendFn)

      expect(result).toEqual({ sent: 2, failed: 1 })

      const remaining = await MessageQueue.getAll()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].text).toBe('fail')
    })

    it('retains all messages when all sends fail', async () => {
      await MessageQueue.enqueue({ convId: 'c1', text: 'a', model: 'm1' })
      await MessageQueue.enqueue({ convId: 'c2', text: 'b', model: 'm2' })

      const sendFn = vi.fn(async () => {
        throw new Error('Offline')
      })

      const result = await MessageQueue.processQueue(sendFn)

      expect(result).toEqual({ sent: 0, failed: 2 })

      const remaining = await MessageQueue.getAll()
      expect(remaining).toHaveLength(2)
    })

    it('persists queue state via Storage', async () => {
      await MessageQueue.enqueue({ convId: 'c1', text: 'persisted', model: 'm1' })

      // Verify data is in storage
      const stored = await Storage.get<QueuedMessage[]>(SK.MESSAGE_QUEUE)
      expect(stored).toHaveLength(1)
      expect(stored![0].text).toBe('persisted')

      // Process and verify storage is updated
      await MessageQueue.processQueue(async () => {})
      const afterProcess = await Storage.get<QueuedMessage[]>(SK.MESSAGE_QUEUE)
      expect(afterProcess).toHaveLength(0)
    })
  })
})
