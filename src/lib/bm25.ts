/** BM25 scoring module for search relevance ranking */

const K1 = 1.2 // term frequency saturation
const B = 0.75 // document length normalization
const RECENCY_WEIGHT = 0.3
const BM25_WEIGHT = 0.7
const RECENCY_DECAY_DAYS = 365
const MS_PER_DAY = 86_400_000

export interface BM25Document {
  id: string
  tokens: string[] // pre-tokenized terms
  length: number // number of tokens
}

export interface BM25Index {
  documents: BM25Document[]
  avgDocLength: number
  totalDocs: number
  /** Map from token to number of documents containing that token (df) */
  documentFrequency: Record<string, number>
}

/** Build BM25 index from documents */
export function buildBM25Index(docs: BM25Document[]): BM25Index {
  const totalDocs = docs.length

  const avgDocLength = totalDocs === 0 ? 0 : docs.reduce((sum, doc) => sum + doc.length, 0) / totalDocs

  const documentFrequency: Record<string, number> = {}
  for (const doc of docs) {
    const uniqueTokens = new Set(doc.tokens)
    for (const token of uniqueTokens) {
      documentFrequency[token] = (documentFrequency[token] ?? 0) + 1
    }
  }

  return {
    documents: docs,
    avgDocLength,
    totalDocs,
    documentFrequency,
  }
}

/** Calculate IDF (Inverse Document Frequency) for a term */
export function calculateIDF(df: number, totalDocs: number): number {
  return Math.log((totalDocs - df + 0.5) / (df + 0.5) + 1)
}

/** Calculate BM25 score for a single document against query tokens */
export function scoreBM25(doc: BM25Document, queryTokens: string[], index: BM25Index): number {
  if (queryTokens.length === 0 || index.totalDocs === 0) return 0

  let score = 0

  for (const queryToken of queryTokens) {
    const df = index.documentFrequency[queryToken] ?? 0
    const idf = calculateIDF(df, index.totalDocs)

    // Count term frequency in document
    let tf = 0
    for (const token of doc.tokens) {
      if (token === queryToken) tf++
    }

    if (tf === 0) continue

    const avgdl = Math.max(index.avgDocLength, 1)
    const numerator = tf * (K1 + 1)
    const denominator = tf + K1 * (1 - B + B * (doc.length / avgdl))

    score += idf * (numerator / denominator)
  }

  return score
}

/** Score all documents and return sorted results */
export function searchBM25(
  queryTokens: string[],
  index: BM25Index,
  limit?: number,
): Array<{ docId: string; score: number }> {
  if (queryTokens.length === 0) return []

  const results: Array<{ docId: string; score: number }> = []

  for (const doc of index.documents) {
    const score = scoreBM25(doc, queryTokens, index)
    if (score > 0) {
      results.push({ docId: doc.id, score })
    }
  }

  results.sort((a, b) => b.score - a.score)

  return limit !== undefined ? results.slice(0, limit) : results
}

/** Combine BM25 score with recency score */
export function combinedScore(bm25Score: number, recencyTs: number, now?: number): number {
  const currentTime = now ?? Date.now()
  const daysSince = (currentTime - recencyTs) / MS_PER_DAY
  const recencyScore = Math.max(0, 1 - daysSince / RECENCY_DECAY_DAYS)

  return bm25Score * BM25_WEIGHT + recencyScore * RECENCY_WEIGHT
}
