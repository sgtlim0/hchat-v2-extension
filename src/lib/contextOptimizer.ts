/** 컨텍스트 옵티마이저 — 토큰 추정, 메시지 압축, 프롬프트 예산 관리 */

import type { ChatMessage } from './chatHistory'

// --- 상수 ---

const KOREAN_CHARS_PER_TOKEN = 2
const ENGLISH_CHARS_PER_TOKEN = 4
const DEFAULT_RESERVED_FOR_RESPONSE = 4096
const SYSTEM_BUDGET_RATIO = 0.2
const MESSAGE_BUDGET_RATIO = 0.8
const WARNING_THRESHOLD = 80

// --- 타입 ---

export interface ContextUsage {
  used: number
  total: number
  percentage: number
  warning: boolean
}

export interface PromptBudget {
  systemBudget: number
  messageBudget: number
}

// --- 한글 판별 ---

const KOREAN_RANGE = /[\u3131-\u3163\uac00-\ud7a3]/g
const NON_KOREAN_RANGE = /[^\u3131-\u3163\uac00-\ud7a3]/g

// --- 토큰 카운팅 ---

/** 텍스트의 토큰 수를 추정 (한글 2자/토큰, 영문 4자/토큰) */
export function estimateTokens(text: string): number {
  if (!text) return 0

  const koreanChars = (text.match(KOREAN_RANGE) ?? []).length
  const nonKoreanChars = (text.match(NON_KOREAN_RANGE) ?? []).length

  const koreanTokens = Math.ceil(koreanChars / KOREAN_CHARS_PER_TOKEN)
  const englishTokens = Math.ceil(nonKoreanChars / ENGLISH_CHARS_PER_TOKEN)

  return koreanTokens + englishTokens
}

/** 메시지 배열의 총 토큰 수 추정 */
export function estimateMessagesTokens(messages: readonly ChatMessage[]): number {
  let total = 0
  for (const msg of messages) {
    total += estimateTokens(msg.content ?? '')
  }
  return total
}

// --- 메시지 압축 ---

/** 토큰 한도 내로 메시지 선택 (최신 우선 + pinned 항상 포함) */
export function compressMessages(
  messages: readonly ChatMessage[],
  maxTokens: number,
): ChatMessage[] {
  if (messages.length === 0) return []

  const pinnedMessages = messages.filter((m) => m.pinned)
  const unpinnedMessages = messages.filter((m) => !m.pinned)

  const pinnedTokens = estimateMessagesTokens(pinnedMessages)
  const remainingBudget = maxTokens - pinnedTokens

  const selected: ChatMessage[] = [...pinnedMessages]

  if (remainingBudget > 0) {
    let usedTokens = 0
    const fromRecent: ChatMessage[] = []

    for (let i = unpinnedMessages.length - 1; i >= 0; i--) {
      const msgTokens = estimateTokens(unpinnedMessages[i].content ?? '')
      if (usedTokens + msgTokens <= remainingBudget) {
        fromRecent.unshift(unpinnedMessages[i])
        usedTokens += msgTokens
      }
    }

    selected.push(...fromRecent)
  }

  // 최소 1개 메시지는 반환 (마지막 메시지)
  if (selected.length === 0 && messages.length > 0) {
    return [messages[messages.length - 1]]
  }

  return selected.sort((a, b) => a.ts - b.ts)
}

// --- 시스템 프롬프트 예산 ---

/** 컨텍스트 윈도우에서 시스템/메시지 예산 계산 */
export function calculatePromptBudget(
  contextWindow: number,
  reservedForResponse: number = DEFAULT_RESERVED_FOR_RESPONSE,
): PromptBudget {
  const available = contextWindow - reservedForResponse

  if (available <= 0) {
    return { systemBudget: 0, messageBudget: 0 }
  }

  return {
    systemBudget: Math.floor(available * SYSTEM_BUDGET_RATIO),
    messageBudget: Math.floor(available * MESSAGE_BUDGET_RATIO),
  }
}

// --- 컨텍스트 모니터링 ---

/** 현재 컨텍스트 사용량 계산 */
export function getContextUsage(
  messages: readonly ChatMessage[],
  contextWindow: number,
): ContextUsage {
  const used = estimateMessagesTokens(messages)
  const percentage = contextWindow > 0
    ? (used / contextWindow) * 100
    : 0

  return {
    used,
    total: contextWindow,
    percentage: Math.round(percentage * 100) / 100,
    warning: percentage > WARNING_THRESHOLD,
  }
}
