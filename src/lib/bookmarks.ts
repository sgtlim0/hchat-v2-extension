// lib/bookmarks.ts — Smart bookmarks / highlights CRUD

import { Storage } from './storage'
import { t } from '../i18n'

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple'

export interface Highlight {
  id: string
  url: string
  title: string
  text: string
  note?: string
  aiSummary?: string
  color: HighlightColor
  xpath: string
  textOffset: number
  tags: string[]
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'hchat:highlights'
const INDEX_KEY = 'hchat:highlight-index'

interface HighlightIndex {
  id: string
  url: string
  ts: number
}

export const Bookmarks = {
  async list(filters?: { url?: string; tag?: string; query?: string }): Promise<Highlight[]> {
    const all = (await Storage.get<Highlight[]>(STORAGE_KEY)) ?? []
    if (!filters) return all

    return all.filter((h) => {
      if (filters.url && h.url !== filters.url) return false
      if (filters.tag && !h.tags.includes(filters.tag)) return false
      if (filters.query) {
        const q = filters.query.toLowerCase()
        const searchable = `${h.text} ${h.note ?? ''} ${h.aiSummary ?? ''} ${h.tags.join(' ')}`.toLowerCase()
        if (!searchable.includes(q)) return false
      }
      return true
    })
  },

  async add(data: Omit<Highlight, 'id' | 'createdAt' | 'updatedAt'>): Promise<Highlight> {
    const all = (await Storage.get<Highlight[]>(STORAGE_KEY)) ?? []
    const highlight: Highlight = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    all.unshift(highlight)
    await Storage.set(STORAGE_KEY, all)
    await this._updateIndex(all)
    return highlight
  },

  async update(id: string, patch: Partial<Highlight>): Promise<void> {
    const all = (await Storage.get<Highlight[]>(STORAGE_KEY)) ?? []
    const idx = all.findIndex((h) => h.id === id)
    if (idx === -1) return
    all[idx] = { ...all[idx], ...patch, updatedAt: Date.now() }
    await Storage.set(STORAGE_KEY, all)
  },

  async delete(id: string): Promise<void> {
    const all = (await Storage.get<Highlight[]>(STORAGE_KEY)) ?? []
    const filtered = all.filter((h) => h.id !== id)
    await Storage.set(STORAGE_KEY, filtered)
    await this._updateIndex(filtered)
  },

  async getByUrl(url: string): Promise<Highlight[]> {
    return this.list({ url })
  },

  async getAllTags(): Promise<string[]> {
    const all = (await Storage.get<Highlight[]>(STORAGE_KEY)) ?? []
    const tags = new Set<string>()
    for (const h of all) h.tags.forEach((t) => tags.add(t))
    return [...tags].sort()
  },

  async count(): Promise<number> {
    const all = (await Storage.get<Highlight[]>(STORAGE_KEY)) ?? []
    return all.length
  },

  async _updateIndex(all: Highlight[]): Promise<void> {
    const index: HighlightIndex[] = all.map((h) => ({
      id: h.id,
      url: h.url,
      ts: h.createdAt,
    }))
    await Storage.set(INDEX_KEY, index)
  },
}

// Utility: get XPath for a DOM element
export function getXPathForElement(node: Node): string {
  if (node.nodeType === Node.DOCUMENT_NODE) return '/'

  const parts: string[] = []
  let current: Node | null = node

  while (current && current !== document.documentElement) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as Element
      let index = 1
      let sibling = el.previousElementSibling
      while (sibling) {
        if (sibling.nodeName === el.nodeName) index++
        sibling = sibling.previousElementSibling
      }
      parts.unshift(`${el.nodeName.toLowerCase()}[${index}]`)
    } else if (current.nodeType === Node.TEXT_NODE) {
      let index = 1
      let sibling = current.previousSibling
      while (sibling) {
        if (sibling.nodeType === Node.TEXT_NODE) index++
        sibling = sibling.previousSibling
      }
      parts.unshift(`text()[${index}]`)
    }
    current = current.parentNode
  }

  return '/' + parts.join('/')
}

// Utility: format relative time (locale-aware)
export function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return t('timeAgo.justNow')
  const min = Math.floor(sec / 60)
  if (min < 60) return t('timeAgo.minutesAgo', { n: min })
  const hr = Math.floor(min / 60)
  if (hr < 24) return t('timeAgo.hoursAgo', { n: hr })
  const day = Math.floor(hr / 24)
  if (day < 7) return t('timeAgo.daysAgo', { n: day })
  return new Date(ts).toLocaleDateString()
}
