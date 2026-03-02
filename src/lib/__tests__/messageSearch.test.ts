import { describe, it, expect, beforeEach } from 'vitest'
import { searchMessages, highlightMatch, rebuildIndex, updateIndexForMessage, removeFromIndex } from '../messageSearch'
import { ChatHistory } from '../chatHistory'
import { Storage } from '../storage'

describe('searchMessages', () => {
  beforeEach(async () => {
    // Clear storage before each test
    await Storage.remove('hchat:search-index')
    await Storage.remove('hchat:search-index-version')
  })

  it('returns empty for blank query', async () => {
    expect(await searchMessages('')).toEqual([])
    expect(await searchMessages('  ')).toEqual([])
  })

  it('finds matching messages', async () => {
    const conv = await ChatHistory.create('test-model')
    await ChatHistory.addMessage(conv.id, { role: 'user', content: 'Hello unique-keyword world' })
    await ChatHistory.addMessage(conv.id, { role: 'assistant', content: 'Response here' })

    const results = await searchMessages('unique-keyword')
    expect(results.length).toBeGreaterThan(0)
    // Find the specific result with the keyword
    const matchingResult = results.find((r) => r.message.content.includes('unique-keyword'))
    expect(matchingResult).toBeDefined()
    expect(matchingResult?.convId).toBe(conv.id)
    expect(matchingResult?.matchSnippet).toContain('unique-keyword')
    expect(matchingResult?.relevanceScore).toBeGreaterThan(0)
  })

  it('respects maxResults', async () => {
    const conv = await ChatHistory.create('test-model')
    for (let i = 0; i < 5; i++) {
      await ChatHistory.addMessage(conv.id, { role: 'user', content: `searchterm-limit message ${i}` })
    }
    const results = await searchMessages('searchterm-limit', 2)
    expect(results.length).toBe(2)
  })

  it('case-insensitive search', async () => {
    const conv = await ChatHistory.create('test-model')
    await ChatHistory.addMessage(conv.id, { role: 'user', content: 'CamelCaseWordXyz' })

    const results = await searchMessages('camelcasewordxyz')
    expect(results.length).toBeGreaterThan(0)
  })

  it('searches across multiple conversations', async () => {
    const conv1 = await ChatHistory.create('model')
    const conv2 = await ChatHistory.create('model')
    await ChatHistory.addMessage(conv1.id, { role: 'user', content: 'crossconv-marker-abc alpha' })
    await ChatHistory.addMessage(conv2.id, { role: 'user', content: 'crossconv-marker-abc beta' })

    const results = await searchMessages('crossconv-marker-abc')
    expect(results.length).toBe(2)
    const convIds = results.map((r) => r.convId)
    expect(convIds).toContain(conv1.id)
    expect(convIds).toContain(conv2.id)
  })

  it('ranks by relevance score', async () => {
    const conv = await ChatHistory.create('model')
    // Message with single occurrence
    const msg1 = await ChatHistory.addMessage(conv.id, { role: 'user', content: 'ranktest single occurrence' })
    // Message with multiple occurrences
    const msg2 = await ChatHistory.addMessage(conv.id, { role: 'user', content: 'ranktest ranktest ranktest multiple' })

    const results = await searchMessages('ranktest')
    expect(results.length).toBeGreaterThanOrEqual(2)
    // More occurrences should have higher score
    const score1 = results.find((r) => r.message.id === msg1.id)?.relevanceScore ?? 0
    const score2 = results.find((r) => r.message.id === msg2.id)?.relevanceScore ?? 0
    expect(score2).toBeGreaterThan(score1)
  })

  it('supports partial Korean text matching', async () => {
    const conv = await ChatHistory.create('model')
    await ChatHistory.addMessage(conv.id, { role: 'user', content: '안녕하세요 테스트입니다' })

    // Should match via trigrams
    const results = await searchMessages('하세요')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].message.content).toContain('안녕하세요')
  })

  it('searches in conversation titles', async () => {
    const conv = await ChatHistory.create('model')
    await ChatHistory.addMessage(conv.id, { role: 'user', content: 'First message to trigger title update' })
    // Title will be set to first 40 chars of first message
    await ChatHistory.addMessage(conv.id, { role: 'assistant', content: 'Response' })

    const results = await searchMessages('trigger')
    expect(results.length).toBeGreaterThan(0)
  })

  it('performs fast search on large dataset', async () => {
    // Create 100 conversations with 10 messages each
    const convs = []
    for (let i = 0; i < 100; i++) {
      const conv = await ChatHistory.create('model')
      convs.push(conv)
      for (let j = 0; j < 10; j++) {
        await ChatHistory.addMessage(conv.id, { role: 'user', content: `message ${i}-${j} with testmarker` })
      }
    }

    const start = Date.now()
    const results = await searchMessages('testmarker')
    const elapsed = Date.now() - start

    expect(results.length).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(100) // Should be under 100ms
  })
})

describe('updateIndexForMessage', () => {
  beforeEach(async () => {
    await Storage.remove('hchat:search-index')
    await Storage.remove('hchat:search-index-version')
  })

  it('incrementally updates index for new messages', async () => {
    const conv = await ChatHistory.create('model')
    const msg = await ChatHistory.addMessage(conv.id, { role: 'user', content: 'incremental-test message' })

    // Manually update index to verify it works independently
    await updateIndexForMessage(conv.id, conv.title, msg)

    const results = await searchMessages('incremental-test')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].message.id).toBe(msg.id)
  })
})

describe('removeFromIndex', () => {
  beforeEach(async () => {
    await Storage.remove('hchat:search-index')
    await Storage.remove('hchat:search-index-version')
  })

  it('removes conversation from index', async () => {
    const conv = await ChatHistory.create('model')
    await ChatHistory.addMessage(conv.id, { role: 'user', content: 'remove-test-xyz-unique message' })

    // Verify it's searchable
    let results = await searchMessages('remove-test-xyz-unique')
    const beforeCount = results.filter((r) => r.convId === conv.id).length
    expect(beforeCount).toBeGreaterThan(0)

    // Delete and remove from index
    await ChatHistory.delete(conv.id)

    // Should not be found anymore for this specific conversation
    results = await searchMessages('remove-test-xyz-unique')
    const afterCount = results.filter((r) => r.convId === conv.id).length
    expect(afterCount).toBe(0)
  })
})

describe('rebuildIndex', () => {
  beforeEach(async () => {
    await Storage.remove('hchat:search-index')
    await Storage.remove('hchat:search-index-version')
  })

  it('rebuilds entire index', async () => {
    const conv1 = await ChatHistory.create('model')
    const conv2 = await ChatHistory.create('model')
    await ChatHistory.addMessage(conv1.id, { role: 'user', content: 'rebuild-marker alpha' })
    await ChatHistory.addMessage(conv2.id, { role: 'user', content: 'rebuild-marker beta' })

    // Manually rebuild index
    await rebuildIndex()

    const results = await searchMessages('rebuild-marker')
    expect(results.length).toBe(2)
  })
})

describe('highlightMatch', () => {
  it('wraps matches in mark tags', () => {
    const result = highlightMatch('hello world', 'world')
    expect(result).toContain('<mark>world</mark>')
  })

  it('escapes HTML in snippet', () => {
    const result = highlightMatch('<script>alert("xss")</script>', 'script')
    expect(result).not.toContain('<script>')
    expect(result).toContain('&lt;')
  })

  it('returns escaped text for blank query', () => {
    const result = highlightMatch('hello <b>world</b>', '')
    expect(result).toBe('hello &lt;b&gt;world&lt;/b&gt;')
  })

  it('case-insensitive highlighting', () => {
    const result = highlightMatch('Hello HELLO hello', 'hello')
    expect(result).toContain('<mark>Hello</mark>')
    expect(result).toContain('<mark>HELLO</mark>')
    expect(result).toContain('<mark>hello</mark>')
  })
})
