import { Storage } from './storage'
import type { AgentStep } from './agent'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  model?: string
  ts: number
  streaming?: boolean
  error?: boolean
  imageUrl?: string
  searchSources?: { title: string; url: string }[]
  agentSteps?: AgentStep[]
  pinned?: boolean
}

export interface Conversation {
  id: string
  title: string
  model: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
  pinned?: boolean
  tags?: string[]
  personaId?: string
}

const PREFIX = 'hchat:conv:'
const INDEX_KEY = 'hchat:conv-index'

export const ChatHistory = {
  async listIndex(): Promise<{ id: string; title: string; updatedAt: number; pinned?: boolean; model: string; tags?: string[] }[]> {
    return (await Storage.get<{id:string;title:string;updatedAt:number;pinned?:boolean;model:string;tags?:string[]}[]>(INDEX_KEY)) ?? []
  },

  async create(model: string): Promise<Conversation> {
    const conv: Conversation = {
      id: crypto.randomUUID(),
      title: '새 대화',
      model,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await Storage.set(PREFIX + conv.id, conv)
    await this._addToIndex(conv)
    return conv
  },

  async get(id: string): Promise<Conversation | null> {
    return Storage.get<Conversation>(PREFIX + id)
  },

  async addMessage(convId: string, msg: Omit<ChatMessage, 'id' | 'ts'>): Promise<ChatMessage> {
    const conv = await this.get(convId)
    if (!conv) throw new Error('Conversation not found')
    const m: ChatMessage = { ...msg, id: crypto.randomUUID(), ts: Date.now() }
    conv.messages.push(m)
    conv.updatedAt = Date.now()
    if (conv.messages.length === 2 && conv.title === '새 대화') {
      conv.title = conv.messages[0].content.slice(0, 40)
    }
    await Storage.set(PREFIX + convId, conv)
    await this._updateIndex(conv)
    return m
  },

  async updateLastMessage(convId: string, patch: Partial<ChatMessage>): Promise<void> {
    const conv = await this.get(convId)
    if (!conv || !conv.messages.length) return
    const last = conv.messages[conv.messages.length - 1]
    conv.messages[conv.messages.length - 1] = { ...last, ...patch }
    await Storage.set(PREFIX + convId, conv)
  },

  async delete(id: string): Promise<void> {
    await Storage.remove(PREFIX + id)
    const idx = await this.listIndex()
    await Storage.set(INDEX_KEY, idx.filter((c) => c.id !== id))
  },

  async pin(id: string, pinned: boolean): Promise<void> {
    const idx = await this.listIndex()
    const i = idx.findIndex((c) => c.id === id)
    if (i !== -1) { idx[i].pinned = pinned; await Storage.set(INDEX_KEY, idx) }
  },

  async setTags(id: string, tags: string[]): Promise<void> {
    const conv = await this.get(id)
    if (!conv) return
    conv.tags = tags
    await Storage.set(PREFIX + id, conv)
    const idx = await this.listIndex()
    const i = idx.findIndex((c) => c.id === id)
    if (i !== -1) { idx[i].tags = tags; await Storage.set(INDEX_KEY, idx) }
  },

  async addTag(id: string, tag: string): Promise<void> {
    const conv = await this.get(id)
    if (!conv) return
    const tags = [...(conv.tags ?? [])]
    if (!tags.includes(tag)) {
      tags.push(tag)
      await this.setTags(id, tags)
    }
  },

  async removeTag(id: string, tag: string): Promise<void> {
    const conv = await this.get(id)
    if (!conv) return
    await this.setTags(id, (conv.tags ?? []).filter((t) => t !== tag))
  },

  async setPersona(id: string, personaId: string): Promise<void> {
    const conv = await this.get(id)
    if (!conv) return
    conv.personaId = personaId
    await Storage.set(PREFIX + id, conv)
  },

  /** Update a specific message's content */
  async updateMessage(convId: string, msgId: string, content: string): Promise<void> {
    const conv = await this.get(convId)
    if (!conv) return
    const idx = conv.messages.findIndex((m) => m.id === msgId)
    if (idx === -1) return
    conv.messages[idx] = { ...conv.messages[idx], content }
    conv.updatedAt = Date.now()
    await Storage.set(PREFIX + convId, conv)
  },

  /** Remove all messages after (and including) a given message ID */
  async truncateAfter(convId: string, msgId: string): Promise<ChatMessage[]> {
    const conv = await this.get(convId)
    if (!conv) return []
    const idx = conv.messages.findIndex((m) => m.id === msgId)
    if (idx === -1) return conv.messages
    conv.messages = conv.messages.slice(0, idx)
    conv.updatedAt = Date.now()
    await Storage.set(PREFIX + convId, conv)
    return conv.messages
  },

  /** Fork conversation from a specific message — creates a new conversation with messages up to that point */
  async fork(convId: string, upToMsgId: string): Promise<Conversation | null> {
    const source = await this.get(convId)
    if (!source) return null
    const msgIdx = source.messages.findIndex((m) => m.id === upToMsgId)
    if (msgIdx === -1) return null

    const forked: Conversation = {
      id: crypto.randomUUID(),
      title: `${source.title} (분기)`,
      model: source.model,
      messages: source.messages.slice(0, msgIdx + 1).map((m) => ({
        ...m,
        id: crypto.randomUUID(),
        pinned: undefined,
      })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: source.tags ? [...source.tags] : undefined,
      personaId: source.personaId,
    }
    await Storage.set(PREFIX + forked.id, forked)
    await this._addToIndex(forked)
    return forked
  },

  /** Toggle pin on a message within a conversation */
  async toggleMessagePin(convId: string, msgId: string): Promise<boolean> {
    const conv = await this.get(convId)
    if (!conv) return false
    const idx = conv.messages.findIndex((m) => m.id === msgId)
    if (idx === -1) return false
    const newPinned = !conv.messages[idx].pinned
    conv.messages[idx] = { ...conv.messages[idx], pinned: newPinned }
    await Storage.set(PREFIX + convId, conv)
    return newPinned
  },

  /** Get pinned messages for a conversation */
  async getPinnedMessages(convId: string): Promise<ChatMessage[]> {
    const conv = await this.get(convId)
    if (!conv) return []
    return conv.messages.filter((m) => m.pinned)
  },

  async _addToIndex(conv: Conversation): Promise<void> {
    const idx = await this.listIndex()
    idx.unshift({ id: conv.id, title: conv.title, updatedAt: conv.updatedAt, model: conv.model, tags: conv.tags })
    await Storage.set(INDEX_KEY, idx.slice(0, 200))
  },

  async _updateIndex(conv: Conversation): Promise<void> {
    const idx = await this.listIndex()
    const i = idx.findIndex((c) => c.id === conv.id)
    if (i !== -1) { idx[i] = { ...idx[i], title: conv.title, updatedAt: conv.updatedAt } }
    await Storage.set(INDEX_KEY, idx)
  },
}
