import { describe, it, expect, beforeEach } from 'vitest'
import { CredentialStore } from '../credentialStore'

describe('CredentialStore', () => {
  describe('save and load', () => {
    it('saves and loads a credential', async () => {
      await CredentialStore.save('aws-key', 'AKIAIOSFODNN7EXAMPLE')
      const result = await CredentialStore.load('aws-key')
      expect(result).toBe('AKIAIOSFODNN7EXAMPLE')
    })

    it('returns null for missing credential', async () => {
      const result = await CredentialStore.load('nonexistent')
      expect(result).toBeNull()
    })

    it('overwrites existing credential', async () => {
      await CredentialStore.save('api-key', 'old-key')
      await CredentialStore.save('api-key', 'new-key')
      const result = await CredentialStore.load('api-key')
      expect(result).toBe('new-key')
    })

    it('stores credentials with prefix to avoid collisions', async () => {
      await CredentialStore.save('test', 'secret')
      const raw = await chrome.storage.local.get('hchat:cred:test')
      expect(raw['hchat:cred:test']).toBe('secret')
    })
  })

  describe('remove', () => {
    it('removes a specific credential', async () => {
      await CredentialStore.save('to-remove', 'temp')
      await CredentialStore.remove('to-remove')
      const result = await CredentialStore.load('to-remove')
      expect(result).toBeNull()
    })
  })

  describe('clear', () => {
    it('clears all credentials without affecting other storage', async () => {
      await CredentialStore.save('key1', 'val1')
      await CredentialStore.save('key2', 'val2')
      // Store non-credential data
      await chrome.storage.local.set({ 'hchat:config': { theme: 'dark' } })

      await CredentialStore.clear()

      // Credentials should be gone
      expect(await CredentialStore.load('key1')).toBeNull()
      expect(await CredentialStore.load('key2')).toBeNull()
      // Non-credential data should survive
      const config = await chrome.storage.local.get('hchat:config')
      expect(config['hchat:config']).toEqual({ theme: 'dark' })
    })

    it('handles clear with no credentials stored', async () => {
      // Should not throw
      await CredentialStore.clear()
    })
  })

  describe('fallback behavior', () => {
    it('uses chrome.storage.local when session is unavailable', async () => {
      // The test setup does not mock chrome.storage.session, so it should fall back
      await CredentialStore.save('fallback-test', 'value')
      const raw = await chrome.storage.local.get('hchat:cred:fallback-test')
      expect(raw['hchat:cred:fallback-test']).toBe('value')
    })
  })
})
