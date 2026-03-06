/** Analytics engine for conversation metadata analysis */

// --- Interfaces ---

export interface ConversationMeta {
  id: string
  model: string
  provider: 'bedrock' | 'openai' | 'gemini'
  messageCount: number
  createdAt: number
  updatedAt: number
  assistantId?: string
  messages?: { role: string; content: string; ts: number }[]
}

export interface Topic {
  word: string
  score: number
}

export interface DailyActivity {
  date: string
  conversations: number
  messages: number
}

export interface ProviderComparison {
  provider: string
  count: number
  avgResponseLength: number
  peakHour: number
}

export interface AggregateResult {
  totalConversations: number
  totalMessages: number
  byModel: Record<string, number>
  byProvider: Record<string, number>
  avgMessagesPerConv: number
}

// --- Constants ---

const MS_PER_DAY = 86_400_000

const KOREAN_STOP_WORDS = new Set([
  '그리고', '하지만', '그래서', '그러나', '또는', '때문에', '그런데',
  '따라서', '만약', '비록', '그래도', '어떻게', '이것', '저것', '그것',
  '이런', '저런', '그런', '무엇', '어디', '언제', '누구', '왜',
  '에서', '으로', '에게', '부터', '까지', '처럼', '같이', '보다',
  '대해', '통해', '위해', '있는', '없는', '하는', '되는', '된다',
  '한다', '있다', '없다', '이다', '아니다',
])

const ENGLISH_STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or',
  'not', 'no', 'nor', 'so', 'if', 'then', 'than', 'too', 'very',
  'just', 'about', 'also', 'it', 'its', 'this', 'that', 'these',
  'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she',
  'him', 'her', 'his', 'they', 'them', 'their', 'what', 'which', 'who',
  'when', 'where', 'how', 'all', 'each', 'every', 'both', 'few',
  'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same',
])

// --- Conversation Aggregation ---

export function aggregateConversations(
  conversations: ConversationMeta[],
): AggregateResult {
  if (conversations.length === 0) {
    return {
      totalConversations: 0,
      totalMessages: 0,
      byModel: {},
      byProvider: {},
      avgMessagesPerConv: 0,
    }
  }

  const totalMessages = conversations.reduce(
    (sum, c) => sum + c.messageCount,
    0,
  )

  const byModel: Record<string, number> = {}
  const byProvider: Record<string, number> = {}

  for (const conv of conversations) {
    byModel[conv.model] = (byModel[conv.model] ?? 0) + 1
    byProvider[conv.provider] = (byProvider[conv.provider] ?? 0) + 1
  }

  return {
    totalConversations: conversations.length,
    totalMessages,
    byModel,
    byProvider,
    avgMessagesPerConv: totalMessages / conversations.length,
  }
}

// --- TF-IDF Topic Extraction ---

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2)
}

function isStopWord(word: string): boolean {
  return KOREAN_STOP_WORDS.has(word) || ENGLISH_STOP_WORDS.has(word)
}

function calculateTfIdf(
  termFreqs: Map<string, number>,
  docFreqs: Map<string, number>,
  totalDocs: number,
): Topic[] {
  const topics: Topic[] = []

  for (const [term, tf] of termFreqs) {
    const df = docFreqs.get(term) ?? 1
    const idf = Math.log(1 + totalDocs / df)
    topics.push({ word: term, score: tf * idf })
  }

  return topics.sort((a, b) => b.score - a.score)
}

export function extractTopics(
  messages: { content: string }[],
  topK: number = 10,
): Topic[] {
  if (messages.length === 0) return []

  const docTokens = messages.map((m) =>
    tokenize(m.content).filter((t) => !isStopWord(t)),
  )

  const termFreqs = new Map<string, number>()
  const docFreqs = new Map<string, number>()

  for (const tokens of docTokens) {
    const seen = new Set<string>()
    for (const token of tokens) {
      termFreqs.set(token, (termFreqs.get(token) ?? 0) + 1)
      if (!seen.has(token)) {
        docFreqs.set(token, (docFreqs.get(token) ?? 0) + 1)
        seen.add(token)
      }
    }
  }

  const topics = calculateTfIdf(termFreqs, docFreqs, docTokens.length)

  return topics.slice(0, topK)
}

// --- Time Series Analysis ---

function formatDate(ts: number): string {
  const d = new Date(ts)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getDailyActivity(
  conversations: ConversationMeta[],
  days: number = 30,
): DailyActivity[] {
  if (conversations.length === 0) return []

  const now = new Date()
  now.setHours(23, 59, 59, 999)
  const nowTs = now.getTime()

  const startTs = nowTs - (days - 1) * MS_PER_DAY
  const startDate = new Date(startTs)
  startDate.setHours(0, 0, 0, 0)

  // Initialize all days
  const dayMap = new Map<string, DailyActivity>()
  for (let i = 0; i < days; i++) {
    const dayTs = startDate.getTime() + i * MS_PER_DAY
    const dateStr = formatDate(dayTs)
    dayMap.set(dateStr, { date: dateStr, conversations: 0, messages: 0 })
  }

  // Fill in data
  for (const conv of conversations) {
    const dateStr = formatDate(conv.createdAt)
    const entry = dayMap.get(dateStr)
    if (entry) {
      dayMap.set(dateStr, {
        ...entry,
        conversations: entry.conversations + 1,
        messages: entry.messages + conv.messageCount,
      })
    }
  }

  return Array.from(dayMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  )
}

export function getHourlyHeatmap(conversations: ConversationMeta[]): number[] {
  const hours = Array.from({ length: 24 }, () => 0)

  for (const conv of conversations) {
    const hour = new Date(conv.createdAt).getHours()
    hours[hour] = hours[hour] + 1
  }

  return hours
}

// --- Provider Comparison ---

export function compareProviders(
  conversations: ConversationMeta[],
): ProviderComparison[] {
  if (conversations.length === 0) return []

  const providerData = new Map<
    string,
    {
      count: number
      responseLengths: number[]
      hourCounts: number[]
    }
  >()

  for (const conv of conversations) {
    const data = providerData.get(conv.provider) ?? {
      count: 0,
      responseLengths: [],
      hourCounts: Array.from({ length: 24 }, () => 0),
    }

    const updated = {
      count: data.count + 1,
      responseLengths: [...data.responseLengths],
      hourCounts: [...data.hourCounts],
    }

    // Collect assistant response lengths
    if (conv.messages) {
      for (const msg of conv.messages) {
        if (msg.role === 'assistant') {
          updated.responseLengths = [
            ...updated.responseLengths,
            msg.content.length,
          ]
        }
      }
    }

    // Track hour
    const hour = new Date(conv.createdAt).getHours()
    updated.hourCounts[hour] = updated.hourCounts[hour] + 1

    providerData.set(conv.provider, updated)
  }

  const results: ProviderComparison[] = []

  for (const [provider, data] of providerData) {
    const avgResponseLength =
      data.responseLengths.length > 0
        ? data.responseLengths.reduce((s, l) => s + l, 0) /
          data.responseLengths.length
        : 0

    let peakHour = 0
    let peakCount = 0
    for (let h = 0; h < 24; h++) {
      if (data.hourCounts[h] > peakCount) {
        peakCount = data.hourCounts[h]
        peakHour = h
      }
    }

    results.push({ provider, count: data.count, avgResponseLength, peakHour })
  }

  return results
}
