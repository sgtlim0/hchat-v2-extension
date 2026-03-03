import { describe, it, expect, beforeEach } from 'vitest'
import {
  ChatTemplateStore,
  extractVariables,
  replaceVariables,
  type ChatTemplate,
  type ChatTemplateStep,
} from '../chatTemplates'

beforeEach(async () => {
  await chrome.storage.local.clear()
})

describe('extractVariables', () => {
  it('finds all variable patterns', () => {
    const steps: ChatTemplateStep[] = [
      { role: 'user', content: 'Hello {{name}}, your email is {{email}}', waitForResponse: true },
      { role: 'user', content: 'Your age is {{age}}', waitForResponse: false },
    ]
    const vars = extractVariables(steps)
    expect(vars).toEqual(['name', 'email', 'age'])
  })

  it('returns empty for no variables', () => {
    const steps: ChatTemplateStep[] = [
      { role: 'user', content: 'Hello world', waitForResponse: true },
    ]
    const vars = extractVariables(steps)
    expect(vars).toEqual([])
  })

  it('deduplicates variable names', () => {
    const steps: ChatTemplateStep[] = [
      { role: 'user', content: '{{name}} is {{name}}', waitForResponse: true },
    ]
    const vars = extractVariables(steps)
    expect(vars).toEqual(['name'])
  })
})

describe('replaceVariables', () => {
  it('substitutes variables correctly', () => {
    const steps: ChatTemplateStep[] = [
      { role: 'user', content: 'Hello {{name}}', waitForResponse: true },
    ]
    const replaced = replaceVariables(steps, { name: 'Alice' })
    expect(replaced[0].content).toBe('Hello Alice')
  })

  it('handles missing values by keeping placeholder', () => {
    const steps: ChatTemplateStep[] = [
      { role: 'user', content: 'Hello {{name}}', waitForResponse: true },
    ]
    const replaced = replaceVariables(steps, {})
    expect(replaced[0].content).toBe('Hello {{name}}')
  })

  it('replaces multiple occurrences', () => {
    const steps: ChatTemplateStep[] = [
      { role: 'user', content: '{{x}} and {{x}}', waitForResponse: true },
    ]
    const replaced = replaceVariables(steps, { x: 'test' })
    expect(replaced[0].content).toBe('test and test')
  })
})

describe('ChatTemplateStore.save', () => {
  it('creates template with generated id and createdAt', async () => {
    const template = await ChatTemplateStore.save({
      name: 'Test Template',
      description: 'Test description',
      steps: [{ role: 'user', content: 'Hello', waitForResponse: true }],
      category: 'Test',
    })

    expect(template.id).toBeTruthy()
    expect(template.createdAt).toBeGreaterThan(0)
    expect(template.usageCount).toBe(0)
    expect(template.name).toBe('Test Template')
  })

  it('auto-extracts variables from steps', async () => {
    const template = await ChatTemplateStore.save({
      name: 'With Variables',
      description: '',
      steps: [{ role: 'user', content: 'Hello {{name}}, age {{age}}', waitForResponse: true }],
      category: 'Test',
    })

    expect(template.variables).toEqual(['name', 'age'])
  })

  it('enforces max templates limit with FIFO', async () => {
    for (let i = 0; i < 20; i++) {
      await ChatTemplateStore.save({
        name: `Template ${i}`,
        description: '',
        steps: [{ role: 'user', content: `Step ${i}`, waitForResponse: true }],
        category: 'Test',
      })
    }

    const list = await ChatTemplateStore.list()
    expect(list).toHaveLength(20)

    const newest = await ChatTemplateStore.save({
      name: 'Template 21',
      description: '',
      steps: [{ role: 'user', content: 'Step 21', waitForResponse: true }],
      category: 'Test',
    })

    const updated = await ChatTemplateStore.list()
    expect(updated).toHaveLength(20)
    expect(updated.some((t) => t.id === newest.id)).toBe(true)
  })
})

describe('ChatTemplateStore.list', () => {
  it('returns templates sorted by createdAt desc', async () => {
    await ChatTemplateStore.save({
      name: 'Old',
      description: '',
      steps: [{ role: 'user', content: 'Old', waitForResponse: true }],
      category: 'Test',
    })
    await new Promise((r) => setTimeout(r, 5))
    await ChatTemplateStore.save({
      name: 'New',
      description: '',
      steps: [{ role: 'user', content: 'New', waitForResponse: true }],
      category: 'Test',
    })

    const list = await ChatTemplateStore.list()
    expect(list[0].name).toBe('New')
    expect(list[1].name).toBe('Old')
  })
})

describe('ChatTemplateStore.get', () => {
  it('returns template by id', async () => {
    const saved = await ChatTemplateStore.save({
      name: 'Find Me',
      description: '',
      steps: [{ role: 'user', content: 'Find', waitForResponse: true }],
      category: 'Test',
    })

    const found = await ChatTemplateStore.get(saved.id)
    expect(found).not.toBeNull()
    expect(found!.name).toBe('Find Me')
  })

  it('returns null for non-existent id', async () => {
    const result = await ChatTemplateStore.get('nonexistent')
    expect(result).toBeNull()
  })
})

describe('ChatTemplateStore.delete', () => {
  it('removes template', async () => {
    const saved = await ChatTemplateStore.save({
      name: 'Delete Me',
      description: '',
      steps: [{ role: 'user', content: 'Delete', waitForResponse: true }],
      category: 'Test',
    })

    const result = await ChatTemplateStore.delete(saved.id)
    expect(result).toBe(true)

    const found = await ChatTemplateStore.get(saved.id)
    expect(found).toBeNull()
  })

  it('returns false for non-existent id', async () => {
    const result = await ChatTemplateStore.delete('nonexistent')
    expect(result).toBe(false)
  })
})

describe('ChatTemplateStore.incrementUsage', () => {
  it('increments usage count', async () => {
    const saved = await ChatTemplateStore.save({
      name: 'Counter',
      description: '',
      steps: [{ role: 'user', content: 'Count', waitForResponse: true }],
      category: 'Test',
    })

    expect(saved.usageCount).toBe(0)

    await ChatTemplateStore.incrementUsage(saved.id)
    await ChatTemplateStore.incrementUsage(saved.id)

    const updated = await ChatTemplateStore.get(saved.id)
    expect(updated!.usageCount).toBe(2)
  })
})

describe('ChatTemplateStore.exportTemplates', () => {
  it('returns valid JSON with version', async () => {
    await ChatTemplateStore.save({
      name: 'Export Test',
      description: '',
      steps: [{ role: 'user', content: 'Export', waitForResponse: true }],
      category: 'Test',
    })

    const json = await ChatTemplateStore.exportTemplates()
    const parsed = JSON.parse(json)

    expect(parsed.version).toBe(1)
    expect(parsed.exportedAt).toBeTruthy()
    expect(Array.isArray(parsed.templates)).toBe(true)
    expect(parsed.templates).toHaveLength(1)
  })

  it('exports empty array when no templates', async () => {
    const json = await ChatTemplateStore.exportTemplates()
    const parsed = JSON.parse(json)

    expect(parsed.templates).toEqual([])
  })
})

describe('ChatTemplateStore.importTemplates', () => {
  it('imports and skips duplicates', async () => {
    await ChatTemplateStore.save({
      name: 'Existing',
      description: '',
      steps: [{ role: 'user', content: 'Existing', waitForResponse: true }],
      category: 'Test',
    })

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      templates: [
        {
          id: 'old-id',
          name: 'Existing',
          description: '',
          steps: [{ role: 'user', content: 'Duplicate', waitForResponse: true }],
          variables: [],
          category: 'Test',
          createdAt: Date.now(),
          usageCount: 5,
        },
        {
          id: 'old-id-2',
          name: 'New Template',
          description: '',
          steps: [{ role: 'user', content: 'New', waitForResponse: true }],
          variables: [],
          category: 'Test',
          createdAt: Date.now(),
          usageCount: 3,
        },
      ],
    }

    const result = await ChatTemplateStore.importTemplates(JSON.stringify(exportData))
    expect(result.imported).toBe(1)
    expect(result.skipped).toBe(1)

    const list = await ChatTemplateStore.list()
    expect(list).toHaveLength(2)
    const imported = list.find((t) => t.name === 'New Template')
    expect(imported).toBeTruthy()
    expect(imported!.usageCount).toBe(0)
  })

  it('throws on invalid JSON', async () => {
    await expect(ChatTemplateStore.importTemplates('not json')).rejects.toThrow('Invalid JSON format')
  })

  it('throws on invalid structure', async () => {
    await expect(ChatTemplateStore.importTemplates(JSON.stringify({ foo: 'bar' }))).rejects.toThrow(
      'Invalid template export format',
    )
  })
})
