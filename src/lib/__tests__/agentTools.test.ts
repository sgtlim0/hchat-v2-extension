import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BUILTIN_TOOLS } from '../agentTools'
import { SK } from '../storageKeys'

// Mock dependencies
vi.mock('../webSearch', () => ({
  webSearch: vi.fn(async () => [
    { title: '검색 결과 1', url: 'https://example.com/1', snippet: '내용 1' },
    { title: '검색 결과 2', url: 'https://example.com/2', snippet: '내용 2' },
  ]),
}))

vi.mock('../../i18n', () => ({
  getGlobalLocale: vi.fn(() => 'ko'),
}))

describe('agentTools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('safeEvalMath', () => {
    const calculateTool = BUILTIN_TOOLS.find((t) => t.name === 'calculate')!

    it('evaluates basic arithmetic', async () => {
      expect(await calculateTool.execute({ expression: '2+3' })).toBe('5')
      expect(await calculateTool.execute({ expression: '10/2' })).toBe('5')
      expect(await calculateTool.execute({ expression: '5*6' })).toBe('30')
      expect(await calculateTool.execute({ expression: '10-7' })).toBe('3')
    })

    it('handles operator precedence correctly', async () => {
      expect(await calculateTool.execute({ expression: '2+3*4' })).toBe('14')
      expect(await calculateTool.execute({ expression: '10-2*3' })).toBe('4')
      expect(await calculateTool.execute({ expression: '8/2+3' })).toBe('7')
    })

    it('evaluates expressions with parentheses', async () => {
      expect(await calculateTool.execute({ expression: '(2+3)*4' })).toBe('20')
      expect(await calculateTool.execute({ expression: '(10-5)/(2+3)' })).toBe('1')
      expect(await calculateTool.execute({ expression: '2*(3+4)' })).toBe('14')
    })

    it('handles decimals', async () => {
      expect(await calculateTool.execute({ expression: '1.5+2.5' })).toBe('4')
      expect(await calculateTool.execute({ expression: '10.5/2' })).toBe('5.25')
    })

    it('handles power operator', async () => {
      expect(await calculateTool.execute({ expression: '2^3' })).toBe('8')
      expect(await calculateTool.execute({ expression: '5^2' })).toBe('25')
    })

    it('handles modulo operator', async () => {
      expect(await calculateTool.execute({ expression: '10%3' })).toBe('1')
      expect(await calculateTool.execute({ expression: '7%2' })).toBe('1')
    })

    it('returns NaN for invalid expression', async () => {
      const result = await calculateTool.execute({ expression: 'invalid' })
      expect(result).toBe('NaN')
    })

    it('returns Infinity for division by zero', async () => {
      const result = await calculateTool.execute({ expression: '10/0' })
      expect(result).toBe('Infinity') // JavaScript behavior
    })

    it('rejects expressions with forbidden characters', async () => {
      // Characters like `, $, {, }, |, &, ;, >, < are rejected
      const result = await calculateTool.execute({ expression: '1; alert(1)' })
      expect(result).toContain('오류')
    })

    it('supports Math functions with positive args', async () => {
      const sqrtResult = await calculateTool.execute({ expression: 'Math.sqrt(16)' })
      expect(sqrtResult).toBe('4')

      const floorResult = await calculateTool.execute({ expression: 'Math.floor(3.7)' })
      expect(floorResult).toBe('3')
    })

    it('supports multi-argument Math functions', async () => {
      const maxResult = await calculateTool.execute({ expression: 'Math.max(1,5,3)' })
      expect(maxResult).toBe('5')

      const minResult = await calculateTool.execute({ expression: 'Math.min(1,5,3)' })
      expect(minResult).toBe('1')
    })
  })

  describe('get_datetime', () => {
    const datetimeTool = BUILTIN_TOOLS.find((t) => t.name === 'get_datetime')!

    it('returns current date and time', async () => {
      const result = await datetimeTool.execute({})
      expect(result).toContain('날짜:')
      expect(result).toContain('요일:')
      expect(result).toContain('시간:')
      expect(result).toContain('타임존:')
      expect(result).toContain('Unix:')
    })

    it('includes timestamp', async () => {
      const before = Date.now()
      const result = await datetimeTool.execute({})
      const after = Date.now()

      const unixMatch = result.match(/Unix: (\d+)/)
      expect(unixMatch).toBeTruthy()
      const timestamp = Number(unixMatch![1])
      expect(timestamp).toBeGreaterThanOrEqual(before)
      expect(timestamp).toBeLessThanOrEqual(after)
    })
  })

  describe('translate', () => {
    const translateTool = BUILTIN_TOOLS.find((t) => t.name === 'translate')!

    it('returns translation prompt', async () => {
      const result = await translateTool.execute({
        text: '안녕하세요',
        targetLang: 'English',
      })
      expect(result).toContain('번역')
      expect(result).toContain('English')
      expect(result).toContain('안녕하세요')
    })

    it('handles missing text', async () => {
      const result = await translateTool.execute({
        targetLang: 'English',
      })
      expect(result).toContain('오류')
    })
  })

  describe('summarize_text', () => {
    const summarizeTool = BUILTIN_TOOLS.find((t) => t.name === 'summarize_text')!

    it('returns summarization prompt', async () => {
      const result = await summarizeTool.execute({
        text: '긴 텍스트입니다. 여러 문장이 있습니다.',
      })
      expect(result).toContain('요약')
      expect(result).toContain('긴 텍스트입니다')
    })

    it('includes maxLength hint when provided', async () => {
      const result = await summarizeTool.execute({
        text: '텍스트',
        maxLength: '3문장',
      })
      expect(result).toContain('3문장')
    })

    it('handles missing text', async () => {
      const result = await summarizeTool.execute({})
      expect(result).toContain('오류')
    })
  })

  describe('timestamp_convert', () => {
    const timestampTool = BUILTIN_TOOLS.find((t) => t.name === 'timestamp_convert')!

    it('converts Unix timestamp to date', async () => {
      const result = await timestampTool.execute({ value: '1609459200' }) // 2021-01-01 00:00:00 UTC
      expect(result).toContain('Unix: 1609459200')
      expect(result).toContain('UTC:')
      expect(result).toContain('Local:')
      expect(result).toContain('ISO:')
    })

    it('converts millisecond timestamp', async () => {
      const result = await timestampTool.execute({ value: '1609459200000' })
      expect(result).toContain('Unix: 1609459200000')
    })

    it('converts date string to timestamp', async () => {
      const result = await timestampTool.execute({ value: '2021-01-01' })
      expect(result).toContain('Unix (seconds):')
      expect(result).toContain('Unix (ms):')
      expect(result).toContain('ISO:')
    })

    it('handles invalid timestamp', async () => {
      const result = await timestampTool.execute({ value: 'invalid' })
      expect(result).toContain('오류')
    })
  })

  describe('web_search', () => {
    const searchTool = BUILTIN_TOOLS.find((t) => t.name === 'web_search')!

    it('formats search results', async () => {
      const { webSearch } = await import('../webSearch')
      const result = await searchTool.execute({ query: '테스트 검색' })
      expect(webSearch).toHaveBeenCalledWith({ query: '테스트 검색', maxResults: 5 })
      expect(result).toContain('[1] 검색 결과 1')
      expect(result).toContain('https://example.com/1')
      expect(result).toContain('내용 1')
    })

    it('handles empty search results', async () => {
      const { webSearch } = await import('../webSearch')
      vi.mocked(webSearch).mockResolvedValueOnce([])
      const result = await searchTool.execute({ query: '없는 검색어' })
      expect(result).toContain('검색 결과가 없습니다')
    })
  })

  describe('read_page', () => {
    const readPageTool = BUILTIN_TOOLS.find((t) => t.name === 'read_page')!

    it('reads page context from storage', async () => {
      const mockContext = {
        title: '테스트 페이지',
        url: 'https://example.com',
        text: '페이지 내용입니다.',
        meta: { type: 'article' },
      }

      await chrome.storage.local.set({ [SK.PAGE_CONTEXT]: mockContext })

      const result = await readPageTool.execute({})
      expect(result).toContain('Title: 테스트 페이지')
      expect(result).toContain('URL: https://example.com')
      expect(result).toContain('Type: article')
      expect(result).toContain('페이지 내용입니다')
    })

    it('handles missing page context', async () => {
      const result = await readPageTool.execute({})
      expect(result).toContain('읽을 수 없습니다')
    })
  })

  describe('fetch_url', () => {
    const fetchUrlTool = BUILTIN_TOOLS.find((t) => t.name === 'fetch_url')!

    it('fetches and extracts text from URL', async () => {
      const mockHtml = `
        <html>
          <head><title>Test Page</title></head>
          <body>
            <nav>Navigation</nav>
            <main>
              <h1>Main Content</h1>
              <p>This is the main text.</p>
            </main>
            <footer>Footer</footer>
          </body>
        </html>
      `

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      })

      const result = await fetchUrlTool.execute({ url: 'https://example.com' })
      expect(result).toContain('Main Content')
      expect(result).toContain('This is the main text')
      expect(result).not.toContain('Navigation')
      expect(result).not.toContain('Footer')
    })

    it('handles HTTP errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      })

      const result = await fetchUrlTool.execute({ url: 'https://example.com/404' })
      expect(result).toContain('404')
    })

    it('handles fetch errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const result = await fetchUrlTool.execute({ url: 'https://example.com' })
      expect(result).toContain('실패')
    })

    it('truncates long content', async () => {
      const longText = 'x'.repeat(7000)
      const mockHtml = `<html><body><main>${longText}</main></body></html>`

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      })

      const result = await fetchUrlTool.execute({ url: 'https://example.com' })
      expect(result.length).toBeLessThanOrEqual(6000)
    })
  })

  describe('tool list completeness', () => {
    it('contains all 8 built-in tools', () => {
      expect(BUILTIN_TOOLS).toHaveLength(8)
      const toolNames = BUILTIN_TOOLS.map((t) => t.name)
      expect(toolNames).toContain('web_search')
      expect(toolNames).toContain('read_page')
      expect(toolNames).toContain('fetch_url')
      expect(toolNames).toContain('calculate')
      expect(toolNames).toContain('get_datetime')
      expect(toolNames).toContain('translate')
      expect(toolNames).toContain('summarize_text')
      expect(toolNames).toContain('timestamp_convert')
    })

    it('each tool has required properties', () => {
      for (const tool of BUILTIN_TOOLS) {
        expect(tool.name).toBeTruthy()
        expect(tool.description).toBeTruthy()
        expect(tool.parameters).toBeDefined()
        expect(tool.execute).toBeInstanceOf(Function)
      }
    })

    it('tools have unique names', () => {
      const names = BUILTIN_TOOLS.map((t) => t.name)
      const uniqueNames = new Set(names)
      expect(uniqueNames.size).toBe(names.length)
    })
  })
})
