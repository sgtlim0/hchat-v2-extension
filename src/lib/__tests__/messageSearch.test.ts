import { describe, it, expect } from 'vitest'
import { searchMessages, highlightMatch } from '../messageSearch'
import { ChatHistory } from '../chatHistory'

describe('searchMessages', () => {
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
    expect(results[0].convId).toBe(conv.id)
    expect(results[0].message.content).toContain('unique-keyword')
    expect(results[0].matchSnippet).toContain('unique-keyword')
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
