// lib/aiMemory.ts — AI memory system for persistent user context

import { Storage } from './storage'

const STORAGE_KEY = 'hchat:ai-memories'
const MAX_MEMORIES = 100

// ── Types ──

export interface Memory {
  id: string
  category: 'name' | 'preference' | 'project' | 'fact' | 'custom'
  content: string
  source?: string
  createdAt: number
  approved: boolean
}

export interface ExtractedMemory {
  category: Memory['category']
  content: string
  source: string
  confidence: number
}

// ── CRUD ──

export async function getMemories(): Promise<Memory[]> {
  const data = await Storage.get<Memory[]>(STORAGE_KEY)
  return data ?? []
}

async function saveMemories(memories: Memory[]): Promise<void> {
  await Storage.set(STORAGE_KEY, memories)
}

export async function addMemory(
  input: Omit<Memory, 'id' | 'createdAt'>
): Promise<Memory> {
  const memories = await getMemories()
  const memory: Memory = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  }

  const updated = [...memories, memory]
  const trimmed = updated.length > MAX_MEMORIES
    ? updated.slice(updated.length - MAX_MEMORIES)
    : updated

  await saveMemories(trimmed)
  return memory
}

export async function updateMemory(
  id: string,
  patch: Partial<Omit<Memory, 'id' | 'createdAt'>>
): Promise<Memory> {
  const memories = await getMemories()
  const index = memories.findIndex((m) => m.id === id)

  if (index === -1) {
    throw new Error('Memory not found')
  }

  const updated: Memory = { ...memories[index], ...patch }
  const next = memories.map((m, i) => (i === index ? updated : m))
  await saveMemories(next)
  return updated
}

export async function deleteMemory(id: string): Promise<void> {
  const memories = await getMemories()
  const index = memories.findIndex((m) => m.id === id)

  if (index === -1) {
    throw new Error('Memory not found')
  }

  await saveMemories(memories.filter((m) => m.id !== id))
}

// ── Extract ──

interface Message {
  role: string
  content: string
}

const NAME_PATTERNS: { regex: RegExp; group: number; confidence: number }[] = [
  { regex: /제\s*이름은\s+([가-힣]{2,5})/, group: 1, confidence: 0.9 },
  { regex: /I'm\s+([A-Z][a-z]+)/, group: 1, confidence: 0.8 },
  { regex: /私は([一-龯ぁ-んァ-ヶ]{1,10})です/, group: 1, confidence: 0.85 },
]

const PREFERENCE_PATTERNS: { regex: RegExp; group: number; confidence: number }[] = [
  { regex: /(.{2,30})를\s*선호/, group: 1, confidence: 0.8 },
  { regex: /(.{2,30})가\s*좋아/, group: 1, confidence: 0.7 },
  { regex: /prefer\s+(.{2,40}?)(?:\.|,|$)/i, group: 1, confidence: 0.8 },
]

const PROJECT_PATTERNS: { regex: RegExp; group: number; confidence: number }[] = [
  { regex: /(.{2,30})\s*프로젝트/, group: 1, confidence: 0.75 },
  { regex: /working\s+on\s+(?:a\s+)?(.{2,40}?)(?:\.|,|$)/i, group: 1, confidence: 0.8 },
]

export function extractMemories(messages: Message[]): ExtractedMemory[] {
  const results: ExtractedMemory[] = []

  const userMessages = messages.filter((m) => m.role === 'user')

  for (const msg of userMessages) {
    const text = msg.content

    for (const pattern of NAME_PATTERNS) {
      const match = text.match(pattern.regex)
      if (match) {
        results.push({
          category: 'name',
          content: match[pattern.group].trim(),
          source: match[0],
          confidence: pattern.confidence,
        })
      }
    }

    for (const pattern of PREFERENCE_PATTERNS) {
      const match = text.match(pattern.regex)
      if (match) {
        results.push({
          category: 'preference',
          content: match[pattern.group].trim(),
          source: match[0],
          confidence: pattern.confidence,
        })
      }
    }

    for (const pattern of PROJECT_PATTERNS) {
      const match = text.match(pattern.regex)
      if (match) {
        results.push({
          category: 'project',
          content: match[pattern.group].trim(),
          source: match[0],
          confidence: pattern.confidence,
        })
      }
    }
  }

  return results
}

// ── Search ──

export async function searchMemories(query: string): Promise<Memory[]> {
  const memories = await getMemories()

  if (!query.trim()) {
    return memories
  }

  const lower = query.toLowerCase()
  return memories.filter(
    (m) =>
      m.content.toLowerCase().includes(lower) ||
      m.category.toLowerCase().includes(lower) ||
      (m.source?.toLowerCase().includes(lower) ?? false)
  )
}

// ── System prompt injection ──

export async function buildMemoryContext(_query: string): Promise<string> {
  const memories = await getMemories()
  const approved = memories.filter((m) => m.approved)

  if (approved.length === 0) {
    return ''
  }

  const lines = approved.map(
    (m) => `- [${m.category}] ${m.content}`
  )

  return `[User Memory]\n${lines.join('\n')}`
}

// ── Export / Import ──

export async function exportMemories(): Promise<string> {
  const memories = await getMemories()
  return JSON.stringify(memories, null, 2)
}

export async function importMemories(json: string): Promise<number> {
  let incoming: Memory[]
  try {
    incoming = JSON.parse(json)
  } catch {
    throw new Error('Invalid JSON format')
  }

  if (!Array.isArray(incoming)) {
    throw new Error('Invalid memory data: expected array')
  }

  const existing = await getMemories()
  const existingIds = new Set(existing.map((m) => m.id))

  const newItems = incoming.filter((m) => !existingIds.has(m.id))

  if (newItems.length === 0) {
    return 0
  }

  const merged = [...existing, ...newItems]
  const trimmed = merged.length > MAX_MEMORIES
    ? merged.slice(merged.length - MAX_MEMORIES)
    : merged

  await saveMemories(trimmed)
  return newItems.length
}
