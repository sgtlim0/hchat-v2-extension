import { describe, it, expect, beforeEach } from 'vitest'
import { Personas, getBuiltinPersonas, type Persona } from '../personas'

describe('personas', () => {
  beforeEach(async () => {
    await chrome.storage.local.clear()
  })

  describe('getBuiltinPersonas', () => {
    it('returns 6 built-in personas', () => {
      const builtins = getBuiltinPersonas()
      expect(builtins).toHaveLength(6)
    })

    it('all built-in personas have required properties', () => {
      const builtins = getBuiltinPersonas()
      builtins.forEach((p) => {
        expect(p).toHaveProperty('id')
        expect(p).toHaveProperty('name')
        expect(p).toHaveProperty('icon')
        expect(p).toHaveProperty('systemPrompt')
        expect(p).toHaveProperty('description')
        expect(p.builtin).toBe(true)
        expect(p.createdAt).toBe(0)
      })
    })

    it('includes default persona', () => {
      const builtins = getBuiltinPersonas()
      const defaultPersona = builtins.find((p) => p.id === 'default')
      expect(defaultPersona).toBeDefined()
      expect(defaultPersona?.icon).toBe('🤖')
    })

    it('includes developer persona', () => {
      const builtins = getBuiltinPersonas()
      const dev = builtins.find((p) => p.id === 'developer')
      expect(dev).toBeDefined()
      expect(dev?.icon).toBe('💻')
      expect(dev?.systemPrompt).toContain('TypeScript')
    })

    it('includes writer persona', () => {
      const builtins = getBuiltinPersonas()
      const writer = builtins.find((p) => p.id === 'writer')
      expect(writer).toBeDefined()
      expect(writer?.icon).toBe('✍️')
    })

    it('includes translator persona', () => {
      const builtins = getBuiltinPersonas()
      const translator = builtins.find((p) => p.id === 'translator')
      expect(translator).toBeDefined()
      expect(translator?.icon).toBe('🌐')
    })

    it('includes analyst persona', () => {
      const builtins = getBuiltinPersonas()
      const analyst = builtins.find((p) => p.id === 'analyst')
      expect(analyst).toBeDefined()
      expect(analyst?.icon).toBe('📊')
    })

    it('includes teacher persona', () => {
      const builtins = getBuiltinPersonas()
      const teacher = builtins.find((p) => p.id === 'teacher')
      expect(teacher).toBeDefined()
      expect(teacher?.icon).toBe('📚')
    })
  })

  describe('Personas.list', () => {
    it('returns only built-in personas when no custom personas exist', async () => {
      const personas = await Personas.list()
      expect(personas).toHaveLength(6)
      expect(personas.every((p) => p.builtin)).toBe(true)
    })

    it('includes custom personas with built-in ones', async () => {
      const custom = await Personas.add({
        name: 'Custom Persona',
        icon: '🎨',
        systemPrompt: 'Custom prompt',
        description: 'Custom description',
      })

      const personas = await Personas.list()
      expect(personas).toHaveLength(7)
      expect(personas.slice(0, 6).every((p) => p.builtin)).toBe(true)
      expect(personas[6].builtin).toBe(false)
      expect(personas[6].id).toBe(custom.id)
    })

    it('preserves order: built-ins first, custom second', async () => {
      await Personas.add({ name: 'Custom 1', icon: '🎨', systemPrompt: 'p1', description: 'd1' })
      await Personas.add({ name: 'Custom 2', icon: '🎭', systemPrompt: 'p2', description: 'd2' })

      const personas = await Personas.list()
      expect(personas).toHaveLength(8)
      expect(personas.slice(0, 6).every((p) => p.builtin)).toBe(true)
      expect(personas.slice(6).every((p) => !p.builtin)).toBe(true)
    })
  })

  describe('Personas.getCustom', () => {
    it('returns empty array when no custom personas exist', async () => {
      const custom = await Personas.getCustom()
      expect(custom).toEqual([])
    })

    it('returns only custom personas', async () => {
      await Personas.add({ name: 'Custom 1', icon: '🎨', systemPrompt: 'p1', description: 'd1' })
      await Personas.add({ name: 'Custom 2', icon: '🎭', systemPrompt: 'p2', description: 'd2' })

      const custom = await Personas.getCustom()
      expect(custom).toHaveLength(2)
      expect(custom.every((p) => !p.builtin)).toBe(true)
    })
  })

  describe('Personas.add', () => {
    it('creates custom persona with generated ID', async () => {
      const created = await Personas.add({
        name: 'Test Persona',
        icon: '🧪',
        systemPrompt: 'Test prompt',
        description: 'Test description',
      })

      expect(created.id).toBeDefined()
      expect(typeof created.id).toBe('string')
      expect(created.id.length).toBeGreaterThan(0)
    })

    it('sets builtin to false', async () => {
      const created = await Personas.add({
        name: 'Test Persona',
        icon: '🧪',
        systemPrompt: 'Test prompt',
        description: 'Test description',
      })

      expect(created.builtin).toBe(false)
    })

    it('sets createdAt timestamp', async () => {
      const before = Date.now()
      const created = await Personas.add({
        name: 'Test Persona',
        icon: '🧪',
        systemPrompt: 'Test prompt',
        description: 'Test description',
      })
      const after = Date.now()

      expect(created.createdAt).toBeGreaterThanOrEqual(before)
      expect(created.createdAt).toBeLessThanOrEqual(after)
    })

    it('persists persona in storage', async () => {
      const created = await Personas.add({
        name: 'Persistent',
        icon: '💾',
        systemPrompt: 'Persist prompt',
        description: 'Persist desc',
      })

      const custom = await Personas.getCustom()
      expect(custom).toHaveLength(1)
      expect(custom[0].id).toBe(created.id)
    })

    it('preserves all input properties', async () => {
      const input = {
        name: 'Test Name',
        icon: '🎯',
        systemPrompt: 'Test system prompt',
        description: 'Test description text',
      }

      const created = await Personas.add(input)

      expect(created.name).toBe(input.name)
      expect(created.icon).toBe(input.icon)
      expect(created.systemPrompt).toBe(input.systemPrompt)
      expect(created.description).toBe(input.description)
    })
  })

  describe('Personas.update', () => {
    it('updates existing custom persona', async () => {
      const created = await Personas.add({
        name: 'Original',
        icon: '📝',
        systemPrompt: 'Original prompt',
        description: 'Original description',
      })

      await Personas.update(created.id, {
        name: 'Updated',
        icon: '✏️',
      })

      const updated = await Personas.getById(created.id)
      expect(updated?.name).toBe('Updated')
      expect(updated?.icon).toBe('✏️')
      expect(updated?.systemPrompt).toBe('Original prompt') // Unchanged
    })

    it('supports partial updates', async () => {
      const created = await Personas.add({
        name: 'Original',
        icon: '📝',
        systemPrompt: 'Original prompt',
        description: 'Original description',
      })

      await Personas.update(created.id, {
        description: 'New description only',
      })

      const updated = await Personas.getById(created.id)
      expect(updated?.name).toBe('Original')
      expect(updated?.description).toBe('New description only')
    })

    it('is no-op for nonexistent ID', async () => {
      await Personas.update('fake-id', { name: 'New Name' })
      // Should not throw
    })

    it('does not affect built-in personas', async () => {
      await Personas.update('default', { name: 'Hacked' })
      const personas = await Personas.list()
      const defaultPersona = personas.find((p) => p.id === 'default')
      expect(defaultPersona?.name).not.toBe('Hacked')
    })
  })

  describe('Personas.remove', () => {
    it('removes custom persona', async () => {
      const created = await Personas.add({
        name: 'To Remove',
        icon: '🗑️',
        systemPrompt: 'Remove me',
        description: 'Will be deleted',
      })

      await Personas.remove(created.id)

      const custom = await Personas.getCustom()
      expect(custom.find((p) => p.id === created.id)).toBeUndefined()
    })

    it('is no-op for nonexistent ID', async () => {
      await Personas.remove('fake-id')
      // Should not throw
    })

    it('does not remove built-in personas', async () => {
      await Personas.remove('default')
      const personas = await Personas.list()
      expect(personas.find((p) => p.id === 'default')).toBeDefined()
    })

    it('only removes specified persona', async () => {
      const p1 = await Personas.add({ name: 'Keep', icon: '✅', systemPrompt: 'p1', description: 'd1' })
      const p2 = await Personas.add({ name: 'Remove', icon: '❌', systemPrompt: 'p2', description: 'd2' })

      await Personas.remove(p2.id)

      const custom = await Personas.getCustom()
      expect(custom).toHaveLength(1)
      expect(custom[0].id).toBe(p1.id)
    })
  })

  describe('Personas.getActive', () => {
    it('returns "default" when no active persona is set', async () => {
      const active = await Personas.getActive()
      expect(active).toBe('default')
    })

    it('returns stored active persona ID', async () => {
      await Personas.setActive('developer')
      const active = await Personas.getActive()
      expect(active).toBe('developer')
    })
  })

  describe('Personas.setActive', () => {
    it('stores active persona ID', async () => {
      await Personas.setActive('writer')
      const active = await Personas.getActive()
      expect(active).toBe('writer')
    })

    it('overwrites previous active persona', async () => {
      await Personas.setActive('developer')
      await Personas.setActive('translator')

      const active = await Personas.getActive()
      expect(active).toBe('translator')
    })

    it('accepts custom persona ID', async () => {
      const custom = await Personas.add({
        name: 'Custom',
        icon: '🎯',
        systemPrompt: 'Custom',
        description: 'Custom',
      })

      await Personas.setActive(custom.id)
      const active = await Personas.getActive()
      expect(active).toBe(custom.id)
    })
  })

  describe('Personas.getById', () => {
    it('finds built-in persona by ID', async () => {
      const persona = await Personas.getById('developer')
      expect(persona).toBeDefined()
      expect(persona?.id).toBe('developer')
      expect(persona?.builtin).toBe(true)
    })

    it('finds custom persona by ID', async () => {
      const created = await Personas.add({
        name: 'Custom',
        icon: '🔍',
        systemPrompt: 'Find me',
        description: 'Findable',
      })

      const found = await Personas.getById(created.id)
      expect(found).toBeDefined()
      expect(found?.id).toBe(created.id)
      expect(found?.name).toBe('Custom')
    })

    it('returns undefined for nonexistent ID', async () => {
      const persona = await Personas.getById('nonexistent-id')
      expect(persona).toBeUndefined()
    })
  })
})
