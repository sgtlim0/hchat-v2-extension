// lib/docTemplateStore.ts — Template gallery CRUD with chrome.storage

import { Storage } from './storage'

const STORAGE_KEY = 'hchat:doc-templates'
const MAX_TEMPLATES = 10
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export interface SavedTemplate {
  id: string
  name: string
  fieldCount: number
  category: string
  docxBase64: string
  createdAt: number
  usageCount: number
}

export class TemplateStoreError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TemplateStoreError'
  }
}

function generateId(): string {
  return `tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Remove data URL prefix (data:...;base64,)
      const base64 = result.split(',')[1] ?? result
      resolve(base64)
    }
    reader.onerror = () => reject(new TemplateStoreError('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export function base64ToFile(base64: string, name: string): File {
  const byteChars = atob(base64)
  const byteNumbers = new Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return new File([byteArray], name, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

async function getTemplates(): Promise<SavedTemplate[]> {
  return (await Storage.get<SavedTemplate[]>(STORAGE_KEY)) ?? []
}

async function saveTemplates(templates: SavedTemplate[]): Promise<void> {
  await Storage.set(STORAGE_KEY, templates)
}

export const DocTemplateStore = {
  async list(): Promise<SavedTemplate[]> {
    const templates = await getTemplates()
    return templates.sort((a, b) => b.createdAt - a.createdAt)
  },

  async save(
    name: string,
    file: File,
    fieldCount: number,
    category: string,
  ): Promise<SavedTemplate> {
    if (file.size > MAX_FILE_SIZE) {
      throw new TemplateStoreError(`File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`)
    }

    const templates = await getTemplates()
    if (templates.length >= MAX_TEMPLATES) {
      throw new TemplateStoreError(`Maximum ${MAX_TEMPLATES} templates allowed`)
    }

    const docxBase64 = await fileToBase64(file)
    const template: SavedTemplate = {
      id: generateId(),
      name,
      fieldCount,
      category,
      docxBase64,
      createdAt: Date.now(),
      usageCount: 0,
    }

    await saveTemplates([...templates, template])
    return template
  },

  async get(id: string): Promise<SavedTemplate | null> {
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
}
