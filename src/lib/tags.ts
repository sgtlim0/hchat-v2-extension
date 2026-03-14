// lib/tags.ts — Conversation tag management

import { Storage } from './storage'
import { SK } from './storageKeys'

export interface TagDef {
  name: string
  color: string
  count: number
}

const TAGS_KEY = SK.TAGS

const DEFAULT_COLORS = ['#34d399', '#60a5fa', '#a78bfa', '#fbbf24', '#f87171', '#fb923c', '#e879f9', '#22d3ee']

export const Tags = {
  async list(): Promise<TagDef[]> {
    return (await Storage.get<TagDef[]>(TAGS_KEY)) ?? []
  },

  async add(name: string): Promise<TagDef> {
    const tags = await this.list()
    const existing = tags.find((t) => t.name === name)
    if (existing) return existing
    const color = DEFAULT_COLORS[tags.length % DEFAULT_COLORS.length]
    const tag: TagDef = { name, color, count: 0 }
    tags.push(tag)
    await Storage.set(TAGS_KEY, tags)
    return tag
  },

  async remove(name: string): Promise<void> {
    const tags = await this.list()
    await Storage.set(TAGS_KEY, tags.filter((t) => t.name !== name))
  },

  async incrementCount(name: string): Promise<void> {
    const tags = await this.list()
    const tag = tags.find((t) => t.name === name)
    if (tag) {
      tag.count += 1
      await Storage.set(TAGS_KEY, tags)
    }
  },

  async decrementCount(name: string): Promise<void> {
    const tags = await this.list()
    const tag = tags.find((t) => t.name === name)
    if (tag && tag.count > 0) {
      tag.count -= 1
      await Storage.set(TAGS_KEY, tags)
    }
  },

  async getColor(name: string): Promise<string> {
    const tags = await this.list()
    return tags.find((t) => t.name === name)?.color ?? DEFAULT_COLORS[0]
  },
}
