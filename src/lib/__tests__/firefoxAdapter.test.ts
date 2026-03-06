// lib/__tests__/firefoxAdapter.test.ts — Tests for Firefox/Chrome extension API adapter

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  detectBrowser,
  openSidePanel,
  getStorage,
  convertManifest,
  isFeatureSupported,
  type BrowserType,
  type BrowserFeature,
  type StorageAdapter,
} from '../firefoxAdapter'

describe('firefoxAdapter', () => {
  // ── detectBrowser ──
  describe('detectBrowser', () => {
    it('should detect Chrome', () => {
      const result = detectBrowser(
        'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
      )
      expect(result).toBe('chrome')
    })

    it('should detect Firefox', () => {
      const result = detectBrowser(
        'Mozilla/5.0 (Windows NT 10.0; rv:121.0) Gecko/20100101 Firefox/121.0'
      )
      expect(result).toBe('firefox')
    })

    it('should detect Edge', () => {
      const result = detectBrowser(
        'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
      )
      expect(result).toBe('edge')
    })

    it('should detect Safari', () => {
      const result = detectBrowser(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
      )
      expect(result).toBe('safari')
    })

    it('should return unknown for unrecognized UA', () => {
      const result = detectBrowser('SomeBot/1.0')
      expect(result).toBe('unknown')
    })
  })

  // ── convertManifest ──
  describe('convertManifest', () => {
    it('should convert side_panel to sidebar_action', () => {
      const chrome = {
        name: 'H Chat',
        side_panel: { default_path: 'sidepanel.html' },
      }
      const result = convertManifest(chrome)

      expect(result).not.toHaveProperty('side_panel')
      expect(result).toHaveProperty('sidebar_action')
      expect((result as Record<string, unknown>).sidebar_action).toEqual({
        default_panel: 'sidepanel.html',
      })
    })

    it('should convert service_worker to scripts array', () => {
      const chrome = {
        name: 'H Chat',
        background: { service_worker: 'background.js' },
      }
      const result = convertManifest(chrome)

      expect((result as Record<string, unknown>).background).toEqual({
        scripts: ['background.js'],
      })
    })

    it('should merge host_permissions into permissions', () => {
      const chrome = {
        name: 'H Chat',
        permissions: ['storage', 'tabs'],
        host_permissions: ['https://*.example.com/*'],
      }
      const result = convertManifest(chrome) as Record<string, unknown>

      expect(result).not.toHaveProperty('host_permissions')
      expect(result.permissions).toEqual([
        'storage',
        'tabs',
        'https://*.example.com/*',
      ])
    })

    it('should preserve unrelated fields', () => {
      const chrome = {
        name: 'H Chat',
        version: '6.0',
        description: 'Test',
      }
      const result = convertManifest(chrome) as Record<string, unknown>

      expect(result.name).toBe('H Chat')
      expect(result.version).toBe('6.0')
      expect(result.description).toBe('Test')
    })
  })

  // ── isFeatureSupported ──
  describe('isFeatureSupported', () => {
    it('should report sidePanel supported for Chrome', () => {
      expect(isFeatureSupported('sidePanel', 'chrome')).toBe(true)
    })

    it('should report sidePanel not supported for Firefox', () => {
      expect(isFeatureSupported('sidePanel', 'firefox')).toBe(false)
    })

    it('should report sidebarAction supported for Firefox', () => {
      expect(isFeatureSupported('sidebarAction', 'firefox')).toBe(true)
    })

    it('should report contextMenus supported for both', () => {
      expect(isFeatureSupported('contextMenus', 'chrome')).toBe(true)
      expect(isFeatureSupported('contextMenus', 'firefox')).toBe(true)
    })

    it('should report tabCapture for Chrome only', () => {
      expect(isFeatureSupported('tabCapture', 'chrome')).toBe(true)
      expect(isFeatureSupported('tabCapture', 'firefox')).toBe(false)
    })
  })

  // ── getStorage ──
  describe('getStorage', () => {
    it('should get value from storage', async () => {
      await chrome.storage.local.set({ myKey: 'test-value' })
      const adapter = getStorage()
      const result = await adapter.get('myKey')

      expect(result).toBe('test-value')
    })

    it('should set value in storage', async () => {
      const adapter = getStorage()
      await adapter.set('setKey', 'myValue')

      const stored = await chrome.storage.local.get(['setKey'])
      expect(stored.setKey).toBe('myValue')
    })

    it('should remove value from storage', async () => {
      await chrome.storage.local.set({ removeKey: 'val' })
      const adapter = getStorage()
      await adapter.remove('removeKey')

      const stored = await chrome.storage.local.get(['removeKey'])
      expect(stored.removeKey).toBeUndefined()
    })
  })

  // ── openSidePanel ──
  describe('openSidePanel', () => {
    it('should call chrome.sidePanel.open for Chrome', async () => {
      const openFn = vi.fn().mockResolvedValue(undefined)
      const chromeObj = chrome as unknown as Record<string, unknown>
      chromeObj.sidePanel = { open: openFn }

      await openSidePanel('chrome')
      expect(openFn).toHaveBeenCalled()

      delete chromeObj.sidePanel
    })

    it('should call browser.sidebarAction.open for Firefox', async () => {
      const openFn = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(globalThis, 'browser', {
        value: { sidebarAction: { open: openFn } },
        writable: true,
        configurable: true,
      })

      await openSidePanel('firefox')
      expect(openFn).toHaveBeenCalled()

      delete (globalThis as Record<string, unknown>).browser
    })
  })
})
