import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PromptLibrary, type Prompt, type PromptExportData } from '../promptLibrary'

describe('PromptLibrary', () => {
  describe('list', () => {
    it('returns default prompts when nothing saved', async () => {
      const list = await PromptLibrary.list()
      expect(list.length).toBeGreaterThan(0)
      expect(list[0].id).toBe('p1')
    })
  })

  describe('save', () => {
    it('adds a new prompt', async () => {
      await PromptLibrary.save({ title: 'Test', content: 'test content', category: '코드' })
      const list = await PromptLibrary.list()
      const found = list.find((p) => p.title === 'Test')
      expect(found).toBeTruthy()
      expect(found?.category).toBe('코드')
      expect(found?.usageCount).toBe(0)
    })
  })

  describe('update', () => {
    it('updates an existing prompt', async () => {
      const saved = await PromptLibrary.save({ title: 'Original', content: 'orig', category: '글쓰기' })
      await PromptLibrary.update(saved.id, { title: 'Updated' })
      const list = await PromptLibrary.list()
      const found = list.find((p) => p.id === saved.id)
      expect(found?.title).toBe('Updated')
    })
  })

  describe('delete', () => {
    it('removes a prompt', async () => {
      const saved = await PromptLibrary.save({ title: 'ToDelete', content: 'x', category: '분석' })
      await PromptLibrary.delete(saved.id)
      const list = await PromptLibrary.list()
      expect(list.find((p) => p.id === saved.id)).toBeUndefined()
    })
  })

  describe('incrementUsage', () => {
    it('increments usage count', async () => {
      const saved = await PromptLibrary.save({ title: 'Count', content: 'c', category: '읽기' })
      await PromptLibrary.incrementUsage(saved.id)
      await PromptLibrary.incrementUsage(saved.id)
      const list = await PromptLibrary.list()
      const found = list.find((p) => p.id === saved.id)
      expect(found?.usageCount).toBe(2)
    })
  })

  describe('searchByShortcut', () => {
    it('searches by title', async () => {
      await PromptLibrary.save({ title: 'UniqueSearch', content: 'x', shortcut: 'us', category: '코드' })
      const results = await PromptLibrary.searchByShortcut('uniquesearch')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].title).toBe('UniqueSearch')
    })

    it('searches by shortcut prefix', async () => {
      await PromptLibrary.save({ title: 'T', content: 'x', shortcut: 'mysc', category: '코드' })
      const results = await PromptLibrary.searchByShortcut('mys')
      expect(results.length).toBeGreaterThan(0)
    })
  })

  describe('exportPrompts', () => {
    it('exports with version and prompts', async () => {
      const data = await PromptLibrary.exportPrompts()
      expect(data.version).toBe('1.0')
      expect(data.exportedAt).toBeTruthy()
      expect(Array.isArray(data.prompts)).toBe(true)
      expect(data.prompts.length).toBeGreaterThan(0)
    })
  })

  describe('importPrompts', () => {
    it('imports prompts from a file', async () => {
      const exportData: PromptExportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        prompts: [
          { id: 'imp1', title: 'Imported', content: 'imported content', category: '분석', usageCount: 5, createdAt: Date.now() },
        ],
      }
      const file = new File([JSON.stringify(exportData)], 'prompts.json', { type: 'application/json' })
      const count = await PromptLibrary.importPrompts(file)
      expect(count).toBe(1)
      const list = await PromptLibrary.list()
      expect(list.find((p) => p.title === 'Imported')).toBeTruthy()
    })

    it('assigns new id when id conflicts', async () => {
      const saved = await PromptLibrary.save({ title: 'Existing', content: 'x', category: '코드' })
      const exportData: PromptExportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        prompts: [
          { id: saved.id, title: 'Conflicting', content: 'y', category: '코드', usageCount: 0, createdAt: Date.now() },
        ],
      }
      const file = new File([JSON.stringify(exportData)], 'prompts.json', { type: 'application/json' })
      await PromptLibrary.importPrompts(file)
      const list = await PromptLibrary.list()
      const conflicting = list.find((p) => p.title === 'Conflicting')
      expect(conflicting).toBeTruthy()
      expect(conflicting?.id).not.toBe(saved.id)
    })

    it('throws on invalid format', async () => {
      const file = new File(['not json'], 'bad.json', { type: 'application/json' })
      await expect(PromptLibrary.importPrompts(file)).rejects.toThrow()
    })

    it('throws on missing version', async () => {
      const file = new File([JSON.stringify({ prompts: [] })], 'bad.json', { type: 'application/json' })
      await expect(PromptLibrary.importPrompts(file)).rejects.toThrow('Invalid prompt file format')
    })
  })
})
