import { describe, it, expect, beforeEach } from 'vitest'
import {
  getStyles,
  saveStyle,
  updateStyle,
  deleteStyle,
  BUILTIN_STYLES,
  applyStyle,
  trackStyleUsage,
  getRecommendedStyle,
  type ResponseStyle,
} from '../responseTemplate'

beforeEach(async () => {
  await chrome.storage.local.clear()
})

describe('BUILTIN_STYLES', () => {
  it('contains 4 presets', () => {
    expect(BUILTIN_STYLES).toHaveLength(4)
  })

  it('all have builtin=true', () => {
    for (const style of BUILTIN_STYLES) {
      expect(style.builtin).toBe(true)
    }
  })

  it('includes concise, detailed, technical, casual', () => {
    const names = BUILTIN_STYLES.map((s) => s.id)
    expect(names).toContain('concise')
    expect(names).toContain('detailed')
    expect(names).toContain('technical')
    expect(names).toContain('casual')
  })

  it('builtin styles cannot be deleted', async () => {
    await expect(deleteStyle('concise')).rejects.toThrow()
  })
})

describe('CRUD - getStyles', () => {
  it('returns builtin styles when empty', async () => {
    const styles = await getStyles()
    expect(styles).toHaveLength(4)
    expect(styles.every((s) => s.builtin)).toBe(true)
  })

  it('returns builtin + custom styles', async () => {
    await saveStyle({
      name: 'My Style',
      tone: 'formal',
      lengthGuide: 'medium',
      formatHints: [],
      systemPromptSuffix: 'Be formal.',
    })
    const styles = await getStyles()
    expect(styles).toHaveLength(5)
  })
})

describe('CRUD - saveStyle', () => {
  it('creates a new style with id and createdAt', async () => {
    const style = await saveStyle({
      name: 'My Style',
      tone: 'formal',
      lengthGuide: 'short',
      formatHints: ['use bullet points'],
      systemPromptSuffix: 'Keep it short.',
    })
    expect(style.id).toBeTruthy()
    expect(style.createdAt).toBeGreaterThan(0)
    expect(style.usageCount).toBe(0)
    expect(style.name).toBe('My Style')
  })

  it('enforces max 20 custom styles', async () => {
    for (let i = 0; i < 20; i++) {
      await saveStyle({
        name: `Style ${i}`,
        tone: 'casual',
        lengthGuide: 'medium',
        formatHints: [],
        systemPromptSuffix: '',
      })
    }
    await expect(
      saveStyle({
        name: 'Style 21',
        tone: 'casual',
        lengthGuide: 'medium',
        formatHints: [],
        systemPromptSuffix: '',
      }),
    ).rejects.toThrow()
  })
})

describe('CRUD - updateStyle', () => {
  it('updates an existing custom style', async () => {
    const created = await saveStyle({
      name: 'Original',
      tone: 'formal',
      lengthGuide: 'short',
      formatHints: [],
      systemPromptSuffix: '',
    })
    const updated = await updateStyle(created.id, { name: 'Updated' })
    expect(updated.name).toBe('Updated')
    expect(updated.tone).toBe('formal')
  })

  it('throws for non-existent style', async () => {
    await expect(updateStyle('nonexistent', { name: 'X' })).rejects.toThrow()
  })
})

describe('CRUD - deleteStyle', () => {
  it('removes a custom style', async () => {
    const created = await saveStyle({
      name: 'To Delete',
      tone: 'casual',
      lengthGuide: 'long',
      formatHints: [],
      systemPromptSuffix: '',
    })
    await deleteStyle(created.id)
    const styles = await getStyles()
    expect(styles.find((s) => s.id === created.id)).toBeUndefined()
  })

  it('throws for non-existent style', async () => {
    await expect(deleteStyle('nonexistent')).rejects.toThrow()
  })
})

describe('applyStyle', () => {
  const baseStyle: ResponseStyle = {
    id: 'test',
    name: 'Test',
    tone: 'formal',
    lengthGuide: 'short',
    formatHints: [],
    systemPromptSuffix: '',
    usageCount: 0,
    createdAt: Date.now(),
  }

  it('cleans up excessive blank lines', () => {
    const input = 'Hello\n\n\n\nWorld\n\n\n\nEnd'
    const result = applyStyle(input, baseStyle)
    expect(result).not.toContain('\n\n\n')
    expect(result).toContain('Hello')
    expect(result).toContain('World')
  })

  it('adds language tag to bare code blocks', () => {
    const input = 'Before\n```\nconst x = 1;\n```\nAfter'
    const result = applyStyle(input, baseStyle)
    expect(result).toContain('```javascript')
  })

  it('preserves existing language tags', () => {
    const input = '```python\nprint("hi")\n```'
    const result = applyStyle(input, baseStyle)
    expect(result).toContain('```python')
  })

  it('returns empty string for empty response', () => {
    expect(applyStyle('', baseStyle)).toBe('')
  })

  it('appends length warning for long responses with short guide', () => {
    const longText = 'A'.repeat(300)
    const result = applyStyle(longText, { ...baseStyle, lengthGuide: 'short' })
    expect(result).toContain('---')
  })

  it('no warning for long guide', () => {
    const longText = 'A'.repeat(300)
    const result = applyStyle(longText, { ...baseStyle, lengthGuide: 'long' })
    expect(result).not.toContain('---')
  })
})

describe('trackStyleUsage', () => {
  it('increments usage count', async () => {
    const created = await saveStyle({
      name: 'Track Me',
      tone: 'casual',
      lengthGuide: 'medium',
      formatHints: [],
      systemPromptSuffix: '',
    })
    await trackStyleUsage(created.id)
    await trackStyleUsage(created.id)
    const styles = await getStyles()
    const found = styles.find((s) => s.id === created.id)
    expect(found?.usageCount).toBe(2)
  })

  it('does not throw for non-existent style id', async () => {
    await expect(trackStyleUsage('nonexistent')).resolves.toBeUndefined()
  })
})

describe('getRecommendedStyle', () => {
  it('returns null when no usage data', async () => {
    const result = await getRecommendedStyle()
    expect(result).toBeNull()
  })

  it('returns the most used style', async () => {
    const s1 = await saveStyle({
      name: 'Low',
      tone: 'formal',
      lengthGuide: 'short',
      formatHints: [],
      systemPromptSuffix: '',
    })
    const s2 = await saveStyle({
      name: 'High',
      tone: 'casual',
      lengthGuide: 'medium',
      formatHints: [],
      systemPromptSuffix: '',
    })
    await trackStyleUsage(s1.id)
    await trackStyleUsage(s2.id)
    await trackStyleUsage(s2.id)
    await trackStyleUsage(s2.id)

    const recommended = await getRecommendedStyle()
    expect(recommended?.id).toBe(s2.id)
  })
})

describe('Edge cases', () => {
  it('rejects empty style name', async () => {
    await expect(
      saveStyle({
        name: '',
        tone: 'formal',
        lengthGuide: 'short',
        formatHints: [],
        systemPromptSuffix: '',
      }),
    ).rejects.toThrow()
  })

  it('rejects duplicate style name', async () => {
    await saveStyle({
      name: 'Unique',
      tone: 'formal',
      lengthGuide: 'short',
      formatHints: [],
      systemPromptSuffix: '',
    })
    await expect(
      saveStyle({
        name: 'Unique',
        tone: 'casual',
        lengthGuide: 'medium',
        formatHints: [],
        systemPromptSuffix: '',
      }),
    ).rejects.toThrow()
  })
})
