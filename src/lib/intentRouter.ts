// lib/intentRouter.ts — 규칙 기반 사용자 의도 감지 및 도구/비서 추천 (LLM 호출 없음)
//
// i18n keys to add: intentRouter.translate, intentRouter.analyze, intentRouter.write,
// intentRouter.ocr, intentRouter.search, intentRouter.code, intentRouter.debate,
// intentRouter.generate, intentRouter.general, intentRouter.suggested, intentRouter.confidence

export type IntentType =
  | 'translate'
  | 'analyze'
  | 'write'
  | 'ocr'
  | 'search'
  | 'code'
  | 'debate'
  | 'generate'
  | 'general'

export interface DetectedIntent {
  type: IntentType
  confidence: number
  suggestedTool?: string
  suggestedAssistant?: string
  suggestedModel?: string
}

// --- 의도별 패턴 정의 ---

interface IntentPattern {
  type: IntentType
  /** 정확한 키워드 매칭 (confidence 0.9) */
  exact: RegExp[]
  /** 부분 패턴 매칭 (confidence 0.7) */
  partial: RegExp[]
}

const INTENT_PATTERNS: readonly IntentPattern[] = [
  {
    type: 'translate',
    exact: [
      /번역해/,
      /번역\s?해\s?줘/,
      /\btranslate\b/i,
    ],
    partial: [
      /번역/,
      /영어로/,
      /일본어로/,
      /한국어로/,
      /중국어로/,
      /\bin\s+english\b/i,
      /\bto\s+japanese\b/i,
      /\bto\s+korean\b/i,
      /\bto\s+chinese\b/i,
    ],
  },
  {
    type: 'analyze',
    exact: [
      /분석해/,
      /요약해/,
      /\banalyze\b/i,
      /\bsummarize\b/i,
    ],
    partial: [
      /분석/,
      /요약/,
      /데이터/,
      /통계/,
      /비교/,
      /\banalysis\b/i,
      /\bsummary\b/i,
      /\bstatistics?\b/i,
      /\bcompare\b/i,
    ],
  },
  {
    type: 'write',
    exact: [
      /작성해/,
      /글쓰기/,
      /\bwrite\b/i,
      /\bcompose\b/i,
      /\bdraft\b/i,
    ],
    partial: [
      /작성/,
      /문서/,
      /이메일/,
      /보고서/,
      /기획서/,
      /\bemail\b/i,
      /\breport\b/i,
      /\bessay\b/i,
      /\bletter\b/i,
    ],
  },
  {
    type: 'ocr',
    exact: [
      /\bOCR\b/i,
      /텍스트\s?추출/,
      /\bextract\s+text\b/i,
    ],
    partial: [
      /이미지.*텍스트/,
      /텍스트.*이미지/,
      /스캔/,
      /\bscan\b/i,
      /\bimage.*text\b/i,
    ],
  },
  {
    type: 'search',
    exact: [
      /검색해/,
      /찾아줘/,
      /\bsearch\b/i,
      /\bfind\b/i,
    ],
    partial: [
      /검색/,
      /찾아/,
      /최신/,
      /최근/,
      /뉴스/,
      /\blatest\b/i,
      /\bcurrent\b/i,
      /\bnews\b/i,
    ],
  },
  {
    type: 'code',
    exact: [
      /코드\s?작성/,
      /코드\s?수정/,
      /디버그/,
      /\bcode\b/i,
      /\bdebug\b/i,
      /\brefactor\b/i,
    ],
    partial: [
      /코드/,
      /프로그래밍/,
      /함수/,
      /버그/,
      /\bprogramming\b/i,
      /\bfunction\b/i,
      /\balgorithm\b/i,
      /\bAPI\b/,
    ],
  },
  {
    type: 'debate',
    exact: [
      /토론해/,
      /찬반\s?토론/,
      /\bdebate\b/i,
    ],
    partial: [
      /토론/,
      /비교\s?분석/,
      /찬반/,
      /논쟁/,
      /\bdiscuss\b/i,
      /\bpros\s+and\s+cons\b/i,
    ],
  },
  {
    type: 'generate',
    exact: [
      /이미지\s?생성/,
      /\bDALL-?E\b/i,
      /\bgenerate\s+image\b/i,
      /\bcreate\s+image\b/i,
    ],
    partial: [
      /생성/,
      /만들어/,
      /그려/,
      /\bgenerate\b/i,
      /\bcreate\b/i,
    ],
  },
] as const

// --- 도구/비서 매핑 ---

const TOOL_MAP: Readonly<Record<IntentType, string | null>> = {
  translate: 'translate',
  analyze: 'summarize_text',
  write: null,
  ocr: null,
  search: 'web_search',
  code: null,
  debate: null,
  generate: null,
  general: null,
}

const ASSISTANT_MAP: Readonly<Record<IntentType, string>> = {
  translate: 'ast-translator',
  analyze: 'ast-data-analyst',
  write: 'ast-email-writer',
  ocr: 'ast-default',
  search: 'ast-default',
  code: 'ast-code-reviewer',
  debate: 'ast-default',
  generate: 'ast-default',
  general: 'ast-default',
}

// --- 공개 함수 ---

/**
 * 입력 텍스트에서 사용자 의도를 규칙 기반으로 감지한다.
 * LLM 호출 없이 정규식 패턴 매칭으로 동작한다.
 */
export function detectIntent(text: string): DetectedIntent {
  const trimmed = text.trim()

  // 짧은 입력은 general로 처리
  if (trimmed.length < 5) {
    return {
      type: 'general',
      confidence: 0.3,
      suggestedAssistant: ASSISTANT_MAP.general,
    }
  }

  let bestType: IntentType = 'general'
  let bestConfidence = 0

  for (const pattern of INTENT_PATTERNS) {
    // 정확한 매칭 확인 (confidence 0.9)
    const hasExact = pattern.exact.some((re) => re.test(trimmed))
    if (hasExact && 0.9 > bestConfidence) {
      bestType = pattern.type
      bestConfidence = 0.9
      continue
    }

    // 부분 패턴 매칭 (confidence 0.7)
    const hasPartial = pattern.partial.some((re) => re.test(trimmed))
    if (hasPartial && 0.7 > bestConfidence) {
      bestType = pattern.type
      bestConfidence = 0.7
    }
  }

  // 매칭 없으면 general
  if (bestConfidence === 0) {
    return {
      type: 'general',
      confidence: 0.5,
      suggestedAssistant: ASSISTANT_MAP.general,
    }
  }

  const tool = TOOL_MAP[bestType]
  return {
    type: bestType,
    confidence: bestConfidence,
    ...(tool ? { suggestedTool: tool } : {}),
    suggestedAssistant: ASSISTANT_MAP[bestType],
  }
}

/**
 * 감지된 의도에 가장 적합한 비서 ID를 반환한다.
 */
export function recommendAssistant(intent: IntentType): string | null {
  return ASSISTANT_MAP[intent] ?? null
}

/**
 * 감지된 의도에 가장 적합한 도구 이름을 반환한다.
 * 매핑된 도구가 없으면 null을 반환한다.
 */
export function recommendTool(intent: IntentType): string | null {
  return TOOL_MAP[intent] ?? null
}
