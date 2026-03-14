/** 컨텍스트 자동 요약 — 대화 내용을 자동으로 요약하여 캐시 관리 */

import { Storage } from './storage'
import { SK } from './storageKeys'

const SUMMARIES_KEY = SK.CONV_SUMMARIES
const MAX_CACHE = 5
const MAX_MESSAGES = 30
const MAX_CONTENT_LENGTH = 500

export interface SummaryConfig {
  enabled: boolean
  threshold: number        // 요약 트리거 메시지 수 (기본 20)
  maxCachePerConv: number  // 대화당 최대 캐시 수 (기본 5)
}

export interface ConversationSummaryEntry {
  convId: string
  summary: string
  messageCount: number     // 요약된 메시지 수
  createdAt: number
}

type SummaryStore = Record<string, ConversationSummaryEntry[]>

/** 기본 설정 반환 */
export function getDefaultConfig(): SummaryConfig {
  return {
    enabled: true,
    threshold: 20,
    maxCachePerConv: MAX_CACHE,
  }
}

/** 대화가 요약이 필요한지 확인 */
export function shouldSummarize(messageCount: number, config: SummaryConfig): boolean {
  return config.enabled && messageCount >= config.threshold
}

/** 메시지 배열로부터 요약 프롬프트 생성 */
export function buildSummaryPrompt(
  messages: ReadonlyArray<{ role: string; content: string }>,
): string {
  const instruction =
    '이 대화의 핵심 내용을 3-5문장으로 요약하세요. 주요 주제, 결정사항, 미해결 항목을 포함하세요.'

  if (messages.length === 0) {
    return instruction
  }

  const recent = messages.slice(-MAX_MESSAGES)
  const formatted = recent
    .map((m) => `${m.role}: ${m.content.slice(0, MAX_CONTENT_LENGTH)}`)
    .join('\n')

  return `${formatted}\n\n${instruction}`
}

/** 요약 텍스트에서 주요 토픽 추출 (단순 키워드 추출) */
export function extractTopics(summary: string): string[] {
  if (!summary || summary.length < 10) {
    return []
  }

  // 한국어 단어 (3자 이상) + 영어 단어 (3자 이상) 추출
  const koreanWords = summary.match(/[가-힣]{3,}/g) ?? []
  const englishWords = summary.match(/[a-zA-Z]{3,}/g) ?? []
  const allWords = [...koreanWords, ...englishWords].map((w) => w.toLowerCase())

  // 등장 횟수 계산
  const counts = new Map<string, number>()
  for (const word of allWords) {
    counts.set(word, (counts.get(word) ?? 0) + 1)
  }

  // 2회 이상 등장한 단어만 반환 (원본 대소문자 유지를 위해 첫 등장 기준)
  const seen = new Set<string>()
  const topics: string[] = []

  for (const word of allWords) {
    const key = word.toLowerCase()
    if ((counts.get(key) ?? 0) >= 2 && !seen.has(key)) {
      seen.add(key)
      topics.push(word)
    }
  }

  return topics
}

/** 요약 저장소 로드 (내부 헬퍼) */
async function loadStore(): Promise<SummaryStore> {
  return (await Storage.get<SummaryStore>(SUMMARIES_KEY)) ?? {}
}

/** 요약 저장소 저장 (내부 헬퍼) */
async function saveStore(store: SummaryStore): Promise<void> {
  await Storage.set(SUMMARIES_KEY, store)
}

/** 대화 요약 엔트리 저장 (FIFO 캐시, 최대 5개) */
export async function saveSummaryEntry(entry: ConversationSummaryEntry): Promise<void> {
  const store = await loadStore()
  const existing = store[entry.convId] ?? []
  const updated = [...existing, entry]

  // FIFO: 최대 개수 초과 시 가장 오래된 항목 제거
  const trimmed = updated.length > MAX_CACHE
    ? updated.slice(updated.length - MAX_CACHE)
    : updated

  await saveStore({
    ...store,
    [entry.convId]: trimmed,
  })
}

/** 대화의 최신 요약 로드 */
export async function loadLatestSummary(
  convId: string,
): Promise<ConversationSummaryEntry | null> {
  const store = await loadStore()
  const entries = store[convId]

  if (!entries || entries.length === 0) {
    return null
  }

  // createdAt 기준 최신 항목 반환
  const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt)
  return sorted[0]
}

/** 대화의 모든 요약 로드 (최신순 정렬) */
export async function loadAllSummaries(
  convId: string,
): Promise<ConversationSummaryEntry[]> {
  const store = await loadStore()
  const entries = store[convId]

  if (!entries || entries.length === 0) {
    return []
  }

  return [...entries].sort((a, b) => b.createdAt - a.createdAt)
}

/** 대화의 모든 요약 삭제 */
export async function deleteSummaries(convId: string): Promise<void> {
  const store = await loadStore()

  if (!(convId in store)) {
    return
  }

  const { [convId]: _, ...rest } = store
  await saveStore(rest)
}

/** 요약을 시스템 프롬프트에 주입할 형태로 변환 */
export function buildSystemPromptInjection(summary: string): string {
  return `[이전 대화 요약]\n${summary}\n[현재 대화 계속]`
}
