import { Storage } from './storage'
import { t } from '../i18n'

export interface Prompt {
  id: string
  title: string
  content: string
  shortcut?: string  // e.g. "summary"
  category: string
  usageCount: number
  createdAt: number
}

const KEY = 'hchat:prompts'

const DEFAULT_PROMPT_KEYS = [
  { id: 'p1', key: 'pageSummary', shortcut: 'sum', category: '읽기' },
  { id: 'p2', key: 'translateKo', shortcut: 'tr', category: '번역' },
  { id: 'p3', key: 'polish', shortcut: 'polish', category: '글쓰기' },
  { id: 'p4', key: 'codeReview', shortcut: 'cr', category: '코드' },
  { id: 'p5', key: 'emailDraft', shortcut: 'email', category: '글쓰기' },
  { id: 'p6', key: 'ytSummary', shortcut: 'yt', category: '읽기' },
  { id: 'p7', key: 'argAnalysis', shortcut: 'arg', category: '분석' },
  { id: 'p8', key: 'eli5', shortcut: 'eli5', category: '설명' },
] as const

function getDefaultPrompts(): Prompt[] {
  return DEFAULT_PROMPT_KEYS.map((d) => ({
    id: d.id,
    title: t(`defaultPrompts.${d.key}.title`),
    content: t(`defaultPrompts.${d.key}.content`),
    shortcut: d.shortcut,
    category: d.category,
    usageCount: 0,
    createdAt: 0,
  }))
}

/** @deprecated Use getDefaultPrompts() for locale-aware defaults */
export const DEFAULT_PROMPTS: Prompt[] = getDefaultPrompts()

export const PromptLibrary = {
  async list(): Promise<Prompt[]> {
    const saved = await Storage.get<Prompt[]>(KEY)
    return saved ?? getDefaultPrompts()
  },

  async save(prompt: Omit<Prompt, 'id' | 'createdAt' | 'usageCount'>): Promise<Prompt> {
    const list = await this.list()
    const p: Prompt = { ...prompt, id: crypto.randomUUID(), createdAt: Date.now(), usageCount: 0 }
    list.push(p)
    await Storage.set(KEY, list)
    return p
  },

  async update(id: string, patch: Partial<Prompt>): Promise<void> {
    const list = await this.list()
    const idx = list.findIndex((p) => p.id === id)
    if (idx !== -1) { list[idx] = { ...list[idx], ...patch }; await Storage.set(KEY, list) }
  },

  async delete(id: string): Promise<void> {
    const list = (await this.list()).filter((p) => p.id !== id)
    await Storage.set(KEY, list)
  },

  async incrementUsage(id: string): Promise<void> {
    const list = await this.list()
    const idx = list.findIndex((p) => p.id === id)
    if (idx !== -1) { list[idx].usageCount++; await Storage.set(KEY, list) }
  },

  async searchByShortcut(q: string): Promise<Prompt[]> {
    const list = await this.list()
    const lq = q.toLowerCase()
    return list.filter((p) =>
      p.title.toLowerCase().includes(lq) ||
      p.shortcut?.toLowerCase().startsWith(lq) ||
      p.category.toLowerCase().includes(lq)
    )
  },

  async exportPrompts(): Promise<PromptExportData> {
    const prompts = await this.list()
    return { version: '1.0', exportedAt: new Date().toISOString(), prompts }
  },

  async importPrompts(file: File): Promise<number> {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File too large (max 10MB)')
    }
    const text = await file.text()
    let data: PromptExportData
    try {
      data = JSON.parse(text) as PromptExportData
    } catch {
      throw new Error('Invalid JSON file format')
    }
    if (!data.version || !Array.isArray(data.prompts)) {
      throw new Error('Invalid prompt file format')
    }
    const existing = await this.list()
    const existingIds = new Set(existing.map((p) => p.id))
    const sanitize = (s: string) => s.replace(/<script[\s>]/gi, '').replace(/on\w+\s*=/gi, '')
    const newPrompts = data.prompts
      .filter((p) => p.title && p.content)
      .map((p): Prompt => ({
        ...p,
        id: existingIds.has(p.id) ? crypto.randomUUID() : p.id,
        title: sanitize(String(p.title)).slice(0, 200),
        content: sanitize(String(p.content)).slice(0, 10000),
        shortcut: p.shortcut ? String(p.shortcut).slice(0, 20) : undefined,
        usageCount: p.usageCount ?? 0,
        createdAt: p.createdAt ?? Date.now(),
        category: p.category ?? '글쓰기',
      }))
    const merged = [...existing, ...newPrompts]
    await Storage.set(KEY, merged)
    return newPrompts.length
  },
}

export interface PromptExportData {
  version: string
  exportedAt: string
  prompts: Prompt[]
}
