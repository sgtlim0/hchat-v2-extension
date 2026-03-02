/** Full-text search across all conversation messages with optimized indexing */

import { ChatHistory, type ChatMessage } from './chatHistory'
import { Storage } from './storage'

export interface SearchResult {
  convId: string
  convTitle: string
  message: ChatMessage
  matchSnippet: string
  matchIndex: number
  relevanceScore: number
}

interface InvertedIndex {
  /** Map from normalized token to list of document IDs */
  tokens: Record<string, string[]>
  /** Map from document ID to document metadata */
  docs: Record<string, IndexedDocument>
  /** Last index build timestamp */
  builtAt: number
}

interface IndexedDocument {
  convId: string
  convTitle: string
  msgId: string
  content: string
  role: 'user' | 'assistant'
  ts: number
}

const INDEX_KEY = 'hchat:search-index'
const INDEX_VERSION_KEY = 'hchat:search-index-version'
const CURRENT_VERSION = 1

let memoryIndex: InvertedIndex | null = null

/** Build trigrams for Korean/CJK fuzzy matching */
function buildTrigrams(text: string): string[] {
  if (text.length < 3) return [text.toLowerCase()]
  const trigrams: string[] = []
  const normalized = text.toLowerCase()
  for (let i = 0; i <= normalized.length - 3; i++) {
    trigrams.push(normalized.slice(i, i + 3))
  }
  return trigrams
}

/** Tokenize text into searchable terms (words + trigrams) */
function tokenize(text: string): string[] {
  const tokens = new Set<string>()
  const normalized = text.toLowerCase()

  // Extract words (Latin/Hangul/CJK boundaries)
  const words = normalized.match(/[\p{L}\p{N}]+/gu) ?? []
  words.forEach((w) => tokens.add(w))

  // Add trigrams for each word (for partial matching)
  words.forEach((w) => {
    if (w.length >= 3) {
      buildTrigrams(w).forEach((t) => tokens.add(t))
    }
  })

  return Array.from(tokens)
}

/** Build inverted index from all conversations */
async function buildIndex(): Promise<InvertedIndex> {
  const index: InvertedIndex = {
    tokens: {},
    docs: {},
    builtAt: Date.now(),
  }

  const convIndex = await ChatHistory.listIndex()
  const convs = await Promise.all(convIndex.map((item) => ChatHistory.get(item.id)))

  for (const conv of convs) {
    if (!conv) continue

    for (const msg of conv.messages) {
      const docId = `${conv.id}:${msg.id}`

      // Store document metadata
      index.docs[docId] = {
        convId: conv.id,
        convTitle: conv.title,
        msgId: msg.id,
        content: msg.content,
        role: msg.role,
        ts: msg.ts,
      }

      // Index title tokens
      const titleTokens = tokenize(conv.title)
      titleTokens.forEach((token) => {
        if (!index.tokens[token]) index.tokens[token] = []
        if (!index.tokens[token].includes(docId)) {
          index.tokens[token].push(docId)
        }
      })

      // Index message content tokens
      const contentTokens = tokenize(msg.content)
      contentTokens.forEach((token) => {
        if (!index.tokens[token]) index.tokens[token] = []
        if (!index.tokens[token].includes(docId)) {
          index.tokens[token].push(docId)
        }
      })
    }
  }

  return index
}

/** Load or build search index */
async function loadIndex(): Promise<InvertedIndex> {
  if (memoryIndex) return memoryIndex

  const version = await Storage.get<number>(INDEX_VERSION_KEY)
  if (version !== CURRENT_VERSION) {
    // Version mismatch, rebuild index
    const index = await buildIndex()
    await Storage.set(INDEX_KEY, index)
    await Storage.set(INDEX_VERSION_KEY, CURRENT_VERSION)
    memoryIndex = index
    return index
  }

  const stored = await Storage.get<InvertedIndex>(INDEX_KEY)
  if (!stored) {
    const index = await buildIndex()
    await Storage.set(INDEX_KEY, index)
    memoryIndex = index
    return index
  }

  memoryIndex = stored
  return stored
}

/** Incrementally update index when a new message is added */
export async function updateIndexForMessage(convId: string, convTitle: string, msg: ChatMessage): Promise<void> {
  const index = await loadIndex()
  const docId = `${convId}:${msg.id}`

  // Add document
  index.docs[docId] = {
    convId,
    convTitle,
    msgId: msg.id,
    content: msg.content,
    role: msg.role,
    ts: msg.ts,
  }

  // Index title tokens
  const titleTokens = tokenize(convTitle)
  titleTokens.forEach((token) => {
    if (!index.tokens[token]) index.tokens[token] = []
    if (!index.tokens[token].includes(docId)) {
      index.tokens[token].push(docId)
    }
  })

  // Index content tokens
  const contentTokens = tokenize(msg.content)
  contentTokens.forEach((token) => {
    if (!index.tokens[token]) index.tokens[token] = []
    if (!index.tokens[token].includes(docId)) {
      index.tokens[token].push(docId)
    }
  })

  // Persist to storage
  await Storage.set(INDEX_KEY, index)
}

/** Remove conversation from index */
export async function removeFromIndex(convId: string): Promise<void> {
  const index = await loadIndex()

  // Find all document IDs for this conversation
  const docIds = Object.keys(index.docs).filter((docId) => docId.startsWith(`${convId}:`))

  // Remove documents
  docIds.forEach((docId) => {
    delete index.docs[docId]
  })

  // Remove from token lists
  Object.keys(index.tokens).forEach((token) => {
    index.tokens[token] = index.tokens[token].filter((docId) => !docId.startsWith(`${convId}:`))
    if (index.tokens[token].length === 0) {
      delete index.tokens[token]
    }
  })

  // Persist to storage
  await Storage.set(INDEX_KEY, index)
}

/** Rebuild entire index (useful after bulk operations) */
export async function rebuildIndex(): Promise<void> {
  const index = await buildIndex()
  await Storage.set(INDEX_KEY, index)
  await Storage.set(INDEX_VERSION_KEY, CURRENT_VERSION)
  memoryIndex = index
}

/** Calculate relevance score based on term frequency and recency */
function calculateScore(doc: IndexedDocument, queryTokens: string[], matchCount: number): number {
  const tfScore = matchCount / Math.max(1, tokenize(doc.content).length)
  const recencyScore = Math.min(1, doc.ts / Date.now()) // normalize to 0-1
  return tfScore * 0.7 + recencyScore * 0.3
}

/** Search across all conversations for messages containing the query */
export async function searchMessages(query: string, maxResults = 50): Promise<SearchResult[]> {
  if (!query.trim()) return []

  const startTime = Date.now()
  const index = await loadIndex()
  const queryTokens = tokenize(query)

  if (queryTokens.length === 0) return []

  // Find documents matching any query token
  const docScores = new Map<string, { doc: IndexedDocument; matchCount: number; firstMatchPos: number }>()

  queryTokens.forEach((token) => {
    const matchingDocs = index.tokens[token] ?? []
    matchingDocs.forEach((docId) => {
      const doc = index.docs[docId]
      if (!doc) return

      const existing = docScores.get(docId)
      if (existing) {
        existing.matchCount++
      } else {
        // Find first match position for snippet
        const lowerContent = doc.content.toLowerCase()
        const matchPos = lowerContent.indexOf(query.toLowerCase())
        docScores.set(docId, {
          doc,
          matchCount: 1,
          firstMatchPos: matchPos >= 0 ? matchPos : lowerContent.indexOf(token),
        })
      }
    })
  })

  // Convert to results and calculate scores
  const results: SearchResult[] = Array.from(docScores.entries()).map(([_docId, { doc, matchCount, firstMatchPos }]) => {
    const score = calculateScore(doc, queryTokens, matchCount)
    const message: ChatMessage = {
      id: doc.msgId,
      role: doc.role,
      content: doc.content,
      ts: doc.ts,
    }

    return {
      convId: doc.convId,
      convTitle: doc.convTitle,
      message,
      matchSnippet: buildSnippet(doc.content, firstMatchPos, query.length),
      matchIndex: firstMatchPos,
      relevanceScore: score,
    }
  })

  // Sort by relevance score (desc) then recency (desc)
  results.sort((a, b) => {
    if (Math.abs(a.relevanceScore - b.relevanceScore) > 0.01) {
      return b.relevanceScore - a.relevanceScore
    }
    return b.message.ts - a.message.ts
  })

  if (process.env.NODE_ENV === 'development') {
    const elapsed = Date.now() - startTime
    // eslint-disable-next-line no-console -- debug logging in development
    console.debug(`Search completed in ${elapsed}ms, found ${results.length} results`)
  }

  return results.slice(0, maxResults)
}

/** Build a snippet around the match position */
function buildSnippet(content: string, matchIdx: number, queryLen: number): string {
  const contextLen = 60
  const start = Math.max(0, matchIdx - contextLen)
  const end = Math.min(content.length, matchIdx + queryLen + contextLen)
  let snippet = content.slice(start, end)
  if (start > 0) snippet = '...' + snippet
  if (end < content.length) snippet = snippet + '...'
  return snippet
}

/** Highlight query text in a snippet using HTML marks */
export function highlightMatch(snippet: string, query: string): string {
  if (!query.trim()) return escapeHtml(snippet)
  // Mark matches with placeholders before escaping to prevent XSS
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi')
  const marked = snippet.replace(regex, '\x00$1\x01')
  const escaped = escapeHtml(marked)
  // eslint-disable-next-line no-control-regex -- intentional NUL/SOH markers for safe HTML injection
  return escaped.replace(/\x00/g, '<mark>').replace(/\x01/g, '</mark>')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
