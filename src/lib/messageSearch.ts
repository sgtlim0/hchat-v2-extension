/** Full-text search across all conversation messages */

import { ChatHistory, type ChatMessage, type Conversation } from './chatHistory'

export interface SearchResult {
  convId: string
  convTitle: string
  message: ChatMessage
  matchSnippet: string
  matchIndex: number
}

/** Search across all conversations for messages containing the query */
export async function searchMessages(query: string, maxResults = 50): Promise<SearchResult[]> {
  if (!query.trim()) return []

  const lowerQuery = query.toLowerCase()
  const index = await ChatHistory.listIndex()
  const results: SearchResult[] = []

  for (const item of index) {
    if (results.length >= maxResults) break

    const conv = await ChatHistory.get(item.id)
    if (!conv) continue

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
  const escaped = escapeHtml(snippet)
  const escapedQuery = escapeHtml(query)
  const regex = new RegExp(`(${escapeRegex(escapedQuery)})`, 'gi')
  return escaped.replace(regex, '<mark>$1</mark>')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
