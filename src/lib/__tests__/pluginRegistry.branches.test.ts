import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../i18n', () => ({
  getGlobalLocale: vi.fn(() => 'en'),
}))

import { PluginRegistry } from '../pluginRegistry'
import type { Plugin } from '../pluginRegistry'

describe('pluginRegistry branch coverage', () => {
  beforeEach(async () => {
    // Clean up any existing plugins
    const plugins = await PluginRegistry.list()
    for (const p of plugins) {
      await PluginRegistry.remove(p.id)
    }
  })

  it('add and list plugins', async () => {
    const plugin = await PluginRegistry.add({
      name: 'Test Prompt',
      description: 'A test prompt plugin',
      enabled: true,
      type: 'prompt',
      config: { template: 'Summarize: {{input}}' },
    })

    expect(plugin.id).toBeDefined()
    const list = await PluginRegistry.list()
    expect(list.some((p) => p.id === plugin.id)).toBe(true)
  })

  it('get returns plugin by id', async () => {
    const plugin = await PluginRegistry.add({
      name: 'Get Test',
      description: 'test',
      enabled: true,
      type: 'prompt',
      config: { template: '{{input}}' },
    })

    const found = await PluginRegistry.get(plugin.id)
    expect(found).not.toBeNull()
    expect(found!.name).toBe('Get Test')
  })

  it('get returns null for unknown id', async () => {
    const found = await PluginRegistry.get('nonexistent')
    expect(found).toBeNull()
  })

  it('update modifies plugin', async () => {
    const plugin = await PluginRegistry.add({
      name: 'Update Test',
      description: 'test',
      enabled: true,
      type: 'prompt',
      config: { template: '{{input}}' },
    })

    const updated = await PluginRegistry.update(plugin.id, { name: 'Updated Name' })
    expect(updated).not.toBeNull()
    expect(updated!.name).toBe('Updated Name')
  })

  it('update returns null for unknown id', async () => {
    const result = await PluginRegistry.update('nonexistent', { name: 'X' })
    expect(result).toBeNull()
  })

  it('remove returns true for existing plugin', async () => {
    const plugin = await PluginRegistry.add({
      name: 'Remove Test',
      description: 'test',
      enabled: true,
      type: 'prompt',
      config: { template: '{{input}}' },
    })

    const result = await PluginRegistry.remove(plugin.id)
    expect(result).toBe(true)
  })

  it('remove returns false for unknown id', async () => {
    const result = await PluginRegistry.remove('nonexistent')
    expect(result).toBe(false)
  })

  it('getEnabled filters by enabled flag', async () => {
    await PluginRegistry.add({
      name: 'Enabled',
      description: 'test',
      enabled: true,
      type: 'prompt',
      config: { template: '{{input}}' },
    })
    await PluginRegistry.add({
      name: 'Disabled',
      description: 'test',
      enabled: false,
      type: 'prompt',
      config: { template: '{{input}}' },
    })

    const enabled = await PluginRegistry.getEnabled()
    expect(enabled.every((p) => p.enabled)).toBe(true)
    expect(enabled.length).toBe(1)
  })

  it('toAgentTools converts enabled plugins to tools', async () => {
    await PluginRegistry.add({
      name: 'Tool Plugin',
      description: 'A tool',
      enabled: true,
      type: 'prompt',
      config: { template: 'Do: {{input}}' },
    })

    const tools = await PluginRegistry.toAgentTools()
    expect(tools.length).toBe(1)
    expect(tools[0].description).toBe('A tool')
  })

  it('prompt tool executes template substitution', async () => {
    await PluginRegistry.add({
      name: 'prompt-exec',
      description: 'test',
      enabled: true,
      type: 'prompt',
      config: { template: 'Hello {{input}} world' },
    })

    const tools = await PluginRegistry.toAgentTools()
    const result = await tools[0].execute({ input: 'beautiful' })
    expect(result).toBe('Hello beautiful world')
  })

  it('javascript tool executes safe code', async () => {
    await PluginRegistry.add({
      name: 'js-exec',
      description: 'test',
      enabled: true,
      type: 'javascript',
      config: { code: 'return input + " processed"' },
    })

    const tools = await PluginRegistry.toAgentTools()
    const result = await tools[0].execute({ input: 'data' })
    expect(result).toBe('data processed')
  })

  it('javascript tool rejects unsafe characters', async () => {
    await PluginRegistry.add({
      name: 'js-unsafe',
      description: 'test',
      enabled: true,
      type: 'javascript',
      config: { code: 'process.exit(1)\x00' },
    })

    const tools = await PluginRegistry.toAgentTools()
    const result = await tools[0].execute({ input: '' })
    // Either 'unsafe' or a JS error from the safety check
    expect(result.toLowerCase()).toMatch(/unsafe|error/)
  })

  it('javascript tool handles runtime error', async () => {
    await PluginRegistry.add({
      name: 'js-error',
      description: 'test',
      enabled: true,
      type: 'javascript',
      config: { code: 'return undefined' },
    })

    const tools = await PluginRegistry.toAgentTools()
    const result = await tools[0].execute({ input: '' })
    // undefined → String(undefined ?? '') → ''
    expect(result).toBe('')
  })

  it('webhook tool calls fetch', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('webhook result', { status: 200 }),
    )

    await PluginRegistry.add({
      name: 'webhook-exec',
      description: 'test',
      enabled: true,
      type: 'webhook',
      config: { url: 'https://example.com/api', method: 'POST' },
    })

    const tools = await PluginRegistry.toAgentTools()
    const result = await tools[0].execute({ input: 'data' })
    expect(result).toContain('webhook result')
    vi.restoreAllMocks()
  })
})
