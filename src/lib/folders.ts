/** Conversation folder management */

import { Storage } from './storage'

export interface Folder {
  id: string
  name: string
  color: string
  createdAt: number
}

const KEY = 'hchat:folders'

const DEFAULT_COLORS = ['#34d399', '#60a5fa', '#fbbf24', '#f472b6', '#a78bfa', '#fb923c']

export const Folders = {
  async list(): Promise<Folder[]> {
    return (await Storage.get<Folder[]>(KEY)) ?? []
  },

  async create(name: string, color?: string): Promise<Folder> {
    const folders = await this.list()
    const folder: Folder = {
      id: crypto.randomUUID(),
      name: name.trim(),
      color: color ?? DEFAULT_COLORS[folders.length % DEFAULT_COLORS.length],
      createdAt: Date.now(),
    }
    await Storage.set(KEY, [...folders, folder])
    return folder
  },

  async rename(id: string, name: string): Promise<void> {
    const folders = await this.list()
    const updated = folders.map((f) => (f.id === id ? { ...f, name: name.trim() } : f))
    await Storage.set(KEY, updated)
  },

  async delete(id: string): Promise<void> {
    const folders = await this.list()
    await Storage.set(KEY, folders.filter((f) => f.id !== id))
  },
}
