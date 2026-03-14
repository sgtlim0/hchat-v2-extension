import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SK } from '../storageKeys'

vi.mock('../sandboxExecutor', () => ({
  executeSandboxCode: vi.fn((code: string, input: string) => {
    try {
      const fn = new Function('input', `"use strict"; ${code}`)
      const result = fn(input)
      return Promise.resolve(String(result ?? ''))
    } catch (err) {
      return Promise.resolve(`JavaScript error: ${String(err)}`)
    }
  }),
}))

import { PluginRegistry, type Plugin, type PluginType } from '../pluginRegistry'

function makePlugin(overrides: Partial<Plugin> & { type: PluginType } = { type: 'prompt' }): Omit<Plugin, 'id'> {
  const base = {
    name: `Test Plugin ${Date.now()}`,
    description: 'A test plugin',
    enabled: true,
    type: overrides.type,
  }

  if (overrides.type === 'webhook') {
    return { ...base, ...overrides, config: overrides.config ?? { url: 'https://api.example.com/action', method: 'POST' as const } }
  }
  if (overrides.type === 'javascript') {
    return { ...base, ...overrides, config: overrides.config ?? { code: 'return input.toUpperCase()' } }
  }
  return { ...base, ...overrides, config: overrides.config ?? { template: 'Translate: {{input}}' } }
}

describe('PluginRegistry', () => {
  describe('CRUD operations', () => {
    it('list returns empty array initially', async () => {
      const result = await PluginRegistry.list()
      expect(result).toEqual([])
    })

    it('add creates a plugin with generated id', async () => {
      const data = makePlugin({ type: 'prompt' })
      const plugin = await PluginRegistry.add(data)

      expect(plugin.id).toMatch(/^plugin-/)
      expect(plugin.name).toBe(data.name)
      expect(plugin.type).toBe('prompt')
      expect(plugin.enabled).toBe(true)
    })

    it('list returns added plugins', async () => {
      await PluginRegistry.add(makePlugin({ type: 'prompt', name: 'Plugin A' }))
      await PluginRegistry.add(makePlugin({ type: 'webhook', name: 'Plugin B' }))

      const list = await PluginRegistry.list()
      expect(list).toHaveLength(2)
      expect(list[0].name).toBe('Plugin A')
      expect(list[1].name).toBe('Plugin B')
    })

    it('get returns a specific plugin by id', async () => {
      const added = await PluginRegistry.add(makePlugin({ type: 'prompt', name: 'Find Me' }))
      const found = await PluginRegistry.get(added.id)

      expect(found).not.toBeNull()
      expect(found!.name).toBe('Find Me')
    })

    it('get returns null for nonexistent id', async () => {
      const found = await PluginRegistry.get('nonexistent-id')
      expect(found).toBeNull()
    })

    it('update modifies plugin properties', async () => {
      const added = await PluginRegistry.add(makePlugin({ type: 'prompt', name: 'Original' }))
      const updated = await PluginRegistry.update(added.id, { name: 'Updated' })

      expect(updated).not.toBeNull()
      expect(updated!.name).toBe('Updated')
      expect(updated!.id).toBe(added.id)

      const fetched = await PluginRegistry.get(added.id)
      expect(fetched!.name).toBe('Updated')
    })

    it('update returns null for nonexistent id', async () => {
      const result = await PluginRegistry.update('nonexistent', { name: 'Nope' })
      expect(result).toBeNull()
    })

    it('remove deletes a plugin', async () => {
      const added = await PluginRegistry.add(makePlugin({ type: 'prompt', name: 'Delete Me' }))
      const removed = await PluginRegistry.remove(added.id)

      expect(removed).toBe(true)
      expect(await PluginRegistry.get(added.id)).toBeNull()
      expect(await PluginRegistry.list()).toHaveLength(0)
    })

    it('remove returns false for nonexistent id', async () => {
      const result = await PluginRegistry.remove('nonexistent')
      expect(result).toBe(false)
    })
  })

  describe('enable/disable filtering', () => {
    it('getEnabled returns only enabled plugins', async () => {
      await PluginRegistry.add(makePlugin({ type: 'prompt', name: 'Enabled', enabled: true }))
      await PluginRegistry.add(makePlugin({ type: 'prompt', name: 'Disabled', enabled: false }))

      const enabled = await PluginRegistry.getEnabled()
      expect(enabled).toHaveLength(1)
      expect(enabled[0].name).toBe('Enabled')
    })

    it('toggling enabled state works via update', async () => {
      const plugin = await PluginRegistry.add(makePlugin({ type: 'prompt', name: 'Toggle', enabled: true }))

      await PluginRegistry.update(plugin.id, { enabled: false })
      let enabled = await PluginRegistry.getEnabled()
      expect(enabled).toHaveLength(0)

      await PluginRegistry.update(plugin.id, { enabled: true })
      enabled = await PluginRegistry.getEnabled()
      expect(enabled).toHaveLength(1)
    })
  })

  describe('toAgentTools conversion', () => {
    it('returns empty array when no plugins', async () => {
      const tools = await PluginRegistry.toAgentTools()
      expect(tools).toEqual([])
    })

    it('converts enabled prompt plugin to Tool', async () => {
      await PluginRegistry.add({
        name: 'Translator',
        description: 'Translates text',
        type: 'prompt',
        enabled: true,
        config: { template: 'Translate to Korean: {{input}}' },
      })

      const tools = await PluginRegistry.toAgentTools()
      expect(tools).toHaveLength(1)
      expect(tools[0].description).toBe('Translates text')
      expect(tools[0].parameters.input).toBeDefined()
      expect(typeof tools[0].execute).toBe('function')
    })

    it('excludes disabled plugins from tools', async () => {
      await PluginRegistry.add({
        name: 'Disabled Tool',
        description: 'Should not appear',
        type: 'prompt',
        enabled: false,
        config: { template: '{{input}}' },
      })

      const tools = await PluginRegistry.toAgentTools()
      expect(tools).toHaveLength(0)
    })

    it('converts webhook plugin to Tool', async () => {
      await PluginRegistry.add({
        name: 'API Call',
        description: 'Calls external API',
        type: 'webhook',
        enabled: true,
        config: { url: 'https://api.example.com', method: 'POST' as const },
      })

      const tools = await PluginRegistry.toAgentTools()
      expect(tools).toHaveLength(1)
      expect(tools[0].parameters.input).toBeDefined()
    })

    it('converts javascript plugin to Tool', async () => {
      await PluginRegistry.add({
        name: 'JS Tool',
        description: 'Runs JS',
        type: 'javascript',
        enabled: true,
        config: { code: 'return input.length' },
      })

      const tools = await PluginRegistry.toAgentTools()
      expect(tools).toHaveLength(1)
    })
  })

  describe('prompt template execution', () => {
    it('substitutes {{input}} in template', async () => {
      await PluginRegistry.add({
        name: 'Template Test',
        description: 'Tests template',
        type: 'prompt',
        enabled: true,
        config: { template: 'Hello {{input}}, welcome!' },
      })

      const tools = await PluginRegistry.toAgentTools()
      const result = await tools[0].execute({ input: 'World' })
      expect(result).toBe('Hello World, welcome!')
    })

    it('handles multiple {{input}} occurrences', async () => {
      await PluginRegistry.add({
        name: 'Multi Template',
        description: 'Multi',
        type: 'prompt',
        enabled: true,
        config: { template: '{{input}} and {{input}}' },
      })

      const tools = await PluginRegistry.toAgentTools()
      const result = await tools[0].execute({ input: 'test' })
      expect(result).toBe('test and test')
    })

    it('handles empty input gracefully', async () => {
      await PluginRegistry.add({
        name: 'Empty',
        description: 'Empty',
        type: 'prompt',
        enabled: true,
        config: { template: 'Result: {{input}}' },
      })

      const tools = await PluginRegistry.toAgentTools()
      const result = await tools[0].execute({})
      expect(result).toBe('Result: ')
    })
  })

  describe('webhook tool execution', () => {
    it('calls fetch with POST method and JSON body', async () => {
      const mockResponse = { ok: true, text: () => Promise.resolve('webhook response') }
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

      await PluginRegistry.add({
        name: 'Webhook',
        description: 'Webhook test',
        type: 'webhook',
        enabled: true,
        config: { url: 'https://api.example.com/hook', method: 'POST' as const },
      })

      const tools = await PluginRegistry.toAgentTools()
      const result = await tools[0].execute({ input: 'test data' })

      expect(result).toBe('webhook response')
      expect(fetch).toHaveBeenCalledTimes(1)

      const [url, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(url).toBe('https://api.example.com/hook')
      expect(opts.method).toBe('POST')
      expect(JSON.parse(opts.body)).toEqual({ input: 'test data' })

      vi.unstubAllGlobals()
    })

    it('calls fetch with GET method and query params', async () => {
      const mockResponse = { ok: true, text: () => Promise.resolve('get response') }
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

      await PluginRegistry.add({
        name: 'GET Webhook',
        description: 'GET test',
        type: 'webhook',
        enabled: true,
        config: { url: 'https://api.example.com/data', method: 'GET' as const },
      })

      const tools = await PluginRegistry.toAgentTools()
      const result = await tools[0].execute({ input: 'query' })

      expect(result).toBe('get response')
      const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(url).toContain('input=query')

      vi.unstubAllGlobals()
    })

    it('handles HTTP error gracefully', async () => {
      const mockResponse = { ok: false, status: 500, statusText: 'Internal Server Error', text: () => Promise.resolve('') }
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

      await PluginRegistry.add({
        name: 'Error Webhook',
        description: 'Error test',
        type: 'webhook',
        enabled: true,
        config: { url: 'https://api.example.com/fail', method: 'POST' as const },
      })

      const tools = await PluginRegistry.toAgentTools()
      const result = await tools[0].execute({ input: 'data' })

      expect(result).toContain('HTTP error')
      expect(result).toContain('500')

      vi.unstubAllGlobals()
    })

    it('handles network error gracefully', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

      await PluginRegistry.add({
        name: 'Network Error',
        description: 'Network error test',
        type: 'webhook',
        enabled: true,
        config: { url: 'https://api.example.com/down', method: 'POST' as const },
      })

      const tools = await PluginRegistry.toAgentTools()
      const result = await tools[0].execute({ input: 'data' })

      expect(result).toContain('Webhook error')
      expect(result).toContain('Network error')

      vi.unstubAllGlobals()
    })
  })

  describe('storage persistence', () => {
    it('persists plugins across list calls', async () => {
      await PluginRegistry.add(makePlugin({ type: 'prompt', name: 'Persistent' }))

      // Verify via raw storage
      const raw = await chrome.storage.local.get(SK.PLUGINS)
      const stored = raw[SK.PLUGINS] as Plugin[]
      expect(stored).toHaveLength(1)
      expect(stored[0].name).toBe('Persistent')
    })

    it('maintains data integrity after update', async () => {
      const p1 = await PluginRegistry.add(makePlugin({ type: 'prompt', name: 'First' }))
      await PluginRegistry.add(makePlugin({ type: 'webhook', name: 'Second' }))
      await PluginRegistry.update(p1.id, { name: 'First Updated' })

      const list = await PluginRegistry.list()
      expect(list).toHaveLength(2)
      expect(list[0].name).toBe('First Updated')
      expect(list[1].name).toBe('Second')
    })

    it('maintains data integrity after remove', async () => {
      const p1 = await PluginRegistry.add(makePlugin({ type: 'prompt', name: 'Keep' }))
      const p2 = await PluginRegistry.add(makePlugin({ type: 'prompt', name: 'Remove' }))
      await PluginRegistry.remove(p2.id)

      const list = await PluginRegistry.list()
      expect(list).toHaveLength(1)
      expect(list[0].id).toBe(p1.id)
    })
  })
})
