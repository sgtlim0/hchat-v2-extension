import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../i18n', () => ({
  getGlobalLocale: vi.fn(() => 'ko'),
}))

import { getPageContext, isContextEnabled, setContextEnabled, buildPageSystemPrompt } from '../pageContext'
import { getGlobalLocale } from '../../i18n'
import type { PageContext } from '../pageContext'

const mockedGetGlobalLocale = vi.mocked(getGlobalLocale)

beforeEach(async () => {
  await chrome.storage.local.clear()
})

function makeCtx(overrides: Partial<PageContext> = {}): PageContext {
  return {
    url: 'https://example.com',
    title: 'Test',
    text: 'content',
    ts: Date.now(),
    ...overrides,
  }
}

describe('pageContext branch coverage', () => {
  describe('getPageContext', () => {
    it('returns null when no context stored', async () => {
      expect(await getPageContext()).toBeNull()
    })

    it('returns stored context', async () => {
      const ctx = makeCtx()
      await chrome.storage.local.set({ 'hchat:page-context': ctx })
      const result = await getPageContext()
      expect(result).toEqual(ctx)
    })
  })

  describe('isContextEnabled', () => {
    it('returns false by default', async () => {
      expect(await isContextEnabled()).toBe(false)
    })

    it('returns true when enabled', async () => {
      await setContextEnabled(true)
      expect(await isContextEnabled()).toBe(true)
    })
  })

  describe('setContextEnabled', () => {
    it('persists enabled state', async () => {
      await setContextEnabled(true)
      expect(await isContextEnabled()).toBe(true)
      await setContextEnabled(false)
      expect(await isContextEnabled()).toBe(false)
    })
  })

  describe('buildPageSystemPrompt branches', () => {
    it('includes type for English locale with known type', () => {
      mockedGetGlobalLocale.mockReturnValue('en')
      const result = buildPageSystemPrompt(makeCtx({ meta: { type: 'video' } }))
      expect(result).toContain('Type: video')
    })

    it('excludes type for English locale with unknown type', () => {
      mockedGetGlobalLocale.mockReturnValue('en')
      const result = buildPageSystemPrompt(makeCtx({ meta: { type: 'unknown' } }))
      expect(result).not.toContain('Type:')
    })

    it('excludes type when meta is undefined', () => {
      mockedGetGlobalLocale.mockReturnValue('ko')
      const result = buildPageSystemPrompt(makeCtx())
      expect(result).not.toContain('유형:')
    })

    it('excludes selection when not present for en', () => {
      mockedGetGlobalLocale.mockReturnValue('en')
      const result = buildPageSystemPrompt(makeCtx())
      expect(result).not.toContain('Selected text')
    })

    it('excludes selection when not present for ko', () => {
      mockedGetGlobalLocale.mockReturnValue('ko')
      const result = buildPageSystemPrompt(makeCtx())
      expect(result).not.toContain('선택한 텍스트')
    })
  })
})
