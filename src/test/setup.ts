import '@testing-library/jest-dom/vitest'

// crypto.randomUUID polyfill (jsdom doesn't support it)
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      ...globalThis.crypto,
      randomUUID: () =>
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
        }),
    },
    writable: true,
  })
}

// --- Chrome API Mock ---

type StorageData = Record<string, unknown>
type ChangeListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
) => void

let storageData: StorageData = {}
const changeListeners: ChangeListener[] = []

function notifyListeners(changes: Record<string, chrome.storage.StorageChange>) {
  for (const listener of changeListeners) {
    listener(changes, 'local')
  }
}

const storageMock: chrome.storage.StorageArea = {
  get: vi.fn((keys, callback?) => {
    const result: StorageData = {}
    if (typeof keys === 'string') {
      if (keys in storageData) result[keys] = storageData[keys]
    } else if (Array.isArray(keys)) {
      for (const key of keys) {
        if (key in storageData) result[key] = storageData[key]
      }
    } else if (keys === null || keys === undefined) {
      Object.assign(result, storageData)
    }
    if (callback) {
      callback(result)
      return undefined as unknown as Promise<StorageData>
    }
    return Promise.resolve(result)
  }),

  set: vi.fn((items, callback?) => {
    const changes: Record<string, chrome.storage.StorageChange> = {}
    for (const [key, value] of Object.entries(items)) {
      changes[key] = { oldValue: storageData[key], newValue: value }
      storageData[key] = value
    }
    notifyListeners(changes)
    if (callback) {
      callback()
      return undefined as unknown as Promise<void>
    }
    return Promise.resolve()
  }),

  remove: vi.fn((keys, callback?) => {
    const changes: Record<string, chrome.storage.StorageChange> = {}
    const keyArray = typeof keys === 'string' ? [keys] : keys
    for (const key of keyArray) {
      if (key in storageData) {
        changes[key] = { oldValue: storageData[key] }
        delete storageData[key]
      }
    }
    notifyListeners(changes)
    if (callback) {
      callback()
      return undefined as unknown as Promise<void>
    }
    return Promise.resolve()
  }),

  clear: vi.fn((callback?) => {
    storageData = {}
    if (callback) {
      callback()
      return undefined as unknown as Promise<void>
    }
    return Promise.resolve()
  }),

  getBytesInUse: vi.fn(() => Promise.resolve(0)),
  setAccessLevel: vi.fn(() => Promise.resolve()),

  onChanged: {
    addListener: vi.fn((listener: ChangeListener) => {
      changeListeners.push(listener)
    }),
    removeListener: vi.fn((listener: ChangeListener) => {
      const idx = changeListeners.indexOf(listener)
      if (idx >= 0) changeListeners.splice(idx, 1)
    }),
    hasListener: vi.fn((listener: ChangeListener) => changeListeners.includes(listener)),
    hasListeners: vi.fn(() => changeListeners.length > 0),
    getRules: vi.fn(),
    removeRules: vi.fn(),
    addRules: vi.fn(),
  },
}

const chromeMock = {
  storage: {
    local: storageMock,
    sync: storageMock,
    onChanged: {
      addListener: vi.fn((listener: ChangeListener) => {
        changeListeners.push(listener)
      }),
      removeListener: vi.fn((listener: ChangeListener) => {
        const idx = changeListeners.indexOf(listener)
        if (idx >= 0) changeListeners.splice(idx, 1)
      }),
      hasListener: vi.fn(),
      hasListeners: vi.fn(),
      getRules: vi.fn(),
      removeRules: vi.fn(),
      addRules: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi.fn(() => Promise.resolve()),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(),
      hasListeners: vi.fn(),
      getRules: vi.fn(),
      removeRules: vi.fn(),
      addRules: vi.fn(),
    },
    getURL: vi.fn((path: string) => `chrome-extension://mock-id/${path}`),
    id: 'mock-extension-id',
    connect: vi.fn(() => ({
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      onDisconnect: { addListener: vi.fn(), removeListener: vi.fn() },
      postMessage: vi.fn(),
      disconnect: vi.fn(),
      name: '',
    })),
  },
  tabs: {
    query: vi.fn(() => Promise.resolve([])),
    sendMessage: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  scripting: {
    executeScript: vi.fn(),
  },
  contextMenus: {
    create: vi.fn(),
    removeAll: vi.fn(),
    onClicked: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(),
      hasListeners: vi.fn(),
      getRules: vi.fn(),
      removeRules: vi.fn(),
      addRules: vi.fn(),
    },
  },
}

Object.defineProperty(globalThis, 'chrome', { value: chromeMock, writable: true })

// Reset storage between tests
beforeEach(() => {
  storageData = {}
  changeListeners.length = 0
  vi.clearAllMocks()
})
