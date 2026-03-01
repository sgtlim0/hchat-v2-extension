/** Import conversations from external AI chat exports */

import { ChatHistory, type Conversation } from './chatHistory'

export type ImportSource = 'chatgpt' | 'claude' | 'hchat' | 'unknown'

interface ImportResult {
  success: boolean
  count: number
  source: ImportSource
  errors: string[]
}

/** Detect the source of an export file */
function detectSource(data: unknown): ImportSource {
  if (Array.isArray(data)) {
    // ChatGPT exports an array of conversations
    const first = data[0]
    if (first && 'mapping' in first) return 'chatgpt'
    if (first && 'messages' in first && 'model' in first) return 'hchat'
  }
  if (data && typeof data === 'object' && 'chat_messages' in data) return 'claude'
  if (data && typeof data === 'object' && 'messages' in data && 'model' in data) return 'hchat'
  return 'unknown'
}

/** Parse ChatGPT export format */
function parseChatGPT(data: unknown[]): Omit<Conversation, 'id'>[] {
  return data.map((conv: Record<string, unknown>) => {
    const title = (conv.title as string) || '가져온 대화'
    const mapping = conv.mapping as Record<string, { message?: { author: { role: string }; content: { parts: string[] }; create_time?: number } }>
    const messages: { role: 'user' | 'assistant'; content: string; ts: number }[] = []

    if (mapping) {
      const nodes = Object.values(mapping)
        .filter((n) => n.message && (n.message.author.role === 'user' || n.message.author.role === 'assistant'))
        .sort((a, b) => (a.message!.create_time ?? 0) - (b.message!.create_time ?? 0))

      for (const node of nodes) {
        const msg = node.message!
        const content = msg.content.parts?.join('\n') || ''
        if (!content.trim()) continue
        messages.push({
          role: msg.author.role as 'user' | 'assistant',
          content,
          ts: (msg.create_time ?? Date.now() / 1000) * 1000,
        })
      }
    }

    const createTime = (conv.create_time as number) ? (conv.create_time as number) * 1000 : Date.now()

    return {
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
    }
  }).filter((c) => c.messages.length > 0)
}

/** Parse Claude export format */
function parseClaude(data: Record<string, unknown>): Omit<Conversation, 'id'>[] {
  const chatMessages = data.chat_messages as Array<{ sender: string; text: string; created_at?: string }>
  if (!chatMessages || !Array.isArray(chatMessages)) return []

  const messages = chatMessages
    .filter((m) => m.sender === 'human' || m.sender === 'assistant')
    .map((m) => ({
      id: crypto.randomUUID(),
      role: (m.sender === 'human' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.text || '',
      ts: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
    }))
    .filter((m) => m.content.trim())

  if (messages.length === 0) return []

  const title = (data.name as string) || messages[0]?.content.slice(0, 40) || '가져온 대화'

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
  if (Array.isArray(data)) {
    return data.map((conv: Record<string, unknown>) => ({
      title: (conv.title as string) || '가져온 대화',
      model: (conv.model as string) || 'unknown',
      messages: ((conv.messages as Array<Record<string, unknown>>) || []).map((m) => ({
        id: crypto.randomUUID(),
        role: (m.role as 'user' | 'assistant') || 'user',
        content: (m.content as string) || '',
        ts: (m.ts as number) || Date.now(),
        model: m.model as string | undefined,
      })),
      createdAt: (conv.createdAt as number) || Date.now(),
      updatedAt: (conv.updatedAt as number) || Date.now(),
    }))
  }
  // Single conversation
  const conv = data as Record<string, unknown>
  return [{
    title: (conv.title as string) || '가져온 대화',
    model: (conv.model as string) || 'unknown',
    messages: ((conv.messages as Array<Record<string, unknown>>) || []).map((m) => ({
      id: crypto.randomUUID(),
      role: (m.role as 'user' | 'assistant') || 'user',
      content: (m.content as string) || '',
      ts: (m.ts as number) || Date.now(),
      model: m.model as string | undefined,
    })),
    createdAt: (conv.createdAt as number) || Date.now(),
    updatedAt: (conv.updatedAt as number) || Date.now(),
  }]
}

/** Import conversations from a JSON file */
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

    let imported = 0
    for (const conv of conversations) {
      try {
        const created = await ChatHistory.create(conv.model)
        // Add messages one by one
        for (const msg of conv.messages) {
          await ChatHistory.addMessage(created.id, {
            role: msg.role,
            content: msg.content,
            model: msg.model,
          })
        }
        imported++
      } catch (err) {
        errors.push(`대화 가져오기 실패: ${String(err)}`)
      }
    }

    return { success: imported > 0, count: imported, source, errors }
  } catch (err) {
    return { success: false, count: 0, source: 'unknown', errors: [`파일 파싱 실패: ${String(err)}`] }
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
