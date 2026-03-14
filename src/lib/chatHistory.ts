import { Storage } from './storage'
import { t } from '../i18n'
import type { AgentStep } from './agent'
import { updateIndexForMessage, removeFromIndex } from './messageSearch'
import { SK } from './storageKeys'

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
  folderId?: string
}

const PREFIX = SK.CONV_PREFIX
const INDEX_KEY = SK.CONV_INDEX

export const ChatHistory = {
  async listIndex(): Promise<{ id: string; title: string; updatedAt: number; pinned?: boolean; model: string; tags?: string[]; folderId?: string }[]> {
    return (await Storage.get<{id:string;title:string;updatedAt:number;pinned?:boolean;model:string;tags?:string[];folderId?:string}[]>(INDEX_KEY)) ?? []
  },

  async create(model: string): Promise<Conversation> {
    const conv: Conversation = {
      id: crypto.randomUUID(),
      title: t('aiPrompts.newConversation'),
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
    const now = Date.now()
    const messages = [...conv.messages, m]
    const title = (messages.length === 2 && (conv.title === '새 대화' || conv.title === 'New conversation'))
      ? messages[0].content.slice(0, 40)
      : conv.title
    const updated = { ...conv, messages, updatedAt: now, title }
    await Storage.set(PREFIX + convId, updated)
    await this._updateIndex(updated)
    // Update search index incrementally
    await updateIndexForMessage(updated.id, updated.title, m).catch((err) => console.error('Failed to update search index:', err))
    return m
  },

  async updateLastMessage(convId: string, patch: Partial<ChatMessage>): Promise<void> {
    const conv = await this.get(convId)
    if (!conv || !conv.messages.length) return
    const last = conv.messages[conv.messages.length - 1]
    const messages = [...conv.messages.slice(0, -1), { ...last, ...patch }]
    await Storage.set(PREFIX + convId, { ...conv, messages })
  },

  async delete(id: string): Promise<void> {
    await Storage.remove(PREFIX + id)
    const idx = await this.listIndex()
    await Storage.set(INDEX_KEY, idx.filter((c) => c.id !== id))
    // Remove from search index
    await removeFromIndex(id).catch((err) => console.error('Failed to remove from search index:', err))
  },

  async pin(id: string, pinned: boolean): Promise<void> {
    const idx = await this.listIndex()
    const i = idx.findIndex((c) => c.id === id)
    if (i !== -1) { await Storage.set(INDEX_KEY, idx.map((c, j) => j === i ? { ...c, pinned } : c)) }
  },

  async setTags(id: string, tags: string[]): Promise<void> {
    const conv = await this.get(id)
    if (!conv) return
    await Storage.set(PREFIX + id, { ...conv, tags })
    const idx = await this.listIndex()
    const i = idx.findIndex((c) => c.id === id)
    if (i !== -1) { await Storage.set(INDEX_KEY, idx.map((c, j) => j === i ? { ...c, tags } : c)) }
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

  async setFolder(id: string, folderId: string | undefined): Promise<void> {
    const conv = await this.get(id)
    if (!conv) return
    await Storage.set(PREFIX + id, { ...conv, folderId })
    const idx = await this.listIndex()
    const i = idx.findIndex((c) => c.id === id)
    if (i !== -1) { await Storage.set(INDEX_KEY, idx.map((c, j) => j === i ? { ...c, folderId } : c)) }
  },

  async setPersona(id: string, personaId: string): Promise<void> {
    const conv = await this.get(id)
    if (!conv) return
    await Storage.set(PREFIX + id, { ...conv, personaId })
  },

  /** Update a specific message's content */
  async updateMessage(convId: string, msgId: string, content: string): Promise<void> {
    const conv = await this.get(convId)
    if (!conv) return
    const msgIdx = conv.messages.findIndex((m) => m.id === msgId)
    if (msgIdx === -1) return
    const messages = conv.messages.map((m, i) => i === msgIdx ? { ...m, content } : m)
    await Storage.set(PREFIX + convId, { ...conv, messages, updatedAt: Date.now() })
  },

  /** Remove all messages after (and including) a given message ID */
  async truncateAfter(convId: string, msgId: string): Promise<ChatMessage[]> {
    const conv = await this.get(convId)
    if (!conv) return []
    const msgIdx = conv.messages.findIndex((m) => m.id === msgId)
    if (msgIdx === -1) return conv.messages
    const messages = conv.messages.slice(0, msgIdx)
    await Storage.set(PREFIX + convId, { ...conv, messages, updatedAt: Date.now() })
    return messages
  },

  /** Fork conversation from a specific message — creates a new conversation with messages up to that point */
  async fork(convId: string, upToMsgId: string): Promise<Conversation | null> {
    const source = await this.get(convId)
    if (!source) return null
    const msgIdx = source.messages.findIndex((m) => m.id === upToMsgId)
    if (msgIdx === -1) return null

    const forked: Conversation = {
      id: crypto.randomUUID(),
      title: `${source.title} ${t('chat.forkSuffix')}`,
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
    const msgIdx = conv.messages.findIndex((m) => m.id === msgId)
    if (msgIdx === -1) return false
    const newPinned = !conv.messages[msgIdx].pinned
    const messages = conv.messages.map((m, i) => i === msgIdx ? { ...m, pinned: newPinned } : m)
    await Storage.set(PREFIX + convId, { ...conv, messages })
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
    const newIdx = [{ id: conv.id, title: conv.title, updatedAt: conv.updatedAt, model: conv.model, tags: conv.tags, folderId: conv.folderId }, ...idx]
    await Storage.set(INDEX_KEY, newIdx.slice(0, 200))
  },

  async _updateIndex(conv: Conversation): Promise<void> {
    const idx = await this.listIndex()
    const i = idx.findIndex((c) => c.id === conv.id)
    const updatedIdx = i !== -1 ? idx.map((c, j) => j === i ? { ...c, title: conv.title, updatedAt: conv.updatedAt } : c) : idx
    await Storage.set(INDEX_KEY, updatedIdx)
  },
}
