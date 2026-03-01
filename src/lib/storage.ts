export const Storage = {
  async get<T>(key: string): Promise<T | null> {
    const r = await chrome.storage.local.get(key)
    return r[key] ?? null
  },
  async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value })
  },
  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key)
  },
  async getAll<T>(prefix: string): Promise<Record<string, T>> {
    const all = await chrome.storage.local.get(null)
    const out: Record<string, T> = {}
    for (const [k, v] of Object.entries(all))
      if (k.startsWith(prefix)) out[k] = v as T
    return out
  },
}
