// lib/searchIntent.ts — Rule-based web search intent detection (no LLM call)

const SEARCH_PATTERNS = [
  /최신|최근|오늘|이번\s?주|올해|2025|2026/,
  /가격|환율|날씨|뉴스|주가|시세|통계/,
  /누구|어디|몇|언제|얼마/,
  /검색해|찾아|알려줘.*최신|알아봐/,
  /현재|지금|실시간/,
  /비교해|vs\s|versus/i,
  /추천.*최신|최근.*추천/,
  /업데이트|패치|릴리스|출시/,
  /how much|latest|current|today|this week/i,
]

const SKIP_PATTERNS = [
  /번역해|translate/i,
  /요약해|summarize/i,
  /다듬어|rewrite/i,
  /코드.*작성|코드.*수정|refactor/i,
  /설명해.*개념|설명해.*원리/,
]

export function needsWebSearch(query: string): boolean {
  const trimmed = query.trim()
  if (trimmed.length < 5) return false

  if (SKIP_PATTERNS.some((p) => p.test(trimmed))) return false

  return SEARCH_PATTERNS.some((p) => p.test(trimmed))
}

const STOPWORDS = new Set([
  '에', '를', '을', '이', '가', '은', '는', '의', '에서', '으로', '로',
  '해줘', '알려줘', '찾아줘', '검색해줘', '해', '줘', '봐',
  '좀', '요', '다', '것', '수', '등', '및', '또는', '그리고',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
  'what', 'how', 'please', 'can', 'you', 'me', 'tell',
])

export function extractSearchQuery(userMessage: string): string {
  const cleaned = userMessage
    .replace(/[?？！!~.。]/g, '')
    .trim()

  const words = cleaned.split(/\s+/).filter((w) => !STOPWORDS.has(w) && w.length > 1)

  if (words.length === 0) return cleaned
  if (words.length > 8) return words.slice(0, 8).join(' ')

  return words.join(' ')
}
