import { describe, it, expect, beforeEach } from 'vitest'
import { analyzeStorage, formatBytes, cleanupOrphans, findOldConversations, deleteConversations } from '../storageManager'
import { SK } from '../storageKeys'

beforeEach(() => {
  // Clear all storage before each test
  chrome.storage.local.get = async () => ({})
  chrome.storage.local.set = async () => {}
  chrome.storage.local.remove = async () => {}
})

describe('formatBytes', () => {
  it('formats 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
  })

  it('formats bytes', () => {
    expect(formatBytes(512)).toBe('512 B')
  })

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB')
  })
})

describe('analyzeStorage', () => {
  it('returns zero breakdown for empty storage', async () => {
    chrome.storage.local.get = async () => ({})
    const result = await analyzeStorage()
    expect(result.total).toBe(0)
    expect(result.conversationCount).toBe(0)
  })

  it('categorizes storage by key prefix', async () => {
    const mockData: Record<string, unknown> = {
      [`${SK.CONV_PREFIX}abc`]: { messages: [{ content: 'hello' }] },
      [SK.CONV_INDEX]: [{ id: 'abc' }],
      [SK.BOOKMARKS]: [{ text: 'test' }],
      [`${SK.USAGE}:2026-03`]: [{ requests: 1 }],
      [SK.CONFIG]: { theme: 'dark' },
      'other-key': { data: 'something' },
    }
    chrome.storage.local.get = async () => mockData

    const result = await analyzeStorage()
    expect(result.total).toBeGreaterThan(0)
    expect(result.conversations).toBeGreaterThan(0)
    expect(result.bookmarks).toBeGreaterThan(0)
    expect(result.usage).toBeGreaterThan(0)
    expect(result.config).toBeGreaterThan(0)
    expect(result.other).toBeGreaterThan(0)
    expect(result.conversationCount).toBe(1)
  })
})

describe('findOldConversations', () => {
  it('finds conversations older than specified days', async () => {
    const oldDate = Date.now() - 100 * 24 * 60 * 60 * 1000 // 100 days ago
    const mockData: Record<string, unknown> = {
      [SK.CONV_INDEX]: [
        { id: 'old1', title: 'Old conv', updatedAt: oldDate, model: 'test' },
        { id: 'new1', title: 'New conv', updatedAt: Date.now(), model: 'test' },
        { id: 'pinned1', title: 'Pinned', updatedAt: oldDate, pinned: true, model: 'test' },
      ],
      [`${SK.CONV_PREFIX}old1`]: { messages: [{ content: 'a' }, { content: 'b' }] },
      [`${SK.CONV_PREFIX}new1`]: { messages: [{ content: 'c' }] },
      [`${SK.CONV_PREFIX}pinned1`]: { messages: [{ content: 'd' }] },
    }
    chrome.storage.local.get = async (key) => {
      if (key === null) return mockData
      if (typeof key === 'string') return { [key]: mockData[key] }
      return {}
    }

    const results = await findOldConversations(90)
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('old1')
    expect(results[0].messageCount).toBe(2)
  })
})

describe('deleteConversations', () => {
  it('removes conversations and updates index', async () => {
    const removed: string[] = []
    const stored: Record<string, unknown> = {}
    const mockData: Record<string, unknown> = {
      [SK.CONV_INDEX]: [
        { id: 'a', title: 'A', updatedAt: 1, model: 'test' },
        { id: 'b', title: 'B', updatedAt: 2, model: 'test' },
      ],
    }

    chrome.storage.local.get = async (key) => {
      if (typeof key === 'string') return { [key]: stored[key] ?? mockData[key] }
      return {}
    }
    chrome.storage.local.set = async (data) => { Object.assign(stored, data) }
    chrome.storage.local.remove = async (keys) => {
      const arr = Array.isArray(keys) ? keys : [keys]
      removed.push(...arr)
    }

    const count = await deleteConversations(['a'])
    expect(count).toBe(1)
    expect(removed).toContain(`${SK.CONV_PREFIX}a`)
    const newIndex = stored[SK.CONV_INDEX] as { id: string }[]
    expect(newIndex).toHaveLength(1)
    expect(newIndex[0].id).toBe('b')
  })

  it('returns 0 for empty array', async () => {
    const count = await deleteConversations([])
    expect(count).toBe(0)
  })
})

describe('cleanupOrphans', () => {
  it('removes orphaned conversation keys', async () => {
    const removed: string[] = []
    const mockData: Record<string, unknown> = {
      [SK.CONV_INDEX]: [{ id: 'a' }],
      [`${SK.CONV_PREFIX}a`]: { messages: [] },
      [`${SK.CONV_PREFIX}orphan1`]: { messages: [] },
      [`${SK.CONV_PREFIX}orphan2`]: { messages: [] },
    }

    chrome.storage.local.get = async (key) => {
      if (key === null) return mockData
      if (typeof key === 'string') return { [key]: mockData[key] }
      return {}
    }
    chrome.storage.local.remove = async (keys) => {
      const arr = Array.isArray(keys) ? keys : [keys]
      removed.push(...arr)
    }

    const count = await cleanupOrphans()
    expect(count).toBe(2)
    expect(removed).toContain(`${SK.CONV_PREFIX}orphan1`)
    expect(removed).toContain(`${SK.CONV_PREFIX}orphan2`)
    expect(removed).not.toContain(`${SK.CONV_PREFIX}a`)
  })

  it('returns 0 when no orphans', async () => {
    const mockData: Record<string, unknown> = {
      [SK.CONV_INDEX]: [{ id: 'a' }],
      [`${SK.CONV_PREFIX}a`]: { messages: [] },
    }

    chrome.storage.local.get = async (key) => {
      if (key === null) return mockData
      if (typeof key === 'string') return { [key]: mockData[key] }
      return {}
    }
    chrome.storage.local.remove = async () => {}

    const count = await cleanupOrphans()
    expect(count).toBe(0)
  })
})
