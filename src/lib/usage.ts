// lib/usage.ts — Token usage tracking and cost estimation

import { Storage } from './storage'
import type { Provider } from './models'

export interface UsageRecord {
  date: string        // YYYY-MM-DD
  provider: Provider
  model: string
  inputTokens: number
  outputTokens: number
  requests: number
  estimatedCost: number  // USD
}

export interface UsageSummary {
  totalRequests: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCost: number
  byProvider: Record<string, { requests: number; tokens: number; cost: number }>
  byDate: { date: string; requests: number; cost: number }[]
}

const USAGE_KEY = 'hchat:usage'

// Approximate pricing per 1M tokens (input/output) in USD
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6':       { input: 3.0, output: 15.0 },
  'claude-opus-4-6':         { input: 15.0, output: 75.0 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
  'gpt-4o':                  { input: 2.5, output: 10.0 },
  'gpt-4o-mini':             { input: 0.15, output: 0.6 },
  'gemini-2.0-flash':        { input: 0.1, output: 0.4 },
  'gemini-1.5-pro':          { input: 1.25, output: 5.0 },
}

// Simple token estimation (4 chars ≈ 1 token for English, 2 chars for Korean)
export function estimateTokens(text: string): number {
  const koreanChars = (text.match(/[\u3131-\uD79D]/g) ?? []).length
  const otherChars = text.length - koreanChars
  return Math.ceil(koreanChars / 2 + otherChars / 4)
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICING[model]
  if (!price) return 0
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export const Usage = {
  async getRecords(): Promise<UsageRecord[]> {
    return (await Storage.get<UsageRecord[]>(USAGE_KEY)) ?? []
  },

  async track(model: string, provider: Provider, inputText: string, outputText: string): Promise<void> {
    const records = await this.getRecords()
    const date = today()
    const inputTokens = estimateTokens(inputText)
    const outputTokens = estimateTokens(outputText)
    const cost = estimateCost(model, inputTokens, outputTokens)

    const existing = records.find((r) => r.date === date && r.model === model)
    if (existing) {
      existing.inputTokens += inputTokens
      existing.outputTokens += outputTokens
      existing.requests += 1
      existing.estimatedCost += cost
    } else {
      records.push({ date, provider, model, inputTokens, outputTokens, requests: 1, estimatedCost: cost })
    }

    // Keep last 90 days only
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const filtered = records.filter((r) => r.date >= cutoffStr)

    await Storage.set(USAGE_KEY, filtered)
  },

  async getSummary(days = 30): Promise<UsageSummary> {
    const records = await this.getRecords()
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const filtered = records.filter((r) => r.date >= cutoffStr)

    const byProvider: Record<string, { requests: number; tokens: number; cost: number }> = {}
    const byDateMap: Record<string, { requests: number; cost: number }> = {}

    let totalRequests = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let totalCost = 0

    for (const r of filtered) {
      totalRequests += r.requests
      totalInputTokens += r.inputTokens
      totalOutputTokens += r.outputTokens
      totalCost += r.estimatedCost

      if (!byProvider[r.provider]) byProvider[r.provider] = { requests: 0, tokens: 0, cost: 0 }
      byProvider[r.provider].requests += r.requests
      byProvider[r.provider].tokens += r.inputTokens + r.outputTokens
      byProvider[r.provider].cost += r.estimatedCost

      if (!byDateMap[r.date]) byDateMap[r.date] = { requests: 0, cost: 0 }
      byDateMap[r.date].requests += r.requests
      byDateMap[r.date].cost += r.estimatedCost
    }

    const byDate = Object.entries(byDateMap)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return { totalRequests, totalInputTokens, totalOutputTokens, totalCost, byProvider, byDate }
  },

  async clearAll(): Promise<void> {
    await Storage.set(USAGE_KEY, [])
  },
}

export function formatCost(usd: number): string {
  if (usd < 0.01) return '< $0.01'
  return `$${usd.toFixed(2)}`
}

export function formatTokens(count: number): string {
  if (count < 1000) return String(count)
  if (count < 1_000_000) return `${(count / 1000).toFixed(1)}K`
  return `${(count / 1_000_000).toFixed(2)}M`
}
