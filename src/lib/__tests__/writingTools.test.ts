import { describe, it, expect, vi } from 'vitest'
import { WRITING_ACTIONS, buildWritingPrompt, type WritingAction } from '../writingTools'

vi.mock('../../i18n', () => ({
  getGlobalLocale: vi.fn(() => 'ko'),
}))

describe('writingTools', () => {
  describe('WRITING_ACTIONS', () => {
    it('defines all 11 writing actions', () => {
      expect(WRITING_ACTIONS).toHaveLength(11)
    })

    it('includes required action types', () => {
      const actionIds = WRITING_ACTIONS.map((a) => a.id)
      expect(actionIds).toContain('paraphrase')
      expect(actionIds).toContain('formal')
      expect(actionIds).toContain('casual')
      expect(actionIds).toContain('shorter')
      expect(actionIds).toContain('longer')
      expect(actionIds).toContain('grammar')
      expect(actionIds).toContain('translate_ko')
      expect(actionIds).toContain('translate_en')
      expect(actionIds).toContain('bullets')
      expect(actionIds).toContain('outline')
      expect(actionIds).toContain('explain')
    })

    it('each action has required properties', () => {
      for (const action of WRITING_ACTIONS) {
        expect(action.id).toBeTruthy()
        expect(action.labelKey).toBeTruthy()
        expect(action.emoji).toBeTruthy()
        expect(action.labelKey).toMatch(/^writing\./)
      }
    })

    it('action IDs are unique', () => {
      const ids = WRITING_ACTIONS.map((a) => a.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it('label keys are unique', () => {
      const keys = WRITING_ACTIONS.map((a) => a.labelKey)
      const uniqueKeys = new Set(keys)
      expect(uniqueKeys.size).toBe(keys.length)
    })
  })

  describe('buildWritingPrompt', () => {
    const testText = '테스트 텍스트입니다.'

    it('builds paraphrase prompt', () => {
      const prompt = buildWritingPrompt('paraphrase', testText)
      expect(prompt).toContain('다르게 표현')
      expect(prompt).toContain(testText)
    })

    it('builds formal prompt', () => {
      const prompt = buildWritingPrompt('formal', testText)
      expect(prompt).toContain('격식')
      expect(prompt).toContain(testText)
    })

    it('builds casual prompt', () => {
      const prompt = buildWritingPrompt('casual', testText)
      expect(prompt).toContain('친근하고')
      expect(prompt).toContain(testText)
    })

    it('builds shorter prompt', () => {
      const prompt = buildWritingPrompt('shorter', testText)
      expect(prompt).toContain('간결하게')
      expect(prompt).toContain(testText)
    })

    it('builds longer prompt', () => {
      const prompt = buildWritingPrompt('longer', testText)
      expect(prompt).toContain('상세하게')
      expect(prompt).toContain(testText)
    })

    it('builds grammar prompt', () => {
      const prompt = buildWritingPrompt('grammar', testText)
      expect(prompt).toContain('맞춤법')
      expect(prompt).toContain(testText)
    })

    it('builds Korean translation prompt', () => {
      const prompt = buildWritingPrompt('translate_ko', testText)
      expect(prompt).toContain('한국어')
      expect(prompt).toContain(testText)
    })

    it('builds English translation prompt', () => {
      const prompt = buildWritingPrompt('translate_en', testText)
      expect(prompt).toContain('영어')
      expect(prompt).toContain(testText)
    })

    it('builds bullets prompt', () => {
      const prompt = buildWritingPrompt('bullets', testText)
      expect(prompt).toContain('글머리 기호')
      expect(prompt).toContain(testText)
    })

    it('builds outline prompt', () => {
      const prompt = buildWritingPrompt('outline', testText)
      expect(prompt).toContain('개요')
      expect(prompt).toContain(testText)
    })

    it('builds explain prompt', () => {
      const prompt = buildWritingPrompt('explain', testText)
      expect(prompt).toContain('설명')
      expect(prompt).toContain(testText)
    })

    it('all prompts include {{content}} placeholder', () => {
      for (const action of WRITING_ACTIONS) {
        const prompt = buildWritingPrompt(action.id, testText)
        expect(prompt).toContain(testText)
        expect(prompt.length).toBeGreaterThan(testText.length)
      }
    })

    it('handles empty text', () => {
      const prompt = buildWritingPrompt('paraphrase', '')
      expect(prompt).toBeTruthy()
    })

    it('handles long text', () => {
      const longText = 'x'.repeat(10000)
      const prompt = buildWritingPrompt('paraphrase', longText)
      expect(prompt).toContain(longText)
    })

    it('handles special characters in text', () => {
      const specialText = '특수 문자: <>&"\'`\n\t\\/'
      const prompt = buildWritingPrompt('paraphrase', specialText)
      expect(prompt).toContain(specialText)
    })

    it('prompt format is consistent (instruction then text)', () => {
      for (const action of WRITING_ACTIONS) {
        const prompt = buildWritingPrompt(action.id, testText)
        const parts = prompt.split('\n\n')
        expect(parts.length).toBeGreaterThanOrEqual(2)
        expect(parts[parts.length - 1]).toBe(testText)
      }
    })

    it('uses English prompts when locale is en', async () => {
      const i18nModule = await import('../../i18n')
      vi.mocked(i18nModule.getGlobalLocale).mockReturnValueOnce('en')

      const prompt = buildWritingPrompt('paraphrase', 'Test text')
      expect(prompt).toContain('Rephrase')
      expect(prompt).toContain('Test text')
      expect(prompt).not.toContain('다르게')
    })
  })

  describe('prompt templates', () => {
    it('all actions have corresponding prompt templates', () => {
      const actionIds = WRITING_ACTIONS.map((a) => a.id)

      for (const id of actionIds) {
        const prompt = buildWritingPrompt(id as WritingAction, 'test')
        expect(prompt).toBeTruthy()
        expect(prompt).not.toBe('test')
      }
    })

    it('returns original text for unknown action', () => {
      const unknownAction = 'unknown_action' as WritingAction
      const text = '테스트'
      const prompt = buildWritingPrompt(unknownAction, text)
      // Should fallback gracefully
      expect(prompt).toBe(text)
    })
  })
})
