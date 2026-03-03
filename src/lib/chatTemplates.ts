import { Storage } from './storage'

const STORAGE_KEY = 'hchat:chat-templates'
const MAX_TEMPLATES = 20

export interface ChatTemplateStep {
  role: 'user' | 'system'
  content: string
  waitForResponse: boolean
}

export interface ChatTemplate {
  id: string
  name: string
  description: string
  steps: ChatTemplateStep[]
  variables: string[]
  category: string
  createdAt: number
  usageCount: number
}

export function extractVariables(steps: ChatTemplateStep[]): string[] {
  const variableSet = new Set<string>()
  const regex = /\{\{(\w+)\}\}/g

  for (const step of steps) {
    let match: RegExpExecArray | null
    while ((match = regex.exec(step.content)) !== null) {
      variableSet.add(match[1])
    }
  }

  return Array.from(variableSet)
}

export function replaceVariables(
  steps: ChatTemplateStep[],
  values: Record<string, string>,
): ChatTemplateStep[] {
  return steps.map((step) => {
    let content = step.content
    for (const [key, value] of Object.entries(values)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      content = content.replace(regex, value)
    }
    return { ...step, content }
  })
}

async function getTemplates(): Promise<ChatTemplate[]> {
  return (await Storage.get<ChatTemplate[]>(STORAGE_KEY)) ?? []
}

async function saveTemplates(templates: ChatTemplate[]): Promise<void> {
  await Storage.set(STORAGE_KEY, templates)
}

export const ChatTemplateStore = {
  async list(): Promise<ChatTemplate[]> {
    const templates = await getTemplates()
    return templates.sort((a, b) => b.createdAt - a.createdAt)
  },

  async save(
    template: Omit<ChatTemplate, 'id' | 'createdAt' | 'usageCount' | 'variables'>,
  ): Promise<ChatTemplate> {
    const templates = await getTemplates()

    if (templates.length >= MAX_TEMPLATES) {
      templates.shift()
    }

    const variables = extractVariables(template.steps)
    const newTemplate: ChatTemplate = {
      ...template,
      id: crypto.randomUUID(),
      variables,
      createdAt: Date.now(),
      usageCount: 0,
    }

    await saveTemplates([...templates, newTemplate])
    return newTemplate
  },

  async get(id: string): Promise<ChatTemplate | null> {
    const templates = await getTemplates()
    return templates.find((t) => t.id === id) ?? null
  },

  async delete(id: string): Promise<boolean> {
    const templates = await getTemplates()
    const filtered = templates.filter((t) => t.id !== id)
    if (filtered.length === templates.length) return false
    await saveTemplates(filtered)
    return true
  },

  async incrementUsage(id: string): Promise<void> {
    const templates = await getTemplates()
    const updated = templates.map((t) =>
      t.id === id ? { ...t, usageCount: t.usageCount + 1 } : t,
    )
    await saveTemplates(updated)
  },

  async exportTemplates(ids?: string[]): Promise<string> {
    const templates = await getTemplates()
    const toExport = ids ? templates.filter((t) => ids.includes(t.id)) : templates

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      templates: toExport,
    }

    return JSON.stringify(exportData, null, 2)
  },

  async importTemplates(json: string): Promise<{ imported: number; skipped: number }> {
    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch {
      throw new Error('Invalid JSON format')
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('version' in parsed) ||
      !('templates' in parsed) ||
      !Array.isArray((parsed as { templates: unknown }).templates)
    ) {
      throw new Error('Invalid template export format')
    }

    const data = parsed as { version: number; templates: ChatTemplate[] }
    const existingTemplates = await getTemplates()
    const existingNames = new Set(existingTemplates.map((t) => t.name))

    let imported = 0
    let skipped = 0

    for (const template of data.templates) {
      if (existingNames.has(template.name)) {
        skipped++
        continue
      }

      if (existingTemplates.length + imported >= MAX_TEMPLATES) {
        skipped += data.templates.length - imported - skipped
        break
      }

      const newTemplate: ChatTemplate = {
        ...template,
        id: crypto.randomUUID(),
        usageCount: 0,
      }

      existingTemplates.push(newTemplate)
      imported++
    }

    await saveTemplates(existingTemplates)
    return { imported, skipped }
  },
}
