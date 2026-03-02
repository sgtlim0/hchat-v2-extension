import { describe, it, expect } from 'vitest'
import { Storage } from '../storage'

describe('Storage', () => {
  describe('get', () => {
    it('returns null for missing key', async () => {
      expect(await Storage.get('nonexistent')).toBeNull()
    })

    it('returns stored value', async () => {
      await chrome.storage.local.set({ 'test-key': 'test-value' })
      expect(await Storage.get('test-key')).toBe('test-value')
    })

    it('returns complex objects', async () => {
      const obj = { name: 'test', items: [1, 2, 3] }
      await chrome.storage.local.set({ 'obj-key': obj })
      expect(await Storage.get('obj-key')).toEqual(obj)
    })
  })

  describe('set', () => {
    it('stores a value', async () => {
      await Storage.set('key1', 'value1')
      expect(await Storage.get('key1')).toBe('value1')
    })

    it('overwrites existing value', async () => {
      await Storage.set('key2', 'old')
      await Storage.set('key2', 'new')
      expect(await Storage.get('key2')).toBe('new')
    })

    it('stores null value', async () => {
      await Storage.set('nullable', null)
      const result = await chrome.storage.local.get('nullable')
      expect(result.nullable).toBeNull()
    })
  })

  describe('remove', () => {
    it('removes a key', async () => {
      await Storage.set('to-remove', 'data')
      await Storage.remove('to-remove')
      expect(await Storage.get('to-remove')).toBeNull()
    })

    it('is no-op for missing key', async () => {
      await Storage.remove('never-existed')
      // should not throw
    })
  })

  describe('getAll', () => {
    it('returns empty object when no keys match', async () => {
      expect(await Storage.getAll('prefix:')).toEqual({})
    })

    it('returns only keys matching prefix', async () => {
      await Storage.set('prefix:a', 1)
      await Storage.set('prefix:b', 2)
      await Storage.set('other:c', 3)
      const result = await Storage.getAll('prefix:')
      expect(result).toEqual({ 'prefix:a': 1, 'prefix:b': 2 })
    })

    it('returns all stored items with empty prefix', async () => {
      await Storage.set('x', 10)
      await Storage.set('y', 20)
      const result = await Storage.getAll('')
      expect(result['x']).toBe(10)
      expect(result['y']).toBe(20)
    })
  })
})
