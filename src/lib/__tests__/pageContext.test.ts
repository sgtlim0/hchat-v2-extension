import { describe, it, expect, vi } from 'vitest'

vi.mock('../../i18n', () => ({
  getGlobalLocale: vi.fn(() => 'ko'),
}))

import { detectPageType, buildPageSystemPrompt } from '../pageContext'
import { getGlobalLocale } from '../../i18n'
import type { PageContext } from '../pageContext'

const mockedGetGlobalLocale = vi.mocked(getGlobalLocale)

function makeCtx(overrides: Partial<PageContext> = {}): PageContext {
  return {
    url: 'https://example.com',
    title: 'Test Page',
    text: 'Some page content here for testing',
    ts: Date.now(),
    ...overrides,
  }
}

describe('detectPageType', () => {
  it('detects code platforms', () => {
    expect(detectPageType('https://github.com/user/repo')).toBe('code')
    expect(detectPageType('https://gitlab.com/project')).toBe('code')
    expect(detectPageType('https://bitbucket.org/team/repo')).toBe('code')
  })

  it('detects video platforms', () => {
    expect(detectPageType('https://youtube.com/watch?v=123')).toBe('video')
    expect(detectPageType('https://youtu.be/abc')).toBe('video')
    expect(detectPageType('https://vimeo.com/123456')).toBe('video')
  })

  it('detects social platforms', () => {
    expect(detectPageType('https://twitter.com/user')).toBe('social')
    expect(detectPageType('https://x.com/user')).toBe('social')
    expect(detectPageType('https://reddit.com/r/javascript')).toBe('social')
    expect(detectPageType('https://threads.net/@user')).toBe('social')
  })

  it('detects documentation sites', () => {
    expect(detectPageType('https://docs.python.org')).toBe('docs')
    expect(detectPageType('https://react-documentation.com')).toBe('docs')
    expect(detectPageType('https://wiki.archlinux.org')).toBe('docs')
  })

  it('returns unknown for general sites', () => {
    expect(detectPageType('https://example.com')).toBe('unknown')
    expect(detectPageType('https://google.com/search?q=test')).toBe('unknown')
  })
})

describe('buildPageSystemPrompt', () => {
  it('builds Korean prompt by default', () => {
    mockedGetGlobalLocale.mockReturnValue('ko')
    const result = buildPageSystemPrompt(makeCtx())
    expect(result).toContain('현재 사용자가 보고 있는 웹페이지 정보')
    expect(result).toContain('Test Page')
    expect(result).toContain('https://example.com')
  })

  it('builds English prompt when locale is en', () => {
    mockedGetGlobalLocale.mockReturnValue('en')
    const result = buildPageSystemPrompt(makeCtx())
    expect(result).toContain('Current web page the user is viewing')
    expect(result).toContain('Test Page')
  })

  it('includes page type when not unknown', () => {
    mockedGetGlobalLocale.mockReturnValue('ko')
    const result = buildPageSystemPrompt(makeCtx({ meta: { type: 'code' } }))
    expect(result).toContain('code')
  })

  it('excludes page type when unknown', () => {
    mockedGetGlobalLocale.mockReturnValue('ko')
    const result = buildPageSystemPrompt(makeCtx({ meta: { type: 'unknown' } }))
    expect(result).not.toContain('유형:')
  })

  it('includes selection when present', () => {
    mockedGetGlobalLocale.mockReturnValue('ko')
    const result = buildPageSystemPrompt(makeCtx({ selection: 'selected text' }))
    expect(result).toContain('선택한 텍스트')
    expect(result).toContain('selected text')
  })

  it('includes English selection label for en locale', () => {
    mockedGetGlobalLocale.mockReturnValue('en')
    const result = buildPageSystemPrompt(makeCtx({ selection: 'selected text' }))
    expect(result).toContain('Selected text')
  })

  it('truncates long text to 3000 chars', () => {
    const longText = 'a'.repeat(5000)
    const result = buildPageSystemPrompt(makeCtx({ text: longText }))
    // The text in the result should be truncated
    const textLines = result.split('\n')
    const contentLine = textLines.find((l) => l.includes('aaa'))
    expect(contentLine!.length).toBeLessThanOrEqual(3000)
  })

  it('truncates selection to 500 chars', () => {
    const longSelection = 'b'.repeat(1000)
    mockedGetGlobalLocale.mockReturnValue('en')
    const result = buildPageSystemPrompt(makeCtx({ selection: longSelection }))
    // Selection should be truncated at 500 chars
    expect(result).toContain('b'.repeat(500))
    expect(result).not.toContain('b'.repeat(501))
  })
})
