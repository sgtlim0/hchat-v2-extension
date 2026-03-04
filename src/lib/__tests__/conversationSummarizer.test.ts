import { describe, it, expect, beforeEach } from 'vitest'
import {
  shouldSummarize,
  buildSummaryPrompt,
  extractTopics,
  saveSummaryEntry,
  loadLatestSummary,
  loadAllSummaries,
  deleteSummaries,
  buildSystemPromptInjection,
  getDefaultConfig,
  type SummaryConfig,
  type ConversationSummaryEntry,
} from '../conversationSummarizer'

beforeEach(async () => {
  await chrome.storage.local.clear()
})

// --- shouldSummarize ---

describe('shouldSummarize', () => {
  const baseConfig: SummaryConfig = { enabled: true, threshold: 20, maxCachePerConv: 5 }

  it('returns false when disabled', () => {
    expect(shouldSummarize(30, { ...baseConfig, enabled: false })).toBe(false)
  })

  it('returns false when messageCount < threshold', () => {
    expect(shouldSummarize(10, baseConfig)).toBe(false)
  })

  it('returns true when messageCount >= threshold', () => {
    expect(shouldSummarize(20, baseConfig)).toBe(true)
    expect(shouldSummarize(50, baseConfig)).toBe(true)
  })

  it('works with custom threshold', () => {
    expect(shouldSummarize(10, { ...baseConfig, threshold: 10 })).toBe(true)
  })

  it('returns false when messageCount equals threshold - 1', () => {
    expect(shouldSummarize(19, baseConfig)).toBe(false)
  })
})

// --- buildSummaryPrompt ---

describe('buildSummaryPrompt', () => {
  const instruction =
    '이 대화의 핵심 내용을 3-5문장으로 요약하세요. 주요 주제, 결정사항, 미해결 항목을 포함하세요.'

  it('includes instruction text', () => {
    const prompt = buildSummaryPrompt([{ role: 'user', content: 'hello' }])
    expect(prompt).toContain(instruction)
  })

  it('formats messages as "role: content"', () => {
    const prompt = buildSummaryPrompt([
      { role: 'user', content: '안녕하세요' },
      { role: 'assistant', content: '네, 안녕하세요' },
    ])
    expect(prompt).toContain('user: 안녕하세요')
    expect(prompt).toContain('assistant: 네, 안녕하세요')
  })

  it('limits to 30 messages', () => {
    const messages = Array.from({ length: 40 }, (_, i) => ({
      role: 'user',
      content: `msg-${i}`,
    }))
    const prompt = buildSummaryPrompt(messages)
    // 처음 10개 메시지(0~9)는 포함되지 않아야 함
    expect(prompt).not.toContain('msg-0')
    expect(prompt).not.toContain('msg-9')
    // 마지막 30개(10~39)는 포함
    expect(prompt).toContain('msg-10')
    expect(prompt).toContain('msg-39')
  })

  it('truncates long messages to 500 chars', () => {
    const longContent = 'A'.repeat(1000)
    const prompt = buildSummaryPrompt([{ role: 'user', content: longContent }])
    // "user: " 접두사 + 500자까지만
    const truncated = 'A'.repeat(500)
    expect(prompt).toContain(`user: ${truncated}`)
    expect(prompt).not.toContain('A'.repeat(501))
  })

  it('handles empty messages array', () => {
    const prompt = buildSummaryPrompt([])
    expect(prompt).toBe(instruction)
  })
})

// --- extractTopics ---

describe('extractTopics', () => {
  it('extracts repeated Korean words', () => {
    const text = '프로젝트 관리 시스템에서 프로젝트 생성하고 프로젝트 관리합니다.'
    const topics = extractTopics(text)
    expect(topics).toContain('프로젝트')
  })

  it('extracts repeated English words', () => {
    const text = 'The React component uses React hooks and React state management.'
    const topics = extractTopics(text)
    expect(topics.map((t) => t.toLowerCase())).toContain('react')
  })

  it('ignores short words (< 3 chars)', () => {
    const text = 'AI AI AI is is is do do do'
    const topics = extractTopics(text)
    // "AI"와 "is", "do" 모두 3자 미만
    expect(topics).toEqual([])
  })

  it('returns empty for short text', () => {
    const topics = extractTopics('짧은 글')
    expect(topics).toEqual([])
  })

  it('handles mixed Korean/English', () => {
    const text = 'React 컴포넌트 기반으로 React 패턴을 사용합니다. 컴포넌트 설계가 중요합니다.'
    const topics = extractTopics(text)
    expect(topics.map((t) => t.toLowerCase())).toContain('react')
    expect(topics).toContain('컴포넌트')
  })
})

// --- saveSummaryEntry / loadLatestSummary ---

describe('saveSummaryEntry / loadLatestSummary', () => {
  const makeEntry = (
    convId: string,
    summary: string,
    createdAt: number,
  ): ConversationSummaryEntry => ({
    convId,
    summary,
    messageCount: 20,
    createdAt,
  })

  it('saves and loads a summary', async () => {
    const entry = makeEntry('conv-1', '요약 내용', 1000)
    await saveSummaryEntry(entry)
    const loaded = await loadLatestSummary('conv-1')
    expect(loaded).toEqual(entry)
  })

  it('returns null for non-existent conv', async () => {
    const loaded = await loadLatestSummary('non-existent')
    expect(loaded).toBeNull()
  })

  it('FIFO: oldest removed when exceeding max cache (5)', async () => {
    for (let i = 0; i < 7; i++) {
      await saveSummaryEntry(makeEntry('conv-1', `요약 ${i}`, 1000 + i))
    }
    const all = await loadAllSummaries('conv-1')
    expect(all).toHaveLength(5)
    // 가장 오래된 2개(0, 1)는 제거됨
    expect(all.map((e) => e.summary)).not.toContain('요약 0')
    expect(all.map((e) => e.summary)).not.toContain('요약 1')
    // 최신 5개(2~6) 존재
    expect(all.map((e) => e.summary)).toContain('요약 2')
    expect(all.map((e) => e.summary)).toContain('요약 6')
  })

  it('multiple conversations are independent', async () => {
    await saveSummaryEntry(makeEntry('conv-1', '대화1 요약', 1000))
    await saveSummaryEntry(makeEntry('conv-2', '대화2 요약', 2000))
    const s1 = await loadLatestSummary('conv-1')
    const s2 = await loadLatestSummary('conv-2')
    expect(s1?.summary).toBe('대화1 요약')
    expect(s2?.summary).toBe('대화2 요약')
  })

  it('overwrites do not lose other conversations', async () => {
    await saveSummaryEntry(makeEntry('conv-1', '원본', 1000))
    await saveSummaryEntry(makeEntry('conv-2', '다른 대화', 2000))
    await saveSummaryEntry(makeEntry('conv-1', '업데이트', 3000))
    const s2 = await loadLatestSummary('conv-2')
    expect(s2?.summary).toBe('다른 대화')
  })

  it('loadLatestSummary returns most recent entry', async () => {
    await saveSummaryEntry(makeEntry('conv-1', '오래된 요약', 1000))
    await saveSummaryEntry(makeEntry('conv-1', '최신 요약', 5000))
    await saveSummaryEntry(makeEntry('conv-1', '중간 요약', 3000))
    const latest = await loadLatestSummary('conv-1')
    expect(latest?.summary).toBe('최신 요약')
  })
})

// --- loadAllSummaries ---

describe('loadAllSummaries', () => {
  const makeEntry = (
    convId: string,
    summary: string,
    createdAt: number,
  ): ConversationSummaryEntry => ({
    convId,
    summary,
    messageCount: 20,
    createdAt,
  })

  it('returns all summaries for conv (newest first)', async () => {
    await saveSummaryEntry(makeEntry('conv-1', '첫번째', 1000))
    await saveSummaryEntry(makeEntry('conv-1', '두번째', 2000))
    await saveSummaryEntry(makeEntry('conv-1', '세번째', 3000))
    const all = await loadAllSummaries('conv-1')
    expect(all).toHaveLength(3)
    expect(all[0].summary).toBe('세번째')
    expect(all[2].summary).toBe('첫번째')
  })

  it('returns empty array for non-existent conv', async () => {
    const all = await loadAllSummaries('non-existent')
    expect(all).toEqual([])
  })

  it('respects max cache limit', async () => {
    for (let i = 0; i < 8; i++) {
      await saveSummaryEntry(makeEntry('conv-1', `요약 ${i}`, 1000 + i))
    }
    const all = await loadAllSummaries('conv-1')
    expect(all.length).toBeLessThanOrEqual(5)
  })
})

// --- deleteSummaries ---

describe('deleteSummaries', () => {
  const makeEntry = (
    convId: string,
    summary: string,
    createdAt: number,
  ): ConversationSummaryEntry => ({
    convId,
    summary,
    messageCount: 20,
    createdAt,
  })

  it('deletes all summaries for conv', async () => {
    await saveSummaryEntry(makeEntry('conv-1', '요약1', 1000))
    await saveSummaryEntry(makeEntry('conv-1', '요약2', 2000))
    await deleteSummaries('conv-1')
    const all = await loadAllSummaries('conv-1')
    expect(all).toEqual([])
  })

  it('does not affect other conversations', async () => {
    await saveSummaryEntry(makeEntry('conv-1', '대화1', 1000))
    await saveSummaryEntry(makeEntry('conv-2', '대화2', 2000))
    await deleteSummaries('conv-1')
    const s2 = await loadLatestSummary('conv-2')
    expect(s2?.summary).toBe('대화2')
  })

  it('no-op for non-existent conv', async () => {
    // 오류 없이 실행되어야 함
    await expect(deleteSummaries('non-existent')).resolves.toBeUndefined()
  })
})

// --- buildSystemPromptInjection ---

describe('buildSystemPromptInjection', () => {
  it('wraps summary with markers', () => {
    const result = buildSystemPromptInjection('대화 요약 내용입니다.')
    expect(result).toBe('[이전 대화 요약]\n대화 요약 내용입니다.\n[현재 대화 계속]')
  })

  it('handles empty summary', () => {
    const result = buildSystemPromptInjection('')
    expect(result).toBe('[이전 대화 요약]\n\n[현재 대화 계속]')
  })
})

// --- getDefaultConfig ---

describe('getDefaultConfig', () => {
  it('returns correct defaults', () => {
    const config = getDefaultConfig()
    expect(config).toEqual({
      enabled: true,
      threshold: 20,
      maxCachePerConv: 5,
    })
  })
})
