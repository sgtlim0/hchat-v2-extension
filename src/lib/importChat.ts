/** Import conversations from external AI chat exports */

import { Storage } from './storage'
import type { Conversation } from './chatHistory'
import { SK } from './storageKeys'

export type ImportSource = 'chatgpt' | 'claude' | 'hchat' | 'unknown'

export interface ImportResult {
  success: boolean
  count: number
  source: ImportSource
  errors: string[]
}

/** Detect the source of an export file */
function detectSource(data: unknown): ImportSource {
  if (!data || typeof data !== 'object') return 'unknown'

  // ChatGPT: array with mapping field
  if (Array.isArray(data)) {
    const first = data[0]
    if (first && typeof first === 'object' && 'mapping' in first) return 'chatgpt'
    // H Chat array format: requires messages array
    if (first && typeof first === 'object' && 'messages' in first && Array.isArray((first as Record<string, unknown>).messages)) return 'hchat'
  }

  // Claude: single object with chat_messages array
  if ('chat_messages' in data && Array.isArray((data as Record<string, unknown>).chat_messages)) return 'claude'

  // H Chat: single conversation or wrapped export
  if ('conversation' in data) {
    const conv = (data as Record<string, unknown>).conversation
    if (conv && typeof conv === 'object' && 'messages' in conv) return 'hchat'
  }
  // H Chat single conversation: just needs messages array
  if ('messages' in data && Array.isArray((data as Record<string, unknown>).messages)) return 'hchat'

  return 'unknown'
}

/** Parse ChatGPT export format */
function parseChatGPT(data: unknown[]): Omit<Conversation, 'id'>[] {
  const results: Omit<Conversation, 'id'>[] = []

  for (const item of data) {
    if (!item || typeof item !== 'object') continue
    const conv = item as Record<string, unknown>

    const title = (conv.title as string) || '가져온 대화'
    const mapping = conv.mapping as Record<string, unknown> | undefined
    const messages: { role: 'user' | 'assistant'; content: string; ts: number }[] = []

    if (mapping && typeof mapping === 'object') {
      const nodes = Object.values(mapping)
        .filter((n): n is { message: { author: { role: string }; content: { parts?: string[] }; create_time?: number } } => {
          if (!n || typeof n !== 'object') return false
          const node = n as Record<string, unknown>
          if (!node.message || typeof node.message !== 'object') return false
          const msg = node.message as Record<string, unknown>
          if (!msg.author || typeof msg.author !== 'object') return false
          const author = msg.author as Record<string, unknown>
          return author.role === 'user' || author.role === 'assistant'
        })
        .sort((a, b) => (a.message.create_time ?? 0) - (b.message.create_time ?? 0))

      for (const node of nodes) {
        const msg = node.message
        const parts = msg.content.parts
        const content = Array.isArray(parts) ? parts.filter((p): p is string => typeof p === 'string').join('\n') : ''
        if (!content.trim()) continue
        messages.push({
          role: msg.author.role as 'user' | 'assistant',
          content,
          ts: (msg.create_time ?? Date.now() / 1000) * 1000,
        })
      }
    }

    if (messages.length === 0) continue

    const createTime = typeof conv.create_time === 'number' ? conv.create_time * 1000 : Date.now()

    results.push({
      title,
      model: 'chatgpt-import',
      messages: messages.map((m) => ({
        id: crypto.randomUUID(),
        role: m.role,
        content: m.content,
        ts: m.ts,
      })),
      createdAt: createTime,
      updatedAt: createTime,
    })
  }

  return results
}

/** Parse Claude export format */
function parseClaude(data: Record<string, unknown>): Omit<Conversation, 'id'>[] {
  const chatMessages = data.chat_messages
  if (!chatMessages || !Array.isArray(chatMessages)) return []

  const messages = chatMessages
    .filter((item): item is { sender: string; text: string; created_at?: string } => {
      if (!item || typeof item !== 'object') return false
      const m = item as Record<string, unknown>
      return (m.sender === 'human' || m.sender === 'assistant') && typeof m.text === 'string'
    })
    .map((m) => ({
      id: crypto.randomUUID(),
      role: (m.sender === 'human' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.text || '',
      ts: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
    }))
    .filter((m) => m.content.trim())

  if (messages.length === 0) return []

  const title = (typeof data.name === 'string' ? data.name : null) || messages[0]?.content.slice(0, 40) || '가져온 대화'

  return [{
    title,
    model: 'claude-import',
    messages,
    createdAt: messages[0]?.ts ?? Date.now(),
    updatedAt: messages[messages.length - 1]?.ts ?? Date.now(),
  }]
}

/** Parse H Chat native export format */
function parseHChat(data: unknown): Omit<Conversation, 'id'>[] {
  // Handle wrapped export format (with metadata)
  if (data && typeof data === 'object' && 'conversation' in data) {
    const wrapped = data as Record<string, unknown>
    if (wrapped.conversation && typeof wrapped.conversation === 'object') {
      data = wrapped.conversation
    }
  }

  if (Array.isArray(data)) {
    return data
      .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
      .map((conv) => ({
        title: (typeof conv.title === 'string' ? conv.title : null) || '가져온 대화',
        model: (typeof conv.model === 'string' ? conv.model : null) || 'unknown',
        messages: (Array.isArray(conv.messages) ? conv.messages : [])
          .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
          .map((m) => ({
            id: crypto.randomUUID(),
            role: (m.role === 'user' || m.role === 'assistant' ? m.role : 'user') as 'user' | 'assistant',
            content: (typeof m.content === 'string' ? m.content : null) || '',
            ts: (typeof m.ts === 'number' ? m.ts : null) || Date.now(),
            model: typeof m.model === 'string' ? m.model : undefined,
          }))
          .filter((m) => m.content.trim()),
        createdAt: (typeof conv.createdAt === 'number' ? conv.createdAt : null) || Date.now(),
        updatedAt: (typeof conv.updatedAt === 'number' ? conv.updatedAt : null) || Date.now(),
      }))
      .filter((c) => c.messages.length > 0)
  }

  // Single conversation
  if (data && typeof data === 'object') {
    const conv = data as Record<string, unknown>
    const messages = (Array.isArray(conv.messages) ? conv.messages : [])
      .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
      .map((m) => ({
        id: crypto.randomUUID(),
        role: (m.role === 'user' || m.role === 'assistant' ? m.role : 'user') as 'user' | 'assistant',
        content: (typeof m.content === 'string' ? m.content : null) || '',
        ts: (typeof m.ts === 'number' ? m.ts : null) || Date.now(),
        model: typeof m.model === 'string' ? m.model : undefined,
      }))
      .filter((m) => m.content.trim())

    if (messages.length > 0) {
      return [{
        title: (typeof conv.title === 'string' ? conv.title : null) || '가져온 대화',
        model: (typeof conv.model === 'string' ? conv.model : null) || 'unknown',
        messages,
        createdAt: (typeof conv.createdAt === 'number' ? conv.createdAt : null) || Date.now(),
        updatedAt: (typeof conv.updatedAt === 'number' ? conv.updatedAt : null) || Date.now(),
      }]
    }
  }

  return []
}

/** Import conversations from a JSON file using batch storage writes for performance */
export async function importFromFile(file: File): Promise<ImportResult> {
  const errors: string[] = []
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    const source = detectSource(data)

    let conversations: Omit<Conversation, 'id'>[] = []

    switch (source) {
      case 'chatgpt':
        conversations = parseChatGPT(data)
        break
      case 'claude':
        conversations = parseClaude(data)
        break
      case 'hchat':
        conversations = parseHChat(data)
        break
      default:
        return { success: false, count: 0, source: 'unknown', errors: ['지원하지 않는 파일 형식입니다'] }
    }

    if (conversations.length === 0) {
      return { success: false, count: 0, source, errors: ['가져올 대화가 없습니다'] }
    }

    // Batch import for performance
    const imported = await batchImportConversations(conversations, errors)

    return { success: imported > 0, count: imported, source, errors }
  } catch (err) {
    return { success: false, count: 0, source: 'unknown', errors: [`파일 파싱 실패: ${String(err)}`] }
  }
}

/** Batch import conversations using efficient storage writes */
async function batchImportConversations(
  conversations: Omit<Conversation, 'id'>[],
  errors: string[],
): Promise<number> {
  const PREFIX = SK.CONV_PREFIX
  const INDEX_KEY = SK.CONV_INDEX

  try {
    // Get current index
    const currentIndex = (await Storage.get<{ id: string; title: string; updatedAt: number; model: string }[]>(INDEX_KEY)) ?? []

    // Prepare all conversations with IDs
    const newConversations: Conversation[] = conversations.map((conv) => ({
      ...conv,
      id: crypto.randomUUID(),
    }))

    // Build batch storage object
    const storageData: Record<string, Conversation> = {}
    for (const conv of newConversations) {
      storageData[PREFIX + conv.id] = conv
    }

    // Write all conversations in one batch
    await Storage.setMultiple(storageData)

    // Update index with new entries (prepend to maintain newest-first order)
    const newIndexEntries = newConversations.map((conv) => ({
      id: conv.id,
      title: conv.title,
      updatedAt: conv.updatedAt,
      model: conv.model,
    }))

    const updatedIndex = [...newIndexEntries, ...currentIndex].slice(0, 200)
    await Storage.set(INDEX_KEY, updatedIndex)

    return newConversations.length
  } catch (err) {
    errors.push(`배치 가져오기 실패: ${String(err)}`)
    return 0
  }
}

/** Get display name for import source */
export function getSourceLabel(source: ImportSource): string {
  const labels: Record<ImportSource, string> = {
    chatgpt: 'ChatGPT',
    claude: 'Claude',
    hchat: 'H Chat',
    unknown: '알 수 없음',
  }
  return labels[source]
}
