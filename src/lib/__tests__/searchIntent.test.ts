import { describe, it, expect } from 'vitest'
import { needsWebSearch, extractSearchQuery } from '../searchIntent'

describe('needsWebSearch', () => {
  it('returns false for short queries', () => {
    expect(needsWebSearch('hi')).toBe(false)
    expect(needsWebSearch('abc')).toBe(false)
  })

  it('detects time-related Korean keywords', () => {
    expect(needsWebSearch('최신 뉴스 알려줘')).toBe(true)
    expect(needsWebSearch('오늘 날씨 어때')).toBe(true)
    expect(needsWebSearch('2026년 올림픽 개최지')).toBe(true)
    expect(needsWebSearch('이번 주 인기 영화')).toBe(true)
  })

  it('detects factual Korean keywords', () => {
    expect(needsWebSearch('비트코인 가격 얼마야')).toBe(true)
    expect(needsWebSearch('환율 정보 알려줘')).toBe(true)
    expect(needsWebSearch('삼성전자 주가 얼마')).toBe(true)
  })

  it('detects English keywords', () => {
    expect(needsWebSearch('latest news about AI')).toBe(true)
    expect(needsWebSearch('how much is bitcoin today')).toBe(true)
    expect(needsWebSearch('current weather in Seoul')).toBe(true)
  })

  it('detects comparison queries', () => {
    expect(needsWebSearch('React vs Vue 비교해줘')).toBe(true)
    expect(needsWebSearch('iPhone versus Samsung')).toBe(true)
  })

  it('skips translation requests', () => {
    expect(needsWebSearch('이 문장 번역해줘')).toBe(false)
    expect(needsWebSearch('translate this to Korean')).toBe(false)
  })

  it('skips summarization requests', () => {
    expect(needsWebSearch('이 글 요약해줘')).toBe(false)
    expect(needsWebSearch('summarize this article')).toBe(false)
  })

  it('skips code requests', () => {
    expect(needsWebSearch('코드 작성해줘 React 컴포넌트')).toBe(false)
    expect(needsWebSearch('refactor this function')).toBe(false)
  })

  it('returns false for general chat', () => {
    expect(needsWebSearch('안녕하세요 반갑습니다')).toBe(false)
    expect(needsWebSearch('고마워요 잘 됐어요')).toBe(false)
  })
})

describe('extractSearchQuery', () => {
  it('removes punctuation', () => {
    expect(extractSearchQuery('뭐야?')).not.toContain('?')
    expect(extractSearchQuery('tell me!')).not.toContain('!')
  })

  it('removes Korean stopwords (space-delimited)', () => {
    const result = extractSearchQuery('비트코인 가격 을 알려줘')
    expect(result).not.toContain('을')
    expect(result).not.toContain('알려줘')
    expect(result).toContain('비트코인')
    expect(result).toContain('가격')
  })

  it('keeps particles attached to words (no morpheme split)', () => {
    // stopwords only match exact space-separated tokens
    const result = extractSearchQuery('비트코인 가격을 알려줘')
    expect(result).toContain('비트코인')
    expect(result).toContain('가격을') // particle attached → not a stopword
  })

  it('removes English stopwords', () => {
    const result = extractSearchQuery('what is the latest news')
    expect(result).not.toContain('what')
    expect(result).not.toContain('the')
    expect(result).toContain('latest')
    expect(result).toContain('news')
  })

  it('limits to 8 words', () => {
    const longQuery = 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10'
    const result = extractSearchQuery(longQuery)
    expect(result.split(' ').length).toBeLessThanOrEqual(8)
  })

  it('returns cleaned input when all words are stopwords', () => {
    const result = extractSearchQuery('is the a')
    // All removed → returns original cleaned
    expect(result).toBeTruthy()
  })

  it('handles empty-ish input', () => {
    const result = extractSearchQuery('   ')
    expect(result).toBeDefined()
  })
})
