/** Storage usage analysis and cleanup utilities */

import { Storage } from './storage'

export interface StorageBreakdown {
  total: number
  conversations: number
  bookmarks: number
  usage: number
  config: number
  docProjects: number
  docTemplates: number
  other: number
  conversationCount: number
}

const SIZE_UNITS = ['B', 'KB', 'MB', 'GB']

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), SIZE_UNITS.length - 1)
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(i === 0 ? 0 : 1)} ${SIZE_UNITS[i]}`
}

/** Analyze storage usage by category */
export async function analyzeStorage(): Promise<StorageBreakdown> {
  const all = await chrome.storage.local.get(null)
  const breakdown: StorageBreakdown = {
    total: 0,
    conversations: 0,
    bookmarks: 0,
    usage: 0,
    config: 0,
    docProjects: 0,
    docTemplates: 0,
    other: 0,
    conversationCount: 0,
  }

  for (const [key, value] of Object.entries(all)) {
    const size = JSON.stringify(value).length * 2 // UTF-16 estimate
    breakdown.total += size

    if (key.startsWith('hchat:conv:') || key === 'hchat:conv-index') {
      breakdown.conversations += size
      if (key.startsWith('hchat:conv:') && key !== 'hchat:conv-index') {
        breakdown.conversationCount++
      }
    } else if (key === 'hchat:bookmarks' || key.startsWith('hchat:highlights')) {
      breakdown.bookmarks += size
    } else if (key.startsWith('hchat:usage')) {
      breakdown.usage += size
    } else if (key === 'hchat:config') {
      breakdown.config += size
    } else if (key === 'hchat:doc-projects' || key.startsWith('hchat:doc-project:')) {
      breakdown.docProjects += size
    } else if (key === 'hchat:doc-templates') {
      breakdown.docTemplates += size
    } else {
      breakdown.other += size
    }
  }

  return breakdown
}

/** Find old conversations that could be cleaned up */
export async function findOldConversations(
  olderThanDays: number,
): Promise<{ id: string; title: string; updatedAt: number; messageCount: number; sizeBytes: number }[]> {
  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000
  const index =
    (await Storage.get<{ id: string; title: string; updatedAt: number; pinned?: boolean }[]>('hchat:conv-index')) ?? []

  const candidates = index.filter((item) => !item.pinned && item.updatedAt < cutoff)
  const results: { id: string; title: string; updatedAt: number; messageCount: number; sizeBytes: number }[] = []

  for (const item of candidates) {
    const conv = await Storage.get<{ messages?: unknown[] }>(`hchat:conv:${item.id}`)
    if (!conv) continue
    const size = JSON.stringify(conv).length * 2
    results.push({
      id: item.id,
      title: item.title,
      updatedAt: item.updatedAt,
      messageCount: conv.messages?.length ?? 0,
      sizeBytes: size,
    })
  }

  return results.sort((a, b) => a.updatedAt - b.updatedAt)
}

/** Delete specific conversations and update index */
export async function deleteConversations(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0

  const idSet = new Set(ids)
  const index =
    (await Storage.get<{ id: string; title: string; updatedAt: number; pinned?: boolean; model: string }[]>(
      'hchat:conv-index',
    )) ?? []
  const newIndex = index.filter((item) => !idSet.has(item.id))
  await Storage.set('hchat:conv-index', newIndex)

  const removeKeys = ids.map((id) => `hchat:conv:${id}`)
  await chrome.storage.local.remove(removeKeys)

  return ids.length
}

/** Clean up orphaned conversation data (keys without index entries) */
export async function cleanupOrphans(): Promise<number> {
  const index =
    (await Storage.get<{ id: string }[]>('hchat:conv-index')) ?? []
  const indexIds = new Set(index.map((item) => item.id))

  const all = await chrome.storage.local.get(null)
  const orphanKeys = Object.keys(all).filter((key) => {
    if (!key.startsWith('hchat:conv:')) return false
    const id = key.replace('hchat:conv:', '')
    return !indexIds.has(id)
  })

  if (orphanKeys.length > 0) {
    await chrome.storage.local.remove(orphanKeys)
  }

  return orphanKeys.length
}
