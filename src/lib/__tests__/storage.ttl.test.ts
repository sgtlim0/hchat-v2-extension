import { describe, it, expect, beforeEach } from 'vitest'
import { Storage } from '../storage'

describe('Storage TTL', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  describe('set with TTL', () => {
    it('stores value with TTL wrapper', async () => {
      await Storage.set('ttl-key', 'hello', 60_000)
      const raw = await chrome.storage.local.get('ttl-key')
      expect(raw['ttl-key']).toHaveProperty('value', 'hello')
      expect(raw['ttl-key']).toHaveProperty('expiresAt')
      expect(typeof raw['ttl-key'].expiresAt).toBe('number')
    })

    it('stores value without wrapper when no TTL', async () => {
      await Storage.set('no-ttl', 'direct')
      const raw = await chrome.storage.local.get('no-ttl')
      expect(raw['no-ttl']).toBe('direct')
    })
  })

  describe('get with TTL', () => {
    it('returns value before expiry', async () => {
      vi.useFakeTimers({ now: 1000 })
      await Storage.set('fresh', 'data', 60_000)
      // Still within TTL
      vi.setSystemTime(50_000)
      const result = await Storage.get('fresh')
      expect(result).toBe('data')
      vi.useRealTimers()
    })

    it('returns null after expiry', async () => {
      vi.useFakeTimers({ now: 1000 })
      await Storage.set('expired', 'old', 5_000)
      // Jump past TTL
      vi.setSystemTime(100_000)
      const result = await Storage.get('expired')
      expect(result).toBeNull()
      vi.useRealTimers()
    })

    it('removes expired entry from storage', async () => {
      vi.useFakeTimers({ now: 1000 })
      await Storage.set('to-expire', 'temp', 5_000)
      vi.setSystemTime(100_000)
      await Storage.get('to-expire')
      // Verify it was removed
      const raw = await chrome.storage.local.get('to-expire')
      expect(raw['to-expire']).toBeUndefined()
      vi.useRealTimers()
    })

    it('returns value indefinitely when no TTL', async () => {
      await Storage.set('permanent', 'forever')
      const result = await Storage.get('permanent')
      expect(result).toBe('forever')
    })
  })

  describe('backward compatibility (legacy data)', () => {
    it('reads legacy string values without wrapper', async () => {
      await chrome.storage.local.set({ 'legacy-str': 'old-value' })
      const result = await Storage.get('legacy-str')
      expect(result).toBe('old-value')
    })

    it('reads legacy number values without wrapper', async () => {
      await chrome.storage.local.set({ 'legacy-num': 42 })
      const result = await Storage.get('legacy-num')
      expect(result).toBe(42)
    })

    it('reads legacy array values without wrapper', async () => {
      await chrome.storage.local.set({ 'legacy-arr': [1, 2, 3] })
      const result = await Storage.get<number[]>('legacy-arr')
      expect(result).toEqual([1, 2, 3])
    })

    it('reads legacy object without value property', async () => {
      await chrome.storage.local.set({ 'legacy-obj': { name: 'test', count: 5 } })
      const result = await Storage.get<{ name: string; count: number }>('legacy-obj')
      expect(result).toEqual({ name: 'test', count: 5 })
    })

    it('reads legacy object that has value property but no expiresAt', async () => {
      // Edge case: legacy object happens to have a "value" field
      await chrome.storage.local.set({ 'edge-case': { value: 'inner', extra: true } })
      const result = await Storage.get<string>('edge-case')
      // Should be treated as TTL-wrapped since it has .value
      expect(result).toBe('inner')
    })
  })

  describe('TTL edge cases', () => {
    it('handles zero TTL as no-TTL (falsy)', async () => {
      await Storage.set('zero-ttl', 'val', 0)
      const raw = await chrome.storage.local.get('zero-ttl')
      // 0 is falsy, so should store without wrapper
      expect(raw['zero-ttl']).toBe('val')
    })

    it('handles boolean values with TTL', async () => {
      vi.useFakeTimers({ now: 1000 })
      await Storage.set('bool-ttl', true, 10_000)
      const result = await Storage.get<boolean>('bool-ttl')
      expect(result).toBe(true)
      vi.useRealTimers()
    })

    it('returns null for missing key regardless of TTL', async () => {
      const result = await Storage.get('nonexistent')
      expect(result).toBeNull()
    })
  })
})
