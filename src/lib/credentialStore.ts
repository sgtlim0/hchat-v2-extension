// lib/credentialStore.ts — Secure credential storage for API keys
// Uses chrome.storage.session (memory-only, cleared on browser close) when available,
// falls back to chrome.storage.local in contexts where session storage is unavailable.
// TODO: Add AES-GCM encryption layer for chrome.storage.local fallback

function getStorage(): chrome.storage.StorageArea {
  // chrome.storage.session is only available in MV3 background service workers
  if (typeof chrome !== 'undefined' && chrome.storage?.session) {
    return chrome.storage.session
  }
  return chrome.storage.local
}

const CREDENTIAL_PREFIX = 'hchat:cred:'

export const CredentialStore = {
  async save(key: string, value: string): Promise<void> {
    const storage = getStorage()
    await storage.set({ [`${CREDENTIAL_PREFIX}${key}`]: value })
  },

  async load(key: string): Promise<string | null> {
    const storage = getStorage()
    const result = await storage.get(`${CREDENTIAL_PREFIX}${key}`)
    return result[`${CREDENTIAL_PREFIX}${key}`] ?? null
  },

  async remove(key: string): Promise<void> {
    const storage = getStorage()
    await storage.remove(`${CREDENTIAL_PREFIX}${key}`)
  },

  async clear(): Promise<void> {
    const storage = getStorage()
    if (storage === chrome.storage.session) {
      await storage.clear()
    } else {
      // Only clear credential-prefixed keys from local storage
      const all = await storage.get(null)
      const credKeys = Object.keys(all).filter((k) => k.startsWith(CREDENTIAL_PREFIX))
      if (credKeys.length > 0) {
        await storage.remove(credKeys)
      }
    }
  },
}
