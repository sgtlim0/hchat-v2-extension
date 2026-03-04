import { describe, it, expect } from 'vitest'
import {
  buildBM25Index,
  calculateIDF,
  scoreBM25,
  searchBM25,
  combinedScore,
  type BM25Document,
} from '../bm25'

function makeDoc(id: string, tokens: string[]): BM25Document {
  return { id, tokens, length: tokens.length }
}

describe('buildBM25Index', () => {
  it('returns empty index for empty documents array', () => {
    const index = buildBM25Index([])

    expect(index.documents).toHaveLength(0)
    expect(index.totalDocs).toBe(0)
    expect(index.avgDocLength).toBe(0)
    expect(index.documentFrequency).toEqual({})
  })

  it('builds index for a single document', () => {
    const doc = makeDoc('d1', ['hello', 'world'])
    const index = buildBM25Index([doc])

    expect(index.totalDocs).toBe(1)
    expect(index.avgDocLength).toBe(2)
    expect(index.documentFrequency['hello']).toBe(1)
    expect(index.documentFrequency['world']).toBe(1)
  })

  it('builds index for multiple documents', () => {
    const docs = [
      makeDoc('d1', ['hello', 'world']),
      makeDoc('d2', ['hello', 'foo', 'bar']),
      makeDoc('d3', ['baz']),
    ]
    const index = buildBM25Index(docs)

    expect(index.totalDocs).toBe(3)
    expect(index.documents).toHaveLength(3)
  })

  it('calculates correct avgDocLength', () => {
    const docs = [
      makeDoc('d1', ['a', 'b']),
      makeDoc('d2', ['c', 'd', 'e', 'f']),
    ]
    const index = buildBM25Index(docs)

    expect(index.avgDocLength).toBe(3) // (2 + 4) / 2
  })

  it('calculates correct documentFrequency', () => {
    const docs = [
      makeDoc('d1', ['hello', 'world']),
      makeDoc('d2', ['hello', 'foo']),
      makeDoc('d3', ['bar']),
    ]
    const index = buildBM25Index(docs)

    expect(index.documentFrequency['hello']).toBe(2)
    expect(index.documentFrequency['world']).toBe(1)
    expect(index.documentFrequency['foo']).toBe(1)
    expect(index.documentFrequency['bar']).toBe(1)
  })
})

describe('calculateIDF', () => {
  it('returns low IDF for common term (high df)', () => {
    const idf = calculateIDF(9, 10) // term in 9 of 10 docs
    expect(idf).toBeGreaterThan(0)
    expect(idf).toBeLessThan(1)
  })

  it('returns high IDF for rare term (low df)', () => {
    const idf = calculateIDF(1, 100) // term in 1 of 100 docs
    expect(idf).toBeGreaterThan(3)
  })

  it('returns near-zero IDF for term in all docs', () => {
    const idf = calculateIDF(10, 10)
    // ln((10 - 10 + 0.5) / (10 + 0.5) + 1) = ln(0.5/10.5 + 1) ≈ ln(1.0476) ≈ 0.0465
    expect(idf).toBeGreaterThan(0)
    expect(idf).toBeLessThan(0.1)
  })

  it('returns high IDF for term in no docs', () => {
    const idf = calculateIDF(0, 10)
    // ln((10 + 0.5) / (0.5) + 1) = ln(22) ≈ 3.09
    expect(idf).toBeGreaterThan(3)
  })
})

describe('scoreBM25', () => {
  it('scores single matching term', () => {
    const doc = makeDoc('d1', ['hello', 'world'])
    const index = buildBM25Index([doc, makeDoc('d2', ['foo', 'bar'])])

    const score = scoreBM25(doc, ['hello'], index)
    expect(score).toBeGreaterThan(0)
  })

  it('scores higher with multiple matching terms', () => {
    const doc = makeDoc('d1', ['hello', 'world', 'foo'])
    const index = buildBM25Index([doc, makeDoc('d2', ['bar', 'baz'])])

    const singleMatch = scoreBM25(doc, ['hello'], index)
    const doubleMatch = scoreBM25(doc, ['hello', 'world'], index)

    expect(doubleMatch).toBeGreaterThan(singleMatch)
  })

  it('returns 0 for no matching terms', () => {
    const doc = makeDoc('d1', ['hello', 'world'])
    const index = buildBM25Index([doc])

    const score = scoreBM25(doc, ['missing'], index)
    expect(score).toBe(0)
  })

  it('scores short document higher per-match than long document', () => {
    const shortDoc = makeDoc('short', ['hello', 'world'])
    const longDoc = makeDoc('long', ['hello', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'])
    const index = buildBM25Index([shortDoc, longDoc])

    const shortScore = scoreBM25(shortDoc, ['hello'], index)
    const longScore = scoreBM25(longDoc, ['hello'], index)

    expect(shortScore).toBeGreaterThan(longScore)
  })

  it('shows diminishing returns for repeated terms (k1 saturation)', () => {
    const doc1 = makeDoc('d1', ['cat'])
    const doc2 = makeDoc('d2', ['cat', 'cat', 'cat', 'cat', 'cat'])
    const index = buildBM25Index([doc1, doc2])

    const score1 = scoreBM25(doc1, ['cat'], index)
    const score5 = scoreBM25(doc2, ['cat'], index)

    // Score should increase but not proportionally (5x tf should not give 5x score)
    expect(score5).toBeGreaterThan(score1)
    expect(score5).toBeLessThan(score1 * 5)
  })

  it('returns 0 contribution for query term not in document', () => {
    const doc = makeDoc('d1', ['hello', 'world'])
    const index = buildBM25Index([doc, makeDoc('d2', ['foo'])])

    const withMatch = scoreBM25(doc, ['hello'], index)
    const withExtra = scoreBM25(doc, ['hello', 'missing'], index)

    expect(withExtra).toBe(withMatch)
  })
})

describe('searchBM25', () => {
  it('returns results sorted by score (highest first)', () => {
    const docs = [
      makeDoc('low', ['hello', 'a', 'b', 'c', 'd', 'e', 'f', 'g']),
      makeDoc('high', ['hello', 'hello', 'hello']),
      makeDoc('mid', ['hello', 'world']),
    ]
    const index = buildBM25Index(docs)
    const results = searchBM25(['hello'], index)

    expect(results.length).toBeGreaterThan(0)
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
    }
  })

  it('respects limit parameter', () => {
    const docs = [
      makeDoc('d1', ['hello']),
      makeDoc('d2', ['hello']),
      makeDoc('d3', ['hello']),
    ]
    const index = buildBM25Index(docs)
    const results = searchBM25(['hello'], index, 2)

    expect(results).toHaveLength(2)
  })

  it('returns empty array for empty query', () => {
    const index = buildBM25Index([makeDoc('d1', ['hello'])])
    const results = searchBM25([], index)

    expect(results).toEqual([])
  })

  it('returns single matching document', () => {
    const docs = [
      makeDoc('d1', ['hello']),
      makeDoc('d2', ['world']),
    ]
    const index = buildBM25Index(docs)
    const results = searchBM25(['hello'], index)

    expect(results).toHaveLength(1)
    expect(results[0].docId).toBe('d1')
  })

  it('ranks more relevant document higher', () => {
    const docs = [
      makeDoc('partial', ['hello', 'a', 'b', 'c']),
      makeDoc('full', ['hello', 'world']),
      makeDoc('none', ['foo', 'bar']),
    ]
    const index = buildBM25Index(docs)
    const results = searchBM25(['hello', 'world'], index)

    expect(results[0].docId).toBe('full')
    expect(results.find((r) => r.docId === 'none')).toBeUndefined()
  })
})

describe('combinedScore', () => {
  it('gives high recency boost for recent message', () => {
    const now = Date.now()
    const recentTs = now - 1000 // 1 second ago

    const score = combinedScore(1.0, recentTs, now)
    // BM25: 1.0 * 0.7 = 0.7, recency ≈ 0.3
    expect(score).toBeGreaterThan(0.95)
  })

  it('gives 0 recency for message older than 365 days', () => {
    const now = Date.now()
    const oldTs = now - 400 * 86_400_000 // 400 days ago

    const score = combinedScore(1.0, oldTs, now)
    // BM25: 1.0 * 0.7 = 0.7, recency: 0
    expect(score).toBeCloseTo(0.7, 1)
  })

  it('BM25 dominates at 70% weight', () => {
    const now = Date.now()
    const recentTs = now - 1000

    const highBm25 = combinedScore(2.0, recentTs, now)
    const lowBm25 = combinedScore(0.5, recentTs, now)

    expect(highBm25).toBeGreaterThan(lowBm25)
    expect(highBm25 - lowBm25).toBeGreaterThan(1.0) // 1.5 * 0.7 = 1.05
  })
})

describe('edge cases', () => {
  it('handles very large document count (1000+)', () => {
    const docs: BM25Document[] = []
    for (let i = 0; i < 1200; i++) {
      docs.push(makeDoc(`d${i}`, i % 10 === 0 ? ['rare', 'token'] : ['common', 'words']))
    }
    const index = buildBM25Index(docs)
    const results = searchBM25(['rare'], index)

    expect(results).toHaveLength(120) // every 10th doc
    expect(results[0].score).toBeGreaterThan(0)
  })

  it('gives equal scores to documents with same tokens', () => {
    const doc1 = makeDoc('d1', ['hello', 'world'])
    const doc2 = makeDoc('d2', ['hello', 'world'])
    const index = buildBM25Index([doc1, doc2])

    const score1 = scoreBM25(doc1, ['hello'], index)
    const score2 = scoreBM25(doc2, ['hello'], index)

    expect(score1).toBe(score2)
  })
})
