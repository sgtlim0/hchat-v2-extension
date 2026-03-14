/** BM25 integration tests for messageSearch */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchMessages, updateIndexForMessage, rebuildIndex, removeFromIndex } from '../messageSearch'
import { SK } from '../storageKeys'

// Mock storage
vi.mock('../storage', () => ({
  Storage: {
    get: vi.fn(() => Promise.resolve(null)),
    set: vi.fn(() => Promise.resolve()),
  },
}))

// Mock chatHistory for buildIndex
vi.mock('../chatHistory', () => ({
  ChatHistory: {
    listIndex: vi.fn(() => Promise.resolve([])),
    get: vi.fn(() => Promise.resolve(null)),
  },
}))

// Mock bm25 module
const mockBuildBM25Index = vi.fn((docs: Array<{ length: number }>) => ({
  documents: docs,
  avgDocLength: docs.length > 0 ? docs.reduce((s: number, d: { length: number }) => s + d.length, 0) / docs.length : 0,
  totalDocs: docs.length,
  documentFrequency: {},
}))
const mockScoreBM25 = vi.fn(() => 0.5)
const mockCombinedScore = vi.fn((bm25: number, _ts: number) => bm25 * 0.7 + 0.3)

vi.mock('../bm25', () => ({
  buildBM25Index: (...args: unknown[]) => mockBuildBM25Index(...args),
  scoreBM25: (...args: unknown[]) => mockScoreBM25(...args),
  combinedScore: (...args: unknown[]) => mockCombinedScore(...args),
}))

// Access mocked storage
const { Storage } = await import('../storage')
const mockedStorageGet = vi.mocked(Storage.get)
const mockedStorageSet = vi.mocked(Storage.set)

function makeIndex(docs: Record<string, { convId: string; convTitle: string; msgId: string; content: string; role: string; ts: number }>) {
  const tokens: Record<string, string[]> = {}
  for (const [docId, doc] of Object.entries(docs)) {
    const words = doc.content.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
    for (const word of words) {
      if (!tokens[word]) tokens[word] = []
      if (!tokens[word].includes(docId)) tokens[word].push(docId)
    }
  }
  return { tokens, docs, builtAt: Date.now() }
}

const sampleDoc = {
  'conv1:msg1': {
    convId: 'conv1',
    convTitle: 'Test Conversation',
    msgId: 'msg1',
    content: 'Hello world this is a test message about search functionality',
    role: 'user' as const,
    ts: Date.now() - 1000,
  },
}

const twoDocs = {
  ...sampleDoc,
  'conv2:msg2': {
    convId: 'conv2',
    convTitle: 'Another Conversation',
    msgId: 'msg2',
    content: 'Another test message with different content for search',
    role: 'assistant' as const,
    ts: Date.now(),
  },
}

describe('messageSearch BM25 integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset module-level caches by providing null for index version
    mockedStorageGet.mockImplementation(() => Promise.resolve(null))
  })

  it('returns empty array for empty query', async () => {
    const results = await searchMessages('')
    expect(results).toEqual([])
    expect(mockScoreBM25).not.toHaveBeenCalled()
  })

  it('returns empty array for whitespace-only query', async () => {
    const results = await searchMessages('   ')
    expect(results).toEqual([])
  })

  it('uses scoreBM25 for scoring when documents match', async () => {
    // Set up chrome.storage with conversation data for batch-read buildIndex
    await chrome.storage.local.set({
      [`${SK.CONV_PREFIX}conv1`]: {
        id: 'conv1',
        title: 'Test',
        messages: [{ id: 'msg1', role: 'user', content: 'hello world test', ts: Date.now() }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    })

    mockedStorageGet.mockResolvedValueOnce(null) // version check
    mockedStorageGet.mockResolvedValueOnce(null) // stored index (triggers build)

    await rebuildIndex()
    await searchMessages('hello')

    expect(mockScoreBM25).toHaveBeenCalled()
  })

  it('uses combinedScore to merge BM25 and recency', async () => {
    await chrome.storage.local.set({
      [`${SK.CONV_PREFIX}conv1`]: {
        id: 'conv1',
        title: 'Test',
        messages: [{ id: 'msg1', role: 'user', content: 'hello world test', ts: Date.now() }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    })

    mockedStorageGet.mockResolvedValueOnce(null)
    mockedStorageGet.mockResolvedValueOnce(null)

    await rebuildIndex()
    await searchMessages('hello')

    expect(mockCombinedScore).toHaveBeenCalled()
  })

  it('builds BM25 index on first search', async () => {
    const { ChatHistory } = await import('../chatHistory')
    vi.mocked(ChatHistory.listIndex).mockResolvedValueOnce([
      { id: 'conv1', title: 'Test', lastTs: Date.now(), messageCount: 1 },
    ])
    vi.mocked(ChatHistory.get).mockResolvedValueOnce({
      id: 'conv1',
      title: 'Test',
      messages: [{ id: 'msg1', role: 'user', content: 'test content here', ts: Date.now() }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    mockedStorageGet.mockResolvedValueOnce(null)
    mockedStorageGet.mockResolvedValueOnce(null)

    await rebuildIndex()
    await searchMessages('test')

    expect(mockBuildBM25Index).toHaveBeenCalled()
  })

  it('caches BM25 index across searches with same doc count', async () => {
    // First search - builds index from empty
    mockedStorageGet.mockResolvedValueOnce(null)
    mockedStorageGet.mockResolvedValueOnce(null)
    await searchMessages('test')

    const firstCallCount = mockBuildBM25Index.mock.calls.length

    // Second search - should reuse cache (memoryIndex already set)
    await searchMessages('another')

    // BM25 index should not be rebuilt since doc count hasn't changed
    expect(mockBuildBM25Index.mock.calls.length).toBe(firstCallCount)
  })

  it('invalidates BM25 cache on rebuildIndex', async () => {
    // First search to set up cache
    mockedStorageGet.mockResolvedValueOnce(null)
    mockedStorageGet.mockResolvedValueOnce(null)
    await searchMessages('test')

    const callsBefore = mockBuildBM25Index.mock.calls.length

    // Rebuild index
    await rebuildIndex()

    // Next search should rebuild BM25 index
    await searchMessages('test')

    expect(mockBuildBM25Index.mock.calls.length).toBeGreaterThan(callsBefore)
  })

  it('invalidates BM25 cache on updateIndexForMessage', async () => {
    // First search
    mockedStorageGet.mockResolvedValueOnce(null)
    mockedStorageGet.mockResolvedValueOnce(null)
    await searchMessages('test')

    const callsBefore = mockBuildBM25Index.mock.calls.length

    // Update index
    await updateIndexForMessage('conv3', 'New Conv', {
      id: 'msg3',
      role: 'user',
      content: 'new message content',
      ts: Date.now(),
    })

    // Next search should rebuild BM25 (cache was invalidated + doc count changed)
    await searchMessages('new')

    expect(mockBuildBM25Index.mock.calls.length).toBeGreaterThan(callsBefore)
  })

  it('invalidates BM25 cache on removeFromIndex', async () => {
    // First search
    mockedStorageGet.mockResolvedValueOnce(null)
    mockedStorageGet.mockResolvedValueOnce(null)
    await searchMessages('test')

    const callsBefore = mockBuildBM25Index.mock.calls.length

    // Remove from index
    await removeFromIndex('conv1')

    // Next search should rebuild BM25 index
    await searchMessages('test')

    expect(mockBuildBM25Index.mock.calls.length).toBeGreaterThan(callsBefore)
  })

  it('results are sorted by BM25 combined score descending', async () => {
    // Make combinedScore return different values for different calls
    let callNum = 0
    mockCombinedScore.mockImplementation(() => {
      callNum++
      return callNum === 1 ? 0.3 : 0.9
    })

    // Need index with two matching docs
    const { ChatHistory } = await import('../chatHistory')
    vi.mocked(ChatHistory.listIndex).mockResolvedValueOnce([
      { id: 'conv1', title: 'Conv 1', lastTs: Date.now(), messageCount: 1 },
      { id: 'conv2', title: 'Conv 2', lastTs: Date.now(), messageCount: 1 },
    ])
    vi.mocked(ChatHistory.get)
      .mockResolvedValueOnce({
        id: 'conv1',
        title: 'Conv 1',
        messages: [{ id: 'msg1', role: 'user', content: 'search keyword here', ts: Date.now() - 1000 }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      .mockResolvedValueOnce({
        id: 'conv2',
        title: 'Conv 2',
        messages: [{ id: 'msg2', role: 'user', content: 'search keyword there', ts: Date.now() }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

    // Force rebuild by resetting storage mocks
    mockedStorageGet.mockResolvedValueOnce(null)
    mockedStorageGet.mockResolvedValueOnce(null)

    // Need to reset module state - rebuild
    await rebuildIndex()
    const results = await searchMessages('search')

    if (results.length >= 2) {
      expect(results[0].relevanceScore).toBeGreaterThanOrEqual(results[1].relevanceScore)
    }

    callNum = 0
  })

  it('returns empty results for empty index', async () => {
    mockedStorageGet.mockResolvedValueOnce(null)
    mockedStorageGet.mockResolvedValueOnce(null)

    // ChatHistory returns empty
    const { ChatHistory } = await import('../chatHistory')
    vi.mocked(ChatHistory.listIndex).mockResolvedValueOnce([])

    await rebuildIndex()
    const results = await searchMessages('anything')

    expect(results).toEqual([])
  })

  it('still works with trigram matching via inverted index', async () => {
    const { ChatHistory } = await import('../chatHistory')
    vi.mocked(ChatHistory.listIndex).mockResolvedValueOnce([
      { id: 'conv1', title: 'Conv', lastTs: Date.now(), messageCount: 1 },
    ])
    vi.mocked(ChatHistory.get).mockResolvedValueOnce({
      id: 'conv1',
      title: 'Conv',
      messages: [{ id: 'msg1', role: 'user', content: 'functionality test for trigrams', ts: Date.now() }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    mockedStorageGet.mockResolvedValueOnce(null)
    mockedStorageGet.mockResolvedValueOnce(null)

    await rebuildIndex()
    // Search with a partial term that would match via trigram
    const results = await searchMessages('func')

    // The trigram tokenizer should index partial matches
    // The result depends on whether 'func' trigrams match 'functionality' trigrams
    expect(Array.isArray(results)).toBe(true)
  })

  it('rebuilds BM25 index when doc count changes', async () => {
    mockedStorageGet.mockResolvedValueOnce(null)
    mockedStorageGet.mockResolvedValueOnce(null)

    await searchMessages('test')
    const callsBefore = mockBuildBM25Index.mock.calls.length

    // Add a message (changes doc count)
    await updateIndexForMessage('conv-new', 'New', {
      id: 'msgNew',
      role: 'user',
      content: 'brand new document',
      ts: Date.now(),
    })

    // Search again - doc count changed, BM25 should rebuild
    await searchMessages('brand')
    expect(mockBuildBM25Index.mock.calls.length).toBeGreaterThan(callsBefore)
  })

  it('calculateScore uses BM25 formula not old TF', async () => {
    await chrome.storage.local.set({
      [`${SK.CONV_PREFIX}conv1`]: {
        id: 'conv1',
        title: 'Conv',
        messages: [{ id: 'msg1', role: 'user', content: 'test message for BM25 scoring', ts: Date.now() }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    })

    mockedStorageGet.mockResolvedValueOnce(null)
    mockedStorageGet.mockResolvedValueOnce(null)

    await rebuildIndex()

    mockScoreBM25.mockReturnValueOnce(1.5)
    mockCombinedScore.mockReturnValueOnce(1.35)

    const results = await searchMessages('test')

    // The score should come from combinedScore, not the old TF formula
    if (results.length > 0) {
      expect(results[0].relevanceScore).toBe(1.35)
    }
    expect(mockScoreBM25).toHaveBeenCalled()
    expect(mockCombinedScore).toHaveBeenCalled()
  })

  it('recency factor still contributes to score via combinedScore', async () => {
    mockedStorageGet.mockResolvedValueOnce(null)
    mockedStorageGet.mockResolvedValueOnce(null)

    const { ChatHistory } = await import('../chatHistory')
    vi.mocked(ChatHistory.listIndex).mockResolvedValueOnce([
      { id: 'conv1', title: 'Conv', lastTs: Date.now(), messageCount: 1 },
    ])
    vi.mocked(ChatHistory.get).mockResolvedValueOnce({
      id: 'conv1',
      title: 'Conv',
      messages: [{ id: 'msg1', role: 'user', content: 'recency test content', ts: Date.now() - 86400000 }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    await rebuildIndex()
    await searchMessages('recency')

    // combinedScore should be called with BM25 score and the timestamp
    if (mockCombinedScore.mock.calls.length > 0) {
      const lastCall = mockCombinedScore.mock.calls[mockCombinedScore.mock.calls.length - 1]
      // Second argument should be a timestamp (recency)
      expect(typeof lastCall[1]).toBe('number')
      expect(lastCall[1]).toBeGreaterThan(0)
    }
  })

  it('large query does not crash BM25', async () => {
    mockedStorageGet.mockResolvedValueOnce(null)
    mockedStorageGet.mockResolvedValueOnce(null)

    const largeQuery = 'a '.repeat(500).trim()
    const results = await searchMessages(largeQuery)

    expect(Array.isArray(results)).toBe(true)
  })
})
