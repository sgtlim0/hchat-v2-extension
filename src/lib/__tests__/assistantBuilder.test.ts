import { describe, it, expect, beforeEach } from 'vitest'
import { AssistantRegistry, getBuiltinAssistants, type CustomAssistant } from '../assistantBuilder'

describe('assistantBuilder', () => {
  describe('getBuiltinAssistants', () => {
    it('returns 20 built-in assistants', () => {
      const builtins = getBuiltinAssistants()
      expect(builtins).toHaveLength(20)
    })

    it('all builtins have isBuiltIn: true', () => {
      const builtins = getBuiltinAssistants()
      for (const b of builtins) {
        expect(b.isBuiltIn).toBe(true)
      }
    })

    it('all builtins have required fields', () => {
      const builtins = getBuiltinAssistants()
      for (const b of builtins) {
        expect(b.id).toBeTruthy()
        expect(b.name).toBeTruthy()
        expect(b.description).toBeTruthy()
        expect(b.icon).toBeTruthy()
        expect(b.systemPrompt).toBeTruthy()
        expect(b.category).toBeTruthy()
        expect(b.usageCount).toBe(0)
        expect(b.createdAt).toBe(0)
        expect(b.updatedAt).toBe(0)
      }
    })

    it('builtin IDs start with ast-', () => {
      const builtins = getBuiltinAssistants()
      for (const b of builtins) {
        expect(b.id).toMatch(/^ast-/)
      }
    })
  })

  describe('AssistantRegistry.list', () => {
    it('returns builtins when no custom assistants', async () => {
      const all = await AssistantRegistry.list()
      expect(all).toHaveLength(20)
      expect(all.every((a) => a.isBuiltIn)).toBe(true)
    })

    it('returns builtins + custom assistants', async () => {
      await AssistantRegistry.add({
        name: 'Custom One',
        description: 'Test',
        icon: '\u{1F9D1}',
        systemPrompt: 'You are helpful.',
        model: '',
        tools: [],
        parameters: {},
        category: 'other',
      })

      const all = await AssistantRegistry.list()
      expect(all).toHaveLength(21)
      expect(all[20].name).toBe('Custom One')
      expect(all[20].isBuiltIn).toBe(false)
    })
  })

  describe('AssistantRegistry.getCustom', () => {
    it('returns empty array initially', async () => {
      const custom = await AssistantRegistry.getCustom()
      expect(custom).toEqual([])
    })

    it('returns only custom assistants', async () => {
      await AssistantRegistry.add({
        name: 'My Assistant',
        description: 'Mine',
        icon: '\u{1F916}',
        systemPrompt: 'Hello',
        model: '',
        tools: [],
        parameters: {},
        category: 'General',
      })

      const custom = await AssistantRegistry.getCustom()
      expect(custom).toHaveLength(1)
      expect(custom[0].name).toBe('My Assistant')
    })
  })

  describe('AssistantRegistry.add', () => {
    it('creates with UUID, timestamps, and defaults', async () => {
      const before = Date.now()
      const result = await AssistantRegistry.add({
        name: 'Test',
        description: 'Desc',
        icon: '\u{2728}',
        systemPrompt: 'Prompt',
        model: 'us.anthropic.claude-sonnet-4-6',
        tools: ['web_search'],
        parameters: { temperature: 0.7 },
        category: 'Analysis',
      })

      expect(result.id).toBeTruthy()
      expect(result.id.length).toBeGreaterThan(10)
      expect(result.isBuiltIn).toBe(false)
      expect(result.usageCount).toBe(0)
      expect(result.createdAt).toBeGreaterThanOrEqual(before)
      expect(result.updatedAt).toBeGreaterThanOrEqual(before)
      expect(result.name).toBe('Test')
      expect(result.model).toBe('us.anthropic.claude-sonnet-4-6')
      expect(result.tools).toEqual(['web_search'])
      expect(result.parameters).toEqual({ temperature: 0.7 })
    })

    it('persists to storage', async () => {
      await AssistantRegistry.add({
        name: 'Persisted',
        description: 'D',
        icon: '\u{1F4DD}',
        systemPrompt: 'P',
        model: '',
        tools: [],
        parameters: {},
        category: 'General',
      })

      const raw = await chrome.storage.local.get('hchat:assistants')
      const stored = raw['hchat:assistants'] as CustomAssistant[]
      expect(stored).toHaveLength(1)
      expect(stored[0].name).toBe('Persisted')
    })
  })

  describe('AssistantRegistry.update', () => {
    it('patches correctly with immutable update', async () => {
      const added = await AssistantRegistry.add({
        name: 'Original',
        description: 'Desc',
        icon: '\u{1F916}',
        systemPrompt: 'Prompt',
        model: '',
        tools: [],
        parameters: {},
        category: 'General',
      })

      await AssistantRegistry.update(added.id, { name: 'Updated', model: 'gpt-4' })

      const found = await AssistantRegistry.getById(added.id)
      expect(found).toBeDefined()
      expect(found!.name).toBe('Updated')
      expect(found!.model).toBe('gpt-4')
      expect(found!.description).toBe('Desc')
      expect(found!.updatedAt).toBeGreaterThanOrEqual(added.updatedAt)
    })

    it('does nothing for nonexistent id', async () => {
      await AssistantRegistry.update('nonexistent', { name: 'Nope' })
      const custom = await AssistantRegistry.getCustom()
      expect(custom).toHaveLength(0)
    })
  })

  describe('AssistantRegistry.remove', () => {
    it('deletes custom assistant', async () => {
      const added = await AssistantRegistry.add({
        name: 'Delete Me',
        description: 'D',
        icon: '\u{274C}',
        systemPrompt: 'P',
        model: '',
        tools: [],
        parameters: {},
        category: 'General',
      })

      await AssistantRegistry.remove(added.id)
      const custom = await AssistantRegistry.getCustom()
      expect(custom).toHaveLength(0)
    })

    it('cannot delete builtin assistant', async () => {
      await AssistantRegistry.remove('ast-default')
      const all = await AssistantRegistry.list()
      const found = all.find((a) => a.id === 'ast-default')
      expect(found).toBeDefined()
    })

    it('does nothing for nonexistent id', async () => {
      await AssistantRegistry.add({
        name: 'Keep',
        description: 'D',
        icon: '\u{2705}',
        systemPrompt: 'P',
        model: '',
        tools: [],
        parameters: {},
        category: 'General',
      })

      await AssistantRegistry.remove('nonexistent')
      const custom = await AssistantRegistry.getCustom()
      expect(custom).toHaveLength(1)
    })
  })

  describe('AssistantRegistry.getActive/setActive', () => {
    it('returns ast-default by default', async () => {
      const active = await AssistantRegistry.getActive()
      expect(active).toBe('ast-default')
    })

    it('persists active assistant id', async () => {
      await AssistantRegistry.setActive('ast-translator')
      const active = await AssistantRegistry.getActive()
      expect(active).toBe('ast-translator')
    })
  })

  describe('AssistantRegistry.getById', () => {
    it('returns builtin by id', async () => {
      const found = await AssistantRegistry.getById('ast-default')
      expect(found).toBeDefined()
      expect(found!.isBuiltIn).toBe(true)
    })

    it('returns custom by id', async () => {
      const added = await AssistantRegistry.add({
        name: 'Find Me',
        description: 'D',
        icon: '\u{1F50D}',
        systemPrompt: 'P',
        model: '',
        tools: [],
        parameters: {},
        category: 'General',
      })

      const found = await AssistantRegistry.getById(added.id)
      expect(found).toBeDefined()
      expect(found!.name).toBe('Find Me')
    })

    it('returns undefined for nonexistent id', async () => {
      const found = await AssistantRegistry.getById('nonexistent')
      expect(found).toBeUndefined()
    })
  })

  describe('AssistantRegistry.incrementUsage', () => {
    it('increments usage count for custom assistant', async () => {
      const added = await AssistantRegistry.add({
        name: 'Counter',
        description: 'D',
        icon: '\u{1F522}',
        systemPrompt: 'P',
        model: '',
        tools: [],
        parameters: {},
        category: 'General',
      })

      expect(added.usageCount).toBe(0)

      await AssistantRegistry.incrementUsage(added.id)
      await AssistantRegistry.incrementUsage(added.id)
      await AssistantRegistry.incrementUsage(added.id)

      const found = await AssistantRegistry.getById(added.id)
      expect(found!.usageCount).toBe(3)
    })

    it('does nothing for builtin assistant', async () => {
      await AssistantRegistry.incrementUsage('ast-default')
      // No error thrown, builtin usage stays at 0
      const found = await AssistantRegistry.getById('ast-default')
      expect(found!.usageCount).toBe(0)
    })

    it('does nothing for nonexistent id', async () => {
      // Should not throw
      await AssistantRegistry.incrementUsage('nonexistent')
    })
  })

  describe('storage integrity', () => {
    it('maintains data integrity after multiple operations', async () => {
      const a1 = await AssistantRegistry.add({
        name: 'First',
        description: 'D1',
        icon: '\u{0031}\u{FE0F}\u{20E3}',
        systemPrompt: 'P1',
        model: '',
        tools: [],
        parameters: {},
        category: 'General',
      })
      const a2 = await AssistantRegistry.add({
        name: 'Second',
        description: 'D2',
        icon: '\u{0032}\u{FE0F}\u{20E3}',
        systemPrompt: 'P2',
        model: '',
        tools: ['web_search'],
        parameters: { temperature: 0.5 },
        category: 'Analysis',
      })

      await AssistantRegistry.update(a1.id, { name: 'First Updated' })
      await AssistantRegistry.remove(a2.id)

      const custom = await AssistantRegistry.getCustom()
      expect(custom).toHaveLength(1)
      expect(custom[0].name).toBe('First Updated')
      expect(custom[0].id).toBe(a1.id)
    })

    it('add uses immutable pattern (no mutation)', async () => {
      const a1 = await AssistantRegistry.add({
        name: 'A',
        description: 'D',
        icon: '\u{2B50}',
        systemPrompt: 'P',
        model: '',
        tools: [],
        parameters: {},
        category: 'General',
      })
      const a2 = await AssistantRegistry.add({
        name: 'B',
        description: 'D',
        icon: '\u{2B50}',
        systemPrompt: 'P',
        model: '',
        tools: [],
        parameters: {},
        category: 'General',
      })

      // Verify both exist
      const custom = await AssistantRegistry.getCustom()
      expect(custom).toHaveLength(2)
      expect(custom[0].id).toBe(a1.id)
      expect(custom[1].id).toBe(a2.id)
    })
  })

  describe('v5.0 Features - Assistant Marketplace', () => {
    describe('Built-in assistants expansion', () => {
      it('each new assistant has required fields', () => {
        const builtins = getBuiltinAssistants()
        const newAssistants = builtins.slice(8, 20) // 12 new assistants
        for (const a of newAssistants) {
          expect(a.id).toBeTruthy()
          expect(a.name).toBeTruthy()
          expect(a.description).toBeTruthy()
          expect(a.icon).toBeTruthy()
          expect(a.systemPrompt).toBeTruthy()
          expect(a.category).toBeTruthy()
          expect(a.isBuiltIn).toBe(true)
          expect(a.usageCount).toBe(0)
        }
      })

      it('all built-in assistants have category', () => {
        const builtins = getBuiltinAssistants()
        for (const b of builtins) {
          expect(b.category).toBeTruthy()
          expect(typeof b.category).toBe('string')
        }
      })

      it('category values are valid enum values', () => {
        const builtins = getBuiltinAssistants()
        const validCategories = ['translate', 'document', 'analysis', 'code', 'writing', 'other']
        for (const b of builtins) {
          expect(validCategories).toContain(b.category)
        }
      })
    })

    describe('AssistantRegistry.exportAssistants', () => {
      it('returns valid JSON with version', async () => {
        await AssistantRegistry.add({
          name: 'Export Test',
          description: 'Test',
          icon: '\u{1F4BE}',
          systemPrompt: 'Test',
          model: '',
          tools: [],
          parameters: {},
          category: 'other',
        })

        const json = await AssistantRegistry.exportAssistants()
        const parsed = JSON.parse(json)

        expect(parsed).toHaveProperty('version')
        expect(parsed).toHaveProperty('exportedAt')
        expect(parsed).toHaveProperty('assistants')
        expect(Array.isArray(parsed.assistants)).toBe(true)
        expect(parsed.assistants.length).toBeGreaterThan(0)
      })

      it('exports specific IDs only', async () => {
        const a1 = await AssistantRegistry.add({
          name: 'Export 1',
          description: 'D1',
          icon: '\u{1F4BE}',
          systemPrompt: 'P1',
          model: '',
          tools: [],
          parameters: {},
          category: 'other',
        })
        await AssistantRegistry.add({
          name: 'Export 2',
          description: 'D2',
          icon: '\u{1F4BE}',
          systemPrompt: 'P2',
          model: '',
          tools: [],
          parameters: {},
          category: 'other',
        })

        const json = await AssistantRegistry.exportAssistants([a1.id])
        const parsed = JSON.parse(json)

        expect(parsed.assistants).toHaveLength(1)
        expect(parsed.assistants[0].name).toBe('Export 1')
      })
    })

    describe('AssistantRegistry.importAssistants', () => {
      it('imports assistants with valid data', async () => {
        const exportData = {
          version: 1,
          exportedAt: Date.now(),
          assistants: [
            {
              id: 'test-id-1',
              name: 'Import Test 1',
              description: 'Test',
              icon: '\u{1F4E5}',
              systemPrompt: 'Test',
              model: '',
              tools: [],
              parameters: {},
              category: 'other',
              isBuiltIn: false,
              usageCount: 5,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ],
        }

        const result = await AssistantRegistry.importAssistants(JSON.stringify(exportData))
        expect(result.imported).toBe(1)
        expect(result.skipped).toBe(0)

        const custom = await AssistantRegistry.getCustom()
        const imported = custom.find((a) => a.name === 'Import Test 1')
        expect(imported).toBeDefined()
        expect(imported!.id).not.toBe('test-id-1') // New ID generated
        expect(imported!.usageCount).toBe(0) // Reset to 0
      })

      it('skips duplicate names', async () => {
        await AssistantRegistry.add({
          name: 'Duplicate Name',
          description: 'Original',
          icon: '\u{1F4E5}',
          systemPrompt: 'Original',
          model: '',
          tools: [],
          parameters: {},
          category: 'other',
        })

        const exportData = {
          version: 1,
          exportedAt: Date.now(),
          assistants: [
            {
              id: 'test-id',
              name: 'Duplicate Name',
              description: 'Should be skipped',
              icon: '\u{1F4E5}',
              systemPrompt: 'Test',
              model: '',
              tools: [],
              parameters: {},
              category: 'other',
              isBuiltIn: false,
              usageCount: 0,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ],
        }

        const result = await AssistantRegistry.importAssistants(JSON.stringify(exportData))
        expect(result.imported).toBe(0)
        expect(result.skipped).toBe(1)
      })

      it('throws on invalid JSON format', async () => {
        await expect(AssistantRegistry.importAssistants('invalid json')).rejects.toThrow(
          'Invalid JSON format',
        )
      })

      it('throws on invalid export format', async () => {
        const invalidData = { someKey: 'someValue' }
        await expect(AssistantRegistry.importAssistants(JSON.stringify(invalidData))).rejects.toThrow(
          'Invalid assistant export format',
        )
      })

      it('resets usageCount on import', async () => {
        const exportData = {
          version: 1,
          exportedAt: Date.now(),
          assistants: [
            {
              id: 'test-id',
              name: 'Usage Test',
              description: 'Test',
              icon: '\u{1F4E5}',
              systemPrompt: 'Test',
              model: '',
              tools: [],
              parameters: {},
              category: 'other',
              isBuiltIn: false,
              usageCount: 100,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ],
        }

        await AssistantRegistry.importAssistants(JSON.stringify(exportData))
        const custom = await AssistantRegistry.getCustom()
        const imported = custom.find((a) => a.name === 'Usage Test')
        expect(imported!.usageCount).toBe(0)
      })
    })

    describe('AssistantRegistry.getByCategory', () => {
      beforeEach(async () => {
        await AssistantRegistry.add({
          name: 'Category Test 1',
          description: 'Test',
          icon: '\u{1F4C2}',
          systemPrompt: 'Test',
          model: '',
          tools: [],
          parameters: {},
          category: 'code',
        })
        await AssistantRegistry.add({
          name: 'Category Test 2',
          description: 'Test',
          icon: '\u{1F4C2}',
          systemPrompt: 'Test',
          model: '',
          tools: [],
          parameters: {},
          category: 'analysis',
        })
      })

      it('returns correct results for specific category', async () => {
        const code = await AssistantRegistry.getByCategory('code')
        const codeNames = code.map((a) => a.name)
        expect(codeNames).toContain('Category Test 1')
        expect(codeNames).not.toContain('Category Test 2')
      })

      it('returns all when category is "all"', async () => {
        const all = await AssistantRegistry.getByCategory('all')
        expect(all.length).toBeGreaterThanOrEqual(22) // 20 builtins + 2 custom
      })
    })

    describe('AssistantRegistry.searchAssistants', () => {
      beforeEach(async () => {
        await AssistantRegistry.add({
          name: 'React Expert',
          description: 'Frontend development specialist',
          icon: '\u{1F50D}',
          systemPrompt: 'Test',
          model: '',
          tools: [],
          parameters: {},
          category: 'code',
        })
        await AssistantRegistry.add({
          name: 'Python Guru',
          description: 'Backend and data science expert',
          icon: '\u{1F50D}',
          systemPrompt: 'Test',
          model: '',
          tools: [],
          parameters: {},
          category: 'code',
        })
      })

      it('searches by name', async () => {
        const results = await AssistantRegistry.searchAssistants('React')
        const names = results.map((a) => a.name)
        expect(names).toContain('React Expert')
        expect(names).not.toContain('Python Guru')
      })

      it('searches by description', async () => {
        const results = await AssistantRegistry.searchAssistants('data science')
        const names = results.map((a) => a.name)
        expect(names).toContain('Python Guru')
        expect(names).not.toContain('React Expert')
      })

      it('returns all when query is empty', async () => {
        const results = await AssistantRegistry.searchAssistants('')
        expect(results.length).toBeGreaterThanOrEqual(22) // 20 builtins + 2 custom
      })
    })
  })
})
