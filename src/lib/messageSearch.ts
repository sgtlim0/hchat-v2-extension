/** Full-text search across all conversation messages */

import { ChatHistory, type ChatMessage } from './chatHistory'

export interface SearchResult {
  convId: string
  convTitle: string
  message: ChatMessage
  matchSnippet: string
  matchIndex: number
}

const BATCH_SIZE = 5

/** Search across all conversations for messages containing the query */
export async function searchMessages(query: string, maxResults = 50): Promise<SearchResult[]> {
  if (!query.trim()) return []

  const lowerQuery = query.toLowerCase()
  const index = await ChatHistory.listIndex()
  const results: SearchResult[] = []

  for (let i = 0; i < index.length; i += BATCH_SIZE) {
    if (results.length >= maxResults) break

    const batch = index.slice(i, i + BATCH_SIZE)
    const settled = await Promise.allSettled(batch.map((item) => ChatHistory.get(item.id)))
    const convs = settled
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof ChatHistory.get>>> => r.status === 'fulfilled')
      .map((r) => r.value)

    for (const conv of convs) {
      if (!conv) continue
      if (results.length >= maxResults) break

      for (const msg of conv.messages) {
        if (results.length >= maxResults) break

        const lowerContent = msg.content.toLowerCase()
        const matchIdx = lowerContent.indexOf(lowerQuery)
        if (matchIdx === -1) continue

        results.push({
          convId: conv.id,
          convTitle: conv.title,
          message: msg,
          matchSnippet: buildSnippet(msg.content, matchIdx, query.length),
          matchIndex: matchIdx,
        })
      }
    }
  }

  return results
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
