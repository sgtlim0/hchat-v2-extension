interface StorageEntry<T> {
  value: T
  expiresAt?: number  // undefined = no expiry
}

/** In-memory LRU cache for hot reads */
const cache = new Map<string, { value: unknown; ts: number }>()
const CACHE_TTL_MS = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test' ? 0 : 5000

export const Storage = {
  async get<T>(key: string): Promise<T | null> {
    // Check in-memory cache first
    const cached = cache.get(key)
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return cached.value as T
    }

    const r = await chrome.storage.local.get(key)
    const entry = r[key]
    if (entry == null) {
      cache.delete(key)
      return null
    }
    // Handle legacy values (no wrapper)
    if (typeof entry !== 'object' || (entry as Record<string, unknown>).value === undefined) {
      cache.set(key, { value: entry, ts: Date.now() })
      return entry as T
    }
    // Check TTL
    const wrapped = entry as StorageEntry<T>
    if (wrapped.expiresAt && Date.now() > wrapped.expiresAt) {
      await chrome.storage.local.remove(key)
      cache.delete(key)
      return null
    }
    cache.set(key, { value: wrapped.value, ts: Date.now() })
    return wrapped.value
  },
  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    if (ttlMs) {
      const entry: StorageEntry<T> = { value, expiresAt: Date.now() + ttlMs }
      await chrome.storage.local.set({ [key]: entry })
    } else {
      await chrome.storage.local.set({ [key]: value })
    }
    // Write-through: update cache
    cache.set(key, { value, ts: Date.now() })
  },
  async setMultiple(data: Record<string, unknown>): Promise<void> {
    await chrome.storage.local.set(data)
    // Write-through: update cache for each key
    const now = Date.now()
    for (const [k, v] of Object.entries(data)) {
      cache.set(k, { value: v, ts: now })
    }
  },
  async remove(key: string): Promise<void> {
    cache.delete(key)
    await chrome.storage.local.remove(key)
  },
  async getAll<T>(prefix: string): Promise<Record<string, T>> {
    const all = await chrome.storage.local.get(null)
    const out: Record<string, T> = {}
    for (const [k, v] of Object.entries(all))
      if (k.startsWith(prefix)) out[k] = v as T
    return out
  },
  async clear(): Promise<void> {
    cache.clear()
    await chrome.storage.local.clear()
  },
  invalidateCache(): void {
    cache.clear()
  },
}
