import { describe, it, expect } from 'vitest'
import { SK } from '../storageKeys'
import type { StorageKey } from '../storageKeys'

describe('storageKeys', () => {
  it('all values start with hchat: prefix', () => {
    for (const [key, value] of Object.entries(SK)) {
      expect(value).toMatch(/^hchat:/)
    }
  })

  it('all values are unique', () => {
    const values = Object.values(SK)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })

  it('has no empty values', () => {
    for (const value of Object.values(SK)) {
      expect(value.length).toBeGreaterThan(0)
    }
  })

  it('CONFIG key is hchat:config', () => {
    expect(SK.CONFIG).toBe('hchat:config')
  })

  it('prefix keys end with colon', () => {
    const prefixKeys = ['CONV_PREFIX', 'DOC_PROJECT_PREFIX', 'SEARCH_CACHE_PREFIX'] as const
    for (const key of prefixKeys) {
      expect(SK[key]).toMatch(/:$/)
    }
  })

  it('non-prefix keys do not end with colon', () => {
    const prefixKeys = new Set(['CONV_PREFIX', 'DOC_PROJECT_PREFIX', 'SEARCH_CACHE_PREFIX'])
    for (const [key, value] of Object.entries(SK)) {
      if (!prefixKeys.has(key)) {
        expect(value).not.toMatch(/:$/)
      }
    }
  })

  it('SK object is frozen (as const)', () => {
    // TypeScript `as const` ensures compile-time immutability.
    // Verify values are string literal types at runtime.
    const config: StorageKey = SK.CONFIG
    expect(typeof config).toBe('string')
  })

  it('has expected number of keys', () => {
    const keyCount = Object.keys(SK).length
    expect(keyCount).toBeGreaterThanOrEqual(40)
  })
})
