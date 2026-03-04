import { describe, it, expect } from 'vitest'
import { detectIntent, recommendAssistant, recommendTool } from '../intentRouter'
import type { IntentType } from '../intentRouter'

// --- 1. detectIntent 기본 동작 (9 tests) ---

describe('detectIntent basic', () => {
  it('detects translate intent', () => {
    const result = detectIntent('이 문장을 번역해줘')
    expect(result.type).toBe('translate')
  })

  it('detects analyze intent', () => {
    const result = detectIntent('이 데이터를 분석해줘')
    expect(result.type).toBe('analyze')
  })

  it('detects write intent', () => {
    const result = detectIntent('보고서를 작성해주세요')
    expect(result.type).toBe('write')
  })

  it('detects ocr intent', () => {
    const result = detectIntent('이미지에서 텍스트 추출해줘')
    expect(result.type).toBe('ocr')
  })

  it('detects search intent', () => {
    const result = detectIntent('최신 뉴스를 검색해줘')
    expect(result.type).toBe('search')
  })

  it('detects code intent', () => {
    const result = detectIntent('이 코드를 디버그해줘')
    expect(result.type).toBe('code')
  })

  it('detects debate intent', () => {
    const result = detectIntent('AI에 대해 찬반 토론해줘')
    expect(result.type).toBe('debate')
  })

  it('detects generate intent', () => {
    const result = detectIntent('고양이 이미지 생성해줘')
    expect(result.type).toBe('generate')
  })

  it('returns general for unmatched input', () => {
    const result = detectIntent('안녕하세요 오늘 기분이 좋습니다')
    expect(result.type).toBe('general')
  })
})

// --- 2. 한국어 패턴 (9 tests) ---

describe('Korean patterns', () => {
  it('번역해 triggers translate', () => {
    expect(detectIntent('영어로 번역해').type).toBe('translate')
  })

  it('요약해 triggers analyze', () => {
    expect(detectIntent('이 글을 요약해주세요').type).toBe('analyze')
  })

  it('글쓰기 triggers write', () => {
    expect(detectIntent('이메일 글쓰기 도와줘').type).toBe('write')
  })

  it('텍스트 추출 triggers ocr', () => {
    expect(detectIntent('사진에서 텍스트 추출해줘').type).toBe('ocr')
  })

  it('검색 triggers search', () => {
    expect(detectIntent('인공지능 관련 검색해줘').type).toBe('search')
  })

  it('프로그래밍 triggers code', () => {
    expect(detectIntent('파이썬 프로그래밍 도와줘').type).toBe('code')
  })

  it('토론 triggers debate', () => {
    expect(detectIntent('원격근무에 대해 토론하자').type).toBe('debate')
  })

  it('이미지 생성 triggers generate', () => {
    expect(detectIntent('풍경 이미지 생성해줘').type).toBe('generate')
  })

  it('일반 한국어 triggers general', () => {
    expect(detectIntent('고마워요 잘 됐어요').type).toBe('general')
  })
})

// --- 3. 영어 패턴 (9 tests) ---

describe('English patterns', () => {
  it('translate triggers translate', () => {
    expect(detectIntent('Please translate this to Korean').type).toBe('translate')
  })

  it('analyze triggers analyze', () => {
    expect(detectIntent('Can you analyze this data?').type).toBe('analyze')
  })

  it('write triggers write', () => {
    expect(detectIntent('Write a professional email').type).toBe('write')
  })

  it('extract text triggers ocr', () => {
    expect(detectIntent('Extract text from this image').type).toBe('ocr')
  })

  it('search triggers search', () => {
    expect(detectIntent('Search for the latest AI news').type).toBe('search')
  })

  it('debug triggers code', () => {
    expect(detectIntent('Help me debug this function').type).toBe('code')
  })

  it('debate triggers debate', () => {
    expect(detectIntent('Let us debate about climate change').type).toBe('debate')
  })

  it('generate image triggers generate', () => {
    expect(detectIntent('Generate image of a sunset').type).toBe('generate')
  })

  it('general English triggers general', () => {
    expect(detectIntent('Hello, how are you doing today?').type).toBe('general')
  })
})

// --- 4. 신뢰도 점수 (6 tests) ---

describe('Confidence scoring', () => {
  it('exact keyword match returns 0.9', () => {
    const result = detectIntent('이 문장을 번역해주세요')
    expect(result.confidence).toBe(0.9)
  })

  it('partial pattern match returns 0.7', () => {
    const result = detectIntent('한국어로 바꿔주세요')
    expect(result.confidence).toBe(0.7)
  })

  it('short input (<5 chars) returns 0.3', () => {
    const result = detectIntent('안녕')
    expect(result.confidence).toBe(0.3)
    expect(result.type).toBe('general')
  })

  it('no match returns 0.5 for general', () => {
    const result = detectIntent('오늘 저녁 뭐 먹을까 고민이야')
    expect(result.type).toBe('general')
    expect(result.confidence).toBe(0.5)
  })

  it('multiple intent signals uses highest confidence', () => {
    // "번역해" (exact 0.9) should win over partial matches
    const result = detectIntent('이 코드 번역해줘')
    expect(result.confidence).toBe(0.9)
  })

  it('exact match takes priority over partial of different type', () => {
    // "분석해" is exact (0.9) for analyze
    const result = detectIntent('데이터를 분석해 주세요')
    expect(result.type).toBe('analyze')
    expect(result.confidence).toBe(0.9)
  })
})

// --- 5. 엣지 케이스 (6 tests) ---

describe('Edge cases', () => {
  it('handles empty string', () => {
    const result = detectIntent('')
    expect(result.type).toBe('general')
    expect(result.confidence).toBe(0.3)
  })

  it('handles very long input', () => {
    const longText = '이 문서를 분석해주세요. '.repeat(100)
    const result = detectIntent(longText)
    expect(result.type).toBe('analyze')
    expect(result.confidence).toBeGreaterThan(0)
  })

  it('handles mixed languages', () => {
    const result = detectIntent('Please 번역해줘 this sentence')
    expect(result.type).toBe('translate')
  })

  it('handles special characters', () => {
    const result = detectIntent('!!!@@@###$$$%%%')
    expect(result.type).toBe('general')
  })

  it('handles numbers only', () => {
    const result = detectIntent('123456789')
    expect(result.type).toBe('general')
  })

  it('handles URL input', () => {
    const result = detectIntent('https://example.com/page?q=test')
    expect(result.type).toBe('general')
  })
})

// --- 6. recommendAssistant (9 tests) ---

describe('recommendAssistant', () => {
  const cases: Array<[IntentType, string]> = [
    ['translate', 'ast-translator'],
    ['analyze', 'ast-data-analyst'],
    ['write', 'ast-email-writer'],
    ['ocr', 'ast-default'],
    ['search', 'ast-default'],
    ['code', 'ast-code-reviewer'],
    ['debate', 'ast-default'],
    ['generate', 'ast-default'],
    ['general', 'ast-default'],
  ]

  it.each(cases)('returns correct assistant for %s intent', (intent, expected) => {
    expect(recommendAssistant(intent)).toBe(expected)
  })
})

// --- 7. recommendTool (9 tests) ---

describe('recommendTool', () => {
  it('returns translate tool for translate intent', () => {
    expect(recommendTool('translate')).toBe('translate')
  })

  it('returns summarize_text tool for analyze intent', () => {
    expect(recommendTool('analyze')).toBe('summarize_text')
  })

  it('returns null for write intent', () => {
    expect(recommendTool('write')).toBeNull()
  })

  it('returns null for ocr intent', () => {
    expect(recommendTool('ocr')).toBeNull()
  })

  it('returns web_search tool for search intent', () => {
    expect(recommendTool('search')).toBe('web_search')
  })

  it('returns null for code intent', () => {
    expect(recommendTool('code')).toBeNull()
  })

  it('returns null for debate intent', () => {
    expect(recommendTool('debate')).toBeNull()
  })

  it('returns null for generate intent', () => {
    expect(recommendTool('generate')).toBeNull()
  })

  it('returns null for general intent', () => {
    expect(recommendTool('general')).toBeNull()
  })
})

// --- 8. 통합 테스트 (3 tests) ---

describe('Integration', () => {
  it('detectIntent includes valid suggestedTool when tool exists', () => {
    const result = detectIntent('이 문장을 영어로 번역해줘')
    expect(result.type).toBe('translate')
    expect(result.suggestedTool).toBe('translate')
    expect(result.suggestedAssistant).toBe('ast-translator')
  })

  it('detectIntent omits suggestedTool when no tool mapped', () => {
    const result = detectIntent('보고서를 작성해주세요')
    expect(result.type).toBe('write')
    expect(result.suggestedTool).toBeUndefined()
    expect(result.suggestedAssistant).toBe('ast-email-writer')
  })

  it('handles text with multiple intent signals returning highest confidence match', () => {
    // "번역해" (exact translate 0.9) vs "코드" (partial code 0.7)
    const result = detectIntent('코드를 번역해줘')
    expect(result.confidence).toBe(0.9)
    expect(result.type).toBe('translate')
  })
})
