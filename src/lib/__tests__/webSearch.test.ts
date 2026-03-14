import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { webSearch, buildSearchContext, type SearchResult, type SearchOptions } from '../webSearch'

describe('webSearch', () => {
  beforeEach(async () => {
    await chrome.storage.local.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('DuckDuckGo search', () => {
    it('parses DuckDuckGo HTML results', async () => {
      const mockHtml = `
        <html>
          <body>
            <div class="result">
              <a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage1">Result 1</a>
              <div class="result__snippet">Snippet for result 1</div>
            </div>
            <div class="result">
              <a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage2">Result 2</a>
              <div class="result__snippet">Snippet for result 2</div>
            </div>
          </body>
        </html>
      `

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      })

      const results = await webSearch({ query: 'test query', maxResults: 5 })

      expect(results).toHaveLength(2)
      expect(results[0].title).toBe('Result 1')
      expect(results[0].url).toBe('https://example.com/page1')
      expect(results[0].snippet).toBe('Snippet for result 1')
    })

    it('respects maxResults limit', async () => {
      const mockHtml = `
        <html>
          <body>
            ${Array.from({ length: 10 }, (_, i) => `
              <div class="result">
                <a class="result__a" href="https://example.com/page${i}">Result ${i}</a>
                <div class="result__snippet">Snippet ${i}</div>
              </div>
            `).join('')}
          </body>
        </html>
      `

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      })

      const results = await webSearch({ query: 'test', maxResults: 3 })
      expect(results.length).toBeLessThanOrEqual(3)
    })

    it('returns empty array on fetch failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })

      const results = await webSearch({ query: 'test' })
      expect(results).toEqual([])
    })

    it('handles malformed HTML gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '<html><body><div>No results here</div></body></html>',
      })

      const results = await webSearch({ query: 'test' })
      expect(results).toEqual([])
    })

    it('encodes query parameters correctly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '<html></html>',
      })

      await webSearch({ query: 'test query with spaces & special chars' })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('test%20query%20with%20spaces%20%26%20special%20chars'),
        expect.anything()
      )
    })

    it('extracts actual URL from DuckDuckGo redirect', async () => {
      const mockHtml = `
        <html>
          <body>
            <div class="result">
              <a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.example.com%2Fpath">Result</a>
              <div class="result__snippet">Snippet</div>
            </div>
          </body>
        </html>
      `

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      })

      const results = await webSearch({ query: 'test' })
      expect(results[0].url).toBe('https://www.example.com/path')
    })
  })

  describe('Google Custom Search', () => {
    it('uses Google CSE when API key provided', async () => {
      const mockResponse = {
        items: [
          {
            title: 'Google Result 1',
            link: 'https://example.com/google1',
            snippet: 'Google snippet 1',
          },
          {
            title: 'Google Result 2',
            link: 'https://example.com/google2',
            snippet: 'Google snippet 2',
          },
        ],
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      })

      const results = await webSearch({
        query: 'test',
        maxResults: 5,
        googleApiKey: 'test-api-key',
        googleEngineId: 'test-engine-id',
      })

      expect(results).toHaveLength(2)
      expect(results[0].title).toBe('Google Result 1')
      expect(results[0].url).toBe('https://example.com/google1')
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('googleapis.com/customsearch'),
        undefined,
      )
    })

    it('returns empty array when Google CSE fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      })

      const results = await webSearch({
        query: 'test',
        googleApiKey: 'invalid-key',
        googleEngineId: 'invalid-engine',
      })

      expect(results).toEqual([])
    })

    it('handles empty items array', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: [] }),
      })

      const results = await webSearch({
        query: 'test',
        googleApiKey: 'test-key',
        googleEngineId: 'test-engine',
      })

      expect(results).toEqual([])
    })

    it('respects maxResults for Google CSE', async () => {
      const mockResponse = {
        items: Array.from({ length: 10 }, (_, i) => ({
          title: `Result ${i}`,
          link: `https://example.com/page${i}`,
          snippet: `Snippet ${i}`,
        })),
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      })

      const results = await webSearch({
        query: 'test',
        maxResults: 3,
        googleApiKey: 'test-key',
        googleEngineId: 'test-engine',
      })

      expect(results.length).toBeLessThanOrEqual(3)
    })
  })

  describe('caching', () => {
    it('caches search results', async () => {
      const mockHtml = `
        <html>
          <body>
            <div class="result">
              <a class="result__a" href="https://example.com/cached">Cached Result</a>
              <div class="result__snippet">Cached snippet</div>
            </div>
          </body>
        </html>
      `

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      })

      const results1 = await webSearch({ query: 'cache test' })
      const results2 = await webSearch({ query: 'cache test' })

      expect(results1).toEqual(results2)
      expect(global.fetch).toHaveBeenCalledTimes(1) // Cached on second call
    })

    it('returns cached results on second call', async () => {
      const mockHtml = `
        <html>
          <body>
            <div class="result">
              <a class="result__a" href="https://example.com">Result</a>
              <div class="result__snippet">Snippet</div>
            </div>
          </body>
        </html>
      `
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      })
      global.fetch = fetchSpy

      const results1 = await webSearch({ query: 'cache ttl test' })
      const results2 = await webSearch({ query: 'cache ttl test' })

      expect(results1).toEqual(results2)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    it('different queries have separate cache entries', async () => {
      const mockHtml = '<html><body></body></html>'
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      })

      await webSearch({ query: 'query 1' })
      await webSearch({ query: 'query 2' })

      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it('handles cache storage errors gracefully', async () => {
      const mockHtml = `
        <html>
          <body>
            <div class="result">
              <a class="result__a" href="https://example.com">Result</a>
              <div class="result__snippet">Snippet</div>
            </div>
          </body>
        </html>
      `

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      })

      // Mock storage.set to throw (e.g., quota exceeded)
      const originalSet = chrome.storage.local.set
      chrome.storage.local.set = vi.fn().mockRejectedValue(new Error('Quota exceeded'))

      const results = await webSearch({ query: 'test' })
      expect(results).toHaveLength(1) // Should still return results

      chrome.storage.local.set = originalSet
    })
  })

  describe('buildSearchContext', () => {
    const mockResults: SearchResult[] = [
      {
        title: 'Result 1',
        url: 'https://example.com/page1',
        snippet: 'This is the first result snippet',
      },
      {
        title: 'Result 2',
        url: 'https://example.com/page2',
        snippet: 'This is the second result snippet',
      },
      {
        title: 'Result 3',
        url: 'https://example.com/page3',
        snippet: 'This is the third result snippet',
      },
    ]

    it('builds formatted search context', () => {
      const context = buildSearchContext(mockResults)
      expect(context).toContain('[1] Result 1')
      expect(context).toContain('URL: https://example.com/page1')
      expect(context).toContain('This is the first result snippet')
      expect(context).toContain('[2] Result 2')
      expect(context).toContain('[3] Result 3')
    })

    it('returns empty string for no results', () => {
      const context = buildSearchContext([])
      expect(context).toBe('')
    })

    it('includes numbered list format', () => {
      const context = buildSearchContext(mockResults)
      expect(context).toMatch(/\[1\]/)
      expect(context).toMatch(/\[2\]/)
      expect(context).toMatch(/\[3\]/)
    })

    it('includes all result fields', () => {
      const context = buildSearchContext(mockResults)
      mockResults.forEach((result) => {
        expect(context).toContain(result.title)
        expect(context).toContain(result.url)
        expect(context).toContain(result.snippet)
      })
    })

    it('formats single result correctly', () => {
      const context = buildSearchContext([mockResults[0]])
      expect(context).toContain('[1] Result 1')
      expect(context).not.toContain('[2]')
    })
  })

  describe('default parameters', () => {
    it('uses maxResults default of 5', async () => {
      const mockHtml = `
        <html>
          <body>
            ${Array.from({ length: 10 }, (_, i) => `
              <div class="result">
                <a class="result__a" href="https://example.com/page${i}">Result ${i}</a>
                <div class="result__snippet">Snippet ${i}</div>
              </div>
            `).join('')}
          </body>
        </html>
      `

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      })

      const results = await webSearch({ query: 'test' })
      expect(results.length).toBeLessThanOrEqual(5)
    })
  })

  describe('error handling', () => {
    it('handles network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      await expect(webSearch({ query: 'test' })).rejects.toThrow('Network error')
    })

    it('handles empty query', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '<html></html>',
      })

      const results = await webSearch({ query: '' })
      expect(results).toEqual([])
    })
  })
})
