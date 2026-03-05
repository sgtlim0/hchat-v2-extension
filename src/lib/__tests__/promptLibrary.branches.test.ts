import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../i18n', () => ({
  t: vi.fn((key: string) => key),
}))

import { PromptLibrary } from '../promptLibrary'

beforeEach(async () => {
  await chrome.storage.local.clear()
})

describe('PromptLibrary branch coverage', () => {
  describe('save', () => {
    it('adds prompt to existing list', async () => {
      const p = await PromptLibrary.save({ title: 'Test', content: 'Content', category: 'test' })
      expect(p.id).toBeTruthy()
      expect(p.usageCount).toBe(0)
      expect(p.createdAt).toBeGreaterThan(0)

      const list = await PromptLibrary.list()
      expect(list.find((x) => x.id === p.id)).toBeTruthy()
    })
  })

  describe('update', () => {
    it('updates existing prompt', async () => {
      const p = await PromptLibrary.save({ title: 'Test', content: 'Old', category: 'test' })
      await PromptLibrary.update(p.id, { content: 'New' })
      const list = await PromptLibrary.list()
      expect(list.find((x) => x.id === p.id)!.content).toBe('New')
    })

    it('is no-op for non-existent id', async () => {
      await PromptLibrary.update('non-existent', { content: 'test' })
      // should not throw
    })
  })

  describe('delete', () => {
    it('removes prompt', async () => {
      const p = await PromptLibrary.save({ title: 'Test', content: 'Content', category: 'test' })
      await PromptLibrary.delete(p.id)
      const list = await PromptLibrary.list()
      expect(list.find((x) => x.id === p.id)).toBeUndefined()
    })
  })

  describe('incrementUsage', () => {
    it('increments usage count', async () => {
      const p = await PromptLibrary.save({ title: 'Test', content: 'Content', category: 'test' })
      await PromptLibrary.incrementUsage(p.id)
      await PromptLibrary.incrementUsage(p.id)
      const list = await PromptLibrary.list()
      expect(list.find((x) => x.id === p.id)!.usageCount).toBe(2)
    })

    it('is no-op for non-existent id', async () => {
      await PromptLibrary.incrementUsage('non-existent')
      // should not throw
    })
  })

  describe('searchByShortcut', () => {
    it('searches by title', async () => {
      await PromptLibrary.save({ title: 'React Tips', content: 'content', category: 'code' })
      const results = await PromptLibrary.searchByShortcut('react')
      expect(results.some((r) => r.title === 'React Tips')).toBe(true)
    })

    it('searches by shortcut', async () => {
      await PromptLibrary.save({ title: 'Test', content: 'content', category: 'test', shortcut: 'myshort' })
      const results = await PromptLibrary.searchByShortcut('myshort')
      expect(results.some((r) => r.shortcut === 'myshort')).toBe(true)
    })

    it('searches by category', async () => {
      await PromptLibrary.save({ title: 'Test', content: 'content', category: '분석' })
      const results = await PromptLibrary.searchByShortcut('분석')
      expect(results.length).toBeGreaterThan(0)
    })
  })

  describe('exportPrompts', () => {
    it('exports with version and timestamp', async () => {
      await PromptLibrary.save({ title: 'Test', content: 'Content', category: 'test' })
      const data = await PromptLibrary.exportPrompts()
      expect(data.version).toBe('1.0')
      expect(data.exportedAt).toBeTruthy()
      expect(data.prompts.length).toBeGreaterThan(0)
    })
  })

  describe('importPrompts', () => {
    it('imports valid prompts', async () => {
      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        prompts: [
          { id: 'imp-1', title: 'Imported', content: 'Content', category: 'test', usageCount: 0, createdAt: Date.now() },
        ],
      }
      const file = new File([JSON.stringify(exportData)], 'prompts.json')
      const count = await PromptLibrary.importPrompts(file)
      expect(count).toBe(1)
    })

    it('throws for oversized file', async () => {
      const file = new File(['x'], 'big.json')
      Object.defineProperty(file, 'size', { value: 11 * 1024 * 1024 })
      await expect(PromptLibrary.importPrompts(file)).rejects.toThrow('File too large')
    })

    it('throws for invalid JSON', async () => {
      const file = new File(['not json'], 'bad.json')
      await expect(PromptLibrary.importPrompts(file)).rejects.toThrow('Invalid JSON')
    })

    it('throws for missing version or prompts array', async () => {
      const file = new File([JSON.stringify({ foo: 'bar' })], 'bad.json')
      await expect(PromptLibrary.importPrompts(file)).rejects.toThrow('Invalid prompt file')
    })

    it('assigns new ID for duplicate IDs', async () => {
      const p = await PromptLibrary.save({ title: 'Existing', content: 'C', category: 'test' })
      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        prompts: [
          { id: p.id, title: 'Duplicate', content: 'Content', category: 'test', usageCount: 5, createdAt: Date.now() },
        ],
      }
      const file = new File([JSON.stringify(exportData)], 'prompts.json')
      await PromptLibrary.importPrompts(file)
      const list = await PromptLibrary.list()
      // Both should exist with different IDs
      const dupes = list.filter((x) => x.title === 'Duplicate' || x.title === 'Existing')
      expect(dupes.length).toBeGreaterThanOrEqual(2)
    })

    it('sanitizes XSS content', async () => {
      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        prompts: [
          { id: 'xss-1', title: '<script>alert(1)</script>', content: 'onclick=alert', category: 'test', usageCount: 0, createdAt: Date.now() },
        ],
      }
      const file = new File([JSON.stringify(exportData)], 'prompts.json')
      await PromptLibrary.importPrompts(file)
      const list = await PromptLibrary.list()
      const imported = list.find((x) => x.id === 'xss-1')
      expect(imported!.title).not.toContain('<script')
    })

    it('filters prompts without title or content', async () => {
      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        prompts: [
          { id: 'no-title', title: '', content: 'has content', category: 'test', usageCount: 0, createdAt: 0 },
          { id: 'no-content', title: 'has title', content: '', category: 'test', usageCount: 0, createdAt: 0 },
          { id: 'valid', title: 'Valid', content: 'Content', category: 'test', usageCount: 0, createdAt: 0 },
        ],
      }
      const file = new File([JSON.stringify(exportData)], 'prompts.json')
      const count = await PromptLibrary.importPrompts(file)
      expect(count).toBe(1)
    })

    it('defaults missing fields', async () => {
      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        prompts: [
          { id: 'min', title: 'Minimal', content: 'Content' },
        ],
      }
      const file = new File([JSON.stringify(exportData)], 'prompts.json')
      const count = await PromptLibrary.importPrompts(file)
      expect(count).toBe(1)

      const list = await PromptLibrary.list()
      const imported = list.find((x) => x.id === 'min')
      expect(imported!.usageCount).toBe(0)
      expect(imported!.category).toBe('글쓰기')
      expect(imported!.createdAt).toBeGreaterThan(0)
    })

    it('truncates shortcut', async () => {
      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        prompts: [
          { id: 'long-short', title: 'Test', content: 'C', shortcut: 'a'.repeat(100) },
        ],
      }
      const file = new File([JSON.stringify(exportData)], 'prompts.json')
      await PromptLibrary.importPrompts(file)
      const list = await PromptLibrary.list()
      const imported = list.find((x) => x.id === 'long-short')
      expect(imported!.shortcut!.length).toBeLessThanOrEqual(20)
    })
  })
})
