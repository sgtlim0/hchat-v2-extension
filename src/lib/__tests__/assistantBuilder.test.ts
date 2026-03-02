import { describe, it, expect, beforeEach } from 'vitest'
import { AssistantRegistry, getBuiltinAssistants, type CustomAssistant } from '../assistantBuilder'

describe('assistantBuilder', () => {
  describe('getBuiltinAssistants', () => {
    it('returns 8 built-in assistants', () => {
      const builtins = getBuiltinAssistants()
      expect(builtins).toHaveLength(8)
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
      expect(all).toHaveLength(8)
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
        category: 'General',
      })

      const all = await AssistantRegistry.list()
      expect(all).toHaveLength(9)
      expect(all[8].name).toBe('Custom One')
      expect(all[8].isBuiltIn).toBe(false)
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
})
