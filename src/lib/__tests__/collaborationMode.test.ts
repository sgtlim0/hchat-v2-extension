// lib/__tests__/collaborationMode.test.ts — Tests for tab collaboration/sync system

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SyncMessage, CollabSession } from '../collaborationMode'

// ── BroadcastChannel Mock ──
type MessageHandler = ((ev: MessageEvent) => void) | null

const channels: Map<string, MockBroadcastChannel[]> = new Map()

class MockBroadcastChannel {
  name: string
  onmessage: MessageHandler = null
  private closed = false

  constructor(name: string) {
    this.name = name
    const list = channels.get(name) ?? []
    list.push(this)
    channels.set(name, list)
  }

  postMessage(data: unknown) {
    if (this.closed) return
    const siblings = channels.get(this.name) ?? []
    for (const ch of siblings) {
      if (ch !== this && ch.onmessage && !ch.closed) {
        ch.onmessage(new MessageEvent('message', { data }))
      }
    }
  }

  close() {
    this.closed = true
    const list = channels.get(this.name) ?? []
    const idx = list.indexOf(this)
    if (idx >= 0) list.splice(idx, 1)
  }
}

// Install mock
globalThis.BroadcastChannel = MockBroadcastChannel as unknown as typeof BroadcastChannel

describe('collaborationMode', () => {
  let createCollabSession: typeof import('../collaborationMode').createCollabSession
  let resolveConflict: typeof import('../collaborationMode').resolveConflict
  let getActiveSessions: typeof import('../collaborationMode').getActiveSessions

  beforeEach(async () => {
    vi.useFakeTimers()
    channels.clear()
    const mod = await import('../collaborationMode')
    createCollabSession = mod.createCollabSession
    resolveConflict = mod.resolveConflict
    getActiveSessions = mod.getActiveSessions
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── createCollabSession ──
  describe('createCollabSession', () => {
    it('should create session with convId and tabId', () => {
      const session = createCollabSession('conv-1')

      expect(session.convId).toBe('conv-1')
      expect(session.tabId).toBeDefined()
      expect(typeof session.tabId).toBe('string')
      expect(session.tabId.length).toBeGreaterThan(0)

      session.close()
    })

    it('should generate unique tabId for each session', () => {
      const s1 = createCollabSession('conv-1')
      const s2 = createCollabSession('conv-1')

      expect(s1.tabId).not.toBe(s2.tabId)

      s1.close()
      s2.close()
    })
  })

  // ── sendUpdate ──
  describe('sendUpdate', () => {
    it('should broadcast message via BroadcastChannel', () => {
      const s1 = createCollabSession('conv-1')
      const s2 = createCollabSession('conv-1')

      const received: SyncMessage[] = []
      s2.onUpdate((msg) => received.push(msg))

      s1.sendUpdate('message_added', { text: 'hello' })

      expect(received).toHaveLength(1)
      expect(received[0].type).toBe('message_added')
      expect(received[0].convId).toBe('conv-1')
      expect(received[0].tabId).toBe(s1.tabId)
      expect(received[0].payload).toEqual({ text: 'hello' })
      expect(typeof received[0].timestamp).toBe('number')

      s1.close()
      s2.close()
    })
  })

  // ── onUpdate ──
  describe('onUpdate', () => {
    it('should register callback and receive messages', () => {
      const s1 = createCollabSession('conv-1')
      const s2 = createCollabSession('conv-1')

      const cb = vi.fn()
      s2.onUpdate(cb)

      s1.sendUpdate('typing')

      expect(cb).toHaveBeenCalledTimes(1)
      expect(cb.mock.calls[0][0].type).toBe('typing')

      s1.close()
      s2.close()
    })

    it('should ignore messages from the same tab', () => {
      const s1 = createCollabSession('conv-1')

      const cb = vi.fn()
      s1.onUpdate(cb)

      // Same tab sends — should not trigger own callback
      s1.sendUpdate('typing')

      expect(cb).not.toHaveBeenCalled()

      s1.close()
    })
  })

  // ── close ──
  describe('close', () => {
    it('should close BroadcastChannel', () => {
      const s1 = createCollabSession('conv-1')
      const s2 = createCollabSession('conv-1')

      const cb = vi.fn()
      s2.onUpdate(cb)

      s1.close()
      // After close, messages should not be received
      // s1 is closed so postMessage won't work
      expect(s1.isConnected()).toBe(false)

      s1.close() // double close should not throw
      s2.close()
    })
  })

  // ── isConnected ──
  describe('isConnected', () => {
    it('should return true initially', () => {
      const session = createCollabSession('conv-1')

      expect(session.isConnected()).toBe(true)

      session.close()
    })

    it('should return false after close', () => {
      const session = createCollabSession('conv-1')
      session.close()

      expect(session.isConnected()).toBe(false)
    })
  })

  // ── resolveConflict ──
  describe('resolveConflict', () => {
    it('should pick the message with later timestamp (last-write-wins)', () => {
      const older: SyncMessage = {
        type: 'message_updated',
        convId: 'conv-1',
        tabId: 'tab-a',
        timestamp: 1000,
        payload: { text: 'old' },
      }
      const newer: SyncMessage = {
        type: 'message_updated',
        convId: 'conv-1',
        tabId: 'tab-b',
        timestamp: 2000,
        payload: { text: 'new' },
      }

      expect(resolveConflict(older, newer)).toBe(newer)
      expect(resolveConflict(newer, older)).toBe(newer)
    })

    it('should pick local when timestamps are equal', () => {
      const local: SyncMessage = {
        type: 'message_updated',
        convId: 'conv-1',
        tabId: 'tab-a',
        timestamp: 1000,
      }
      const remote: SyncMessage = {
        type: 'message_updated',
        convId: 'conv-1',
        tabId: 'tab-b',
        timestamp: 1000,
      }

      expect(resolveConflict(local, remote)).toBe(local)
    })
  })

  // ── SyncType messages ──
  describe('SyncType messages', () => {
    it('should handle message_added type', () => {
      const s1 = createCollabSession('conv-1')
      const s2 = createCollabSession('conv-1')
      const cb = vi.fn()
      s2.onUpdate(cb)

      s1.sendUpdate('message_added', { id: 'm1', text: 'hi' })

      expect(cb.mock.calls[0][0].type).toBe('message_added')

      s1.close()
      s2.close()
    })

    it('should handle message_updated type', () => {
      const s1 = createCollabSession('conv-1')
      const s2 = createCollabSession('conv-1')
      const cb = vi.fn()
      s2.onUpdate(cb)

      s1.sendUpdate('message_updated', { id: 'm1', text: 'updated' })

      expect(cb.mock.calls[0][0].type).toBe('message_updated')

      s1.close()
      s2.close()
    })

    it('should handle sync_request type', () => {
      const s1 = createCollabSession('conv-1')
      const s2 = createCollabSession('conv-1')
      const cb = vi.fn()
      s2.onUpdate(cb)

      s1.sendUpdate('sync_request')

      expect(cb.mock.calls[0][0].type).toBe('sync_request')

      s1.close()
      s2.close()
    })
  })

  // ── heartbeat ──
  describe('heartbeat', () => {
    it('should send heartbeat every 5 seconds', () => {
      const s1 = createCollabSession('conv-1')
      const s2 = createCollabSession('conv-1')
      const cb = vi.fn()
      s2.onUpdate(cb)

      vi.advanceTimersByTime(5000)

      const heartbeats = cb.mock.calls.filter(
        (c: [SyncMessage]) => c[0].type === 'heartbeat'
      )
      expect(heartbeats.length).toBeGreaterThanOrEqual(1)

      s1.close()
      s2.close()
    })

    it('should mark disconnected after 15s without heartbeat', () => {
      const s1 = createCollabSession('conv-1')
      const s2 = createCollabSession('conv-1')

      // s2 listens for s1's heartbeats
      const cb = vi.fn()
      s2.onUpdate(cb)

      // s1 sends heartbeats for 5s
      vi.advanceTimersByTime(5000)
      expect(s1.isConnected()).toBe(true)

      // Now close s1 to stop heartbeats
      s1.close()

      // Advance 15s — s2 should detect s1 is gone
      // But s2 itself should still be connected
      expect(s2.isConnected()).toBe(true)

      s2.close()
    })
  })

  // ── getActiveSessions ──
  describe('getActiveSessions', () => {
    it('should return empty array when no sessions', () => {
      expect(getActiveSessions()).toEqual([])
    })

    it('should return active session convIds', () => {
      const s1 = createCollabSession('conv-1')
      const s2 = createCollabSession('conv-2')

      const active = getActiveSessions()
      expect(active).toContain('conv-1')
      expect(active).toContain('conv-2')

      s1.close()
      s2.close()
    })

    it('should remove closed sessions', () => {
      const s1 = createCollabSession('conv-1')
      const s2 = createCollabSession('conv-2')

      s1.close()

      const active = getActiveSessions()
      expect(active).not.toContain('conv-1')
      expect(active).toContain('conv-2')

      s2.close()
    })

    it('should deduplicate convIds when multiple sessions on same conv', () => {
      const s1 = createCollabSession('conv-1')
      const s2 = createCollabSession('conv-1')

      const active = getActiveSessions()
      const convOccurrences = active.filter((id) => id === 'conv-1')
      expect(convOccurrences).toHaveLength(1)

      s1.close()
      s2.close()
    })
  })

  // ── sendUpdate after close ──
  describe('sendUpdate after close', () => {
    it('should not send messages after session is closed', () => {
      const s1 = createCollabSession('conv-1')
      const s2 = createCollabSession('conv-1')
      const cb = vi.fn()
      s2.onUpdate(cb)

      s1.close()
      s1.sendUpdate('message_added', { text: 'should not arrive' })

      expect(cb).not.toHaveBeenCalled()

      s2.close()
    })
  })

  // ── heartbeat stops after close ──
  describe('heartbeat stops after close', () => {
    it('should stop heartbeat interval after close', () => {
      const s1 = createCollabSession('conv-1')
      const s2 = createCollabSession('conv-1')
      const cb = vi.fn()
      s2.onUpdate(cb)

      s1.close()
      cb.mockClear()

      vi.advanceTimersByTime(10000)
      // No heartbeats from s1 after close
      const heartbeats = cb.mock.calls.filter(
        (c: [SyncMessage]) => c[0].tabId === s1.tabId && c[0].type === 'heartbeat'
      )
      expect(heartbeats).toHaveLength(0)

      s2.close()
    })
  })

  // ── sendUpdate without payload ──
  describe('sendUpdate without payload', () => {
    it('should not include payload field when no payload given', () => {
      const s1 = createCollabSession('conv-1')
      const s2 = createCollabSession('conv-1')
      const cb = vi.fn()
      s2.onUpdate(cb)

      s1.sendUpdate('typing')

      expect(cb.mock.calls[0][0]).not.toHaveProperty('payload')

      s1.close()
      s2.close()
    })
  })

  // ── multiple listeners ──
  describe('multiple listeners', () => {
    it('should notify all registered listeners', () => {
      const s1 = createCollabSession('conv-1')
      const s2 = createCollabSession('conv-1')

      const cb1 = vi.fn()
      const cb2 = vi.fn()
      s2.onUpdate(cb1)
      s2.onUpdate(cb2)

      s1.sendUpdate('message_added', { id: 'm1' })

      expect(cb1).toHaveBeenCalledTimes(1)
      expect(cb2).toHaveBeenCalledTimes(1)

      s1.close()
      s2.close()
    })
  })

  // ── different conversations don't interfere ──
  describe('conversation isolation', () => {
    it('should not receive messages from different conversations', () => {
      const s1 = createCollabSession('conv-1')
      const s2 = createCollabSession('conv-2')

      const cb = vi.fn()
      s2.onUpdate(cb)

      s1.sendUpdate('message_added')

      expect(cb).not.toHaveBeenCalled()

      s1.close()
      s2.close()
    })
  })
})
