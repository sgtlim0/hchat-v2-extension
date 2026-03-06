// lib/firefoxAdapter.ts — Firefox/Chrome extension API adapter

// ── Types ──

export type BrowserType = 'chrome' | 'firefox' | 'edge' | 'safari' | 'unknown'

export type BrowserFeature =
  | 'sidePanel'
  | 'sidebarAction'
  | 'contextMenus'
  | 'scripting'
  | 'tabCapture'

export interface StorageAdapter {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
  remove(key: string): Promise<void>
}

// ── Feature support matrix ──

const FEATURE_SUPPORT: Record<string, readonly BrowserType[]> = {
  sidePanel: ['chrome', 'edge'],
  sidebarAction: ['firefox'],
  contextMenus: ['chrome', 'firefox', 'edge', 'safari'],
  scripting: ['chrome', 'firefox', 'edge'],
  tabCapture: ['chrome', 'edge'],
} as const

// ── Browser Detection ──

export function detectBrowser(userAgent: string): BrowserType {
  if (userAgent.includes('Edg/')) {
    return 'edge'
  }
  if (userAgent.includes('Firefox/')) {
    return 'firefox'
  }
  if (
    userAgent.includes('Safari/') &&
    !userAgent.includes('Chrome/')
  ) {
    return 'safari'
  }
  if (userAgent.includes('Chrome/')) {
    return 'chrome'
  }
  return 'unknown'
}

// ── Side Panel Adapter ──

declare const browser: {
  sidebarAction: { open: () => Promise<void> }
  storage: { local: typeof chrome.storage.local }
}

export async function openSidePanel(
  browserType: BrowserType
): Promise<void> {
  if (browserType === 'firefox') {
    await browser.sidebarAction.open()
    return
  }
  await chrome.sidePanel.open({} as chrome.sidePanel.OpenOptions)
}

// ── Storage Adapter ──

export function getStorage(): StorageAdapter {
  return {
    async get(key: string): Promise<unknown> {
      const result = await chrome.storage.local.get([key])
      return result[key]
    },
    async set(key: string, value: unknown): Promise<void> {
      await chrome.storage.local.set({ [key]: value })
    },
    async remove(key: string): Promise<void> {
      await chrome.storage.local.remove(key)
    },
  }
}

// ── Manifest Conversion ──

export function convertManifest(
  chromeManifest: Record<string, unknown>
): Record<string, unknown> {
  let result = { ...chromeManifest }

  // side_panel → sidebar_action
  if (result.side_panel) {
    const sidePanel = result.side_panel as { default_path: string }
    result = {
      ...result,
      sidebar_action: { default_panel: sidePanel.default_path },
    }
    delete result.side_panel
  }

  // background.service_worker → background.scripts
  if (result.background) {
    const bg = result.background as Record<string, unknown>
    if (bg.service_worker) {
      result = {
        ...result,
        background: { scripts: [bg.service_worker as string] },
      }
    }
  }

  // host_permissions → merge into permissions
  if (result.host_permissions) {
    const hosts = result.host_permissions as string[]
    const perms = (result.permissions as string[]) ?? []
    result = {
      ...result,
      permissions: [...perms, ...hosts],
    }
    delete result.host_permissions
  }

  return result
}

// ── Feature Detection ──

export function isFeatureSupported(
  feature: BrowserFeature,
  browserType: BrowserType
): boolean {
  const supported = FEATURE_SUPPORT[feature]
  if (!supported) {
    return false
  }
  return supported.includes(browserType)
}
