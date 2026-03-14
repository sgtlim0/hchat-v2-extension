import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SK } from '../storageKeys'

vi.mock('../../i18n', () => ({
  getGlobalLocale: vi.fn(() => 'ko'),
}))

vi.mock('../webSearch', () => ({
  webSearch: vi.fn(async () => []),
}))

import { BUILTIN_TOOLS } from '../agentTools'
import { getGlobalLocale } from '../../i18n'

const mockedGetGlobalLocale = vi.mocked(getGlobalLocale)

function findTool(name: string) {
  return BUILTIN_TOOLS.find((t) => t.name === name)!
}

beforeEach(() => {
  mockedGetGlobalLocale.mockReturnValue('ko')
})

describe('agentTools branch coverage', () => {
  describe('calculate tool', () => {
    const calc = findTool('calculate')

    it('evaluates basic math', async () => {
      expect(await calc.execute({ expression: '2 + 3' })).toBe('5')
    })

    it('evaluates multiplication', async () => {
      expect(await calc.execute({ expression: '10 * 5' })).toBe('50')
    })

    it('rejects forbidden characters', async () => {
      const result = await calc.execute({ expression: 'console.log("hack")' })
      expect(result).toContain('오류')
    })

    it('handles Math functions', async () => {
      expect(await calc.execute({ expression: 'Math.sqrt(16)' })).toBe('4')
    })

    it('handles Math.PI', async () => {
      const result = await calc.execute({ expression: 'Math.PI' })
      expect(parseFloat(result)).toBeCloseTo(Math.PI)
    })

    it('handles Math.E', async () => {
      const result = await calc.execute({ expression: 'Math.E' })
      expect(parseFloat(result)).toBeCloseTo(Math.E)
    })

    it('handles PI without Math prefix', async () => {
      const result = await calc.execute({ expression: 'PI' })
      expect(parseFloat(result)).toBeCloseTo(Math.PI)
    })

    it('rejects unknown Math functions', async () => {
      const result = await calc.execute({ expression: 'Math.evil(1)' })
      expect(result).toContain('오류')
    })

    it('handles multi-argument functions', async () => {
      expect(await calc.execute({ expression: 'Math.pow(2, 3)' })).toBe('8')
    })

    it('handles min/max', async () => {
      expect(await calc.execute({ expression: 'Math.min(3, 1, 2)' })).toBe('1')
      expect(await calc.execute({ expression: 'Math.max(3, 1, 2)' })).toBe('3')
    })

    it('handles modulo', async () => {
      expect(await calc.execute({ expression: '10 % 3' })).toBe('1')
    })

    it('handles power operator', async () => {
      expect(await calc.execute({ expression: '2 ^ 10' })).toBe('1024')
    })

    it('handles nested parentheses', async () => {
      expect(await calc.execute({ expression: '(2 + 3) * (4 - 1)' })).toBe('15')
    })

    it('uses English labels when locale is en', async () => {
      mockedGetGlobalLocale.mockReturnValue('en')
      const result = await calc.execute({ expression: 'bad$expr' })
      expect(result).toContain('Calculation error')
    })
  })

  describe('translate tool', () => {
    const translate = findTool('translate')

    it('returns error for empty text', async () => {
      expect(await translate.execute({ text: '', targetLang: 'English' })).toContain('오류')
    })

    it('returns English error for empty text in en locale', async () => {
      mockedGetGlobalLocale.mockReturnValue('en')
      expect(await translate.execute({ text: '', targetLang: 'English' })).toContain('Error')
    })

    it('generates translation prompt', async () => {
      const result = await translate.execute({ text: '안녕하세요', targetLang: '영어' })
      expect(result).toContain('영어')
      expect(result).toContain('안녕하세요')
    })

    it('generates English translation prompt', async () => {
      mockedGetGlobalLocale.mockReturnValue('en')
      const result = await translate.execute({ text: 'Hello', targetLang: 'Korean' })
      expect(result).toContain('translate')
      expect(result).toContain('Korean')
    })

    it('defaults targetLang to English', async () => {
      const result = await translate.execute({ text: 'test' })
      expect(result).toContain('test')
    })
  })

  describe('summarize_text tool', () => {
    const summarize = findTool('summarize_text')

    it('returns error for empty text', async () => {
      expect(await summarize.execute({ text: '' })).toContain('오류')
    })

    it('returns English error in en locale', async () => {
      mockedGetGlobalLocale.mockReturnValue('en')
      expect(await summarize.execute({ text: '' })).toContain('Error')
    })

    it('generates prompt with maxLength hint', async () => {
      const result = await summarize.execute({ text: 'long text', maxLength: '3문장' })
      expect(result).toContain('3문장')
    })

    it('generates English prompt with maxLength', async () => {
      mockedGetGlobalLocale.mockReturnValue('en')
      const result = await summarize.execute({ text: 'long text', maxLength: '100 words' })
      expect(result).toContain('100 words')
    })

    it('generates prompt without maxLength', async () => {
      const result = await summarize.execute({ text: 'some text' })
      expect(result).toContain('요약')
    })
  })

  describe('timestamp_convert tool', () => {
    const convert = findTool('timestamp_convert')

    it('returns error for empty value', async () => {
      expect(await convert.execute({ value: '' })).toContain('오류')
    })

    it('converts 10-digit Unix timestamp (seconds)', async () => {
      const result = await convert.execute({ value: '1704067200' })
      expect(result).toContain('Unix: 1704067200')
      expect(result).toContain('UTC:')
      expect(result).toContain('ISO:')
    })

    it('converts 13-digit Unix timestamp (ms)', async () => {
      const result = await convert.execute({ value: '1704067200000' })
      expect(result).toContain('Unix: 1704067200000')
    })

    it('converts date string to timestamp', async () => {
      const result = await convert.execute({ value: '2024-01-01' })
      expect(result).toContain('Unix (seconds):')
      expect(result).toContain('Unix (ms):')
    })

    it('returns error for invalid date string', async () => {
      const result = await convert.execute({ value: 'not a date' })
      expect(result).toContain('파싱할 수 없습니다')
    })

    it('returns English error for invalid date in en locale', async () => {
      mockedGetGlobalLocale.mockReturnValue('en')
      const result = await convert.execute({ value: 'not a date' })
      expect(result).toContain('Cannot parse')
    })

    it('returns English error for empty value in en locale', async () => {
      mockedGetGlobalLocale.mockReturnValue('en')
      expect(await convert.execute({ value: '' })).toContain('Error')
    })
  })

  describe('web_search tool', () => {
    const search = findTool('web_search')

    it('returns no results message in ko', async () => {
      const result = await search.execute({ query: 'test' })
      expect(result).toContain('검색 결과가 없습니다')
    })

    it('returns English no results message', async () => {
      mockedGetGlobalLocale.mockReturnValue('en')
      const result = await search.execute({ query: 'test' })
      expect(result).toContain('No search results')
    })
  })

  describe('read_page tool', () => {
    const readPage = findTool('read_page')

    it('returns no context message', async () => {
      const result = await readPage.execute({})
      expect(result).toContain('페이지 컨텍스트')
    })

    it('returns English no context message', async () => {
      mockedGetGlobalLocale.mockReturnValue('en')
      const result = await readPage.execute({})
      expect(result).toContain('Cannot read')
    })

    it('returns page content when available', async () => {
      await chrome.storage.local.set({
        [SK.PAGE_CONTEXT]: { title: 'Test', url: 'https://test.com', text: 'content', meta: { type: 'code' } },
      })
      const result = await readPage.execute({})
      expect(result).toContain('Test')
      expect(result).toContain('https://test.com')
      expect(result).toContain('content')
    })

    it('shows unknown type when meta.type is missing', async () => {
      await chrome.storage.local.set({
        [SK.PAGE_CONTEXT]: { title: 'Test', url: 'https://test.com', text: 'content' },
      })
      const result = await readPage.execute({})
      expect(result).toContain('unknown')
    })
  })

  describe('get_datetime tool', () => {
    const datetime = findTool('get_datetime')

    it('returns formatted date info', async () => {
      const result = await datetime.execute({})
      expect(result).toContain('날짜:')
      expect(result).toContain('요일:')
      expect(result).toContain('시간:')
      expect(result).toContain('타임존:')
      expect(result).toContain('Unix:')
    })
  })

  describe('tool descriptions change with locale', () => {
    it('returns Korean descriptions by default', () => {
      mockedGetGlobalLocale.mockReturnValue('ko')
      expect(findTool('web_search').description).toContain('검색')
      expect(findTool('calculate').description).toContain('계산')
    })

    it('returns English descriptions when locale is en', () => {
      mockedGetGlobalLocale.mockReturnValue('en')
      expect(findTool('web_search').description).toContain('Search')
      expect(findTool('calculate').description).toContain('math')
    })
  })
})
