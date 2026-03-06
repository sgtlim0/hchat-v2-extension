// lib/auditLog.ts — 감사 로그 시스템 (액션 기록, 조회, 내보내기, 통계, 정리)

import { Storage } from './storage'

const STORAGE_KEY = 'hchat:audit-log'
const MAX_ENTRIES = 1000
const DEFAULT_RETENTION_DAYS = 90

// ── Types ──

export type AuditCategory = 'chat' | 'assistant' | 'tool' | 'settings' | 'sharing' | 'plugin'
export type ActionType = 'create' | 'update' | 'delete' | 'execute' | 'export' | 'import'

export interface AuditEntry {
  id: string
  timestamp: number
  category: AuditCategory
  action: ActionType
  detail: string
  metadata?: Record<string, unknown>
}

export interface AuditAction {
  category: AuditCategory
  action: ActionType
  detail: string
  metadata?: Record<string, unknown>
}

export interface AuditFilters {
  category?: AuditCategory
  action?: ActionType
  startDate?: number
  endDate?: number
  keyword?: string
}

export interface AuditStats {
  totalActions: number
  byCategory: Record<string, number>
  byAction: Record<string, number>
  dailyActivity: { date: string; count: number }[]
}

// ── Internal helpers ──

async function loadLogs(): Promise<AuditEntry[]> {
  const logs = await Storage.get<AuditEntry[]>(STORAGE_KEY)
  return logs ?? []
}

async function saveLogs(logs: AuditEntry[]): Promise<void> {
  await Storage.set(STORAGE_KEY, logs)
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDateTime(timestamp: number): string {
  const d = new Date(timestamp)
  return d.toISOString()
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// ── logAction ──

export async function logAction(action: AuditAction): Promise<void> {
  const entry: AuditEntry = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    category: action.category,
    action: action.action,
    detail: action.detail,
    ...(action.metadata ? { metadata: action.metadata } : {}),
  }

  const logs = await loadLogs()
  const updated = [...logs, entry]

  // FIFO: 최대 MAX_ENTRIES 유지
  const trimmed = updated.length > MAX_ENTRIES
    ? updated.slice(updated.length - MAX_ENTRIES)
    : updated

  await saveLogs(trimmed)
}

// ── getAuditLog ──

export async function getAuditLog(filters?: AuditFilters): Promise<AuditEntry[]> {
  const logs = await loadLogs()

  const filtered = logs.filter((entry) => {
    if (filters?.category && entry.category !== filters.category) return false
    if (filters?.action && entry.action !== filters.action) return false
    if (filters?.startDate && entry.timestamp < filters.startDate) return false
    if (filters?.endDate && entry.timestamp > filters.endDate) return false
    if (filters?.keyword && !entry.detail.includes(filters.keyword)) return false
    return true
  })

  // 최신순 정렬
  return [...filtered].sort((a, b) => b.timestamp - a.timestamp)
}

// ── exportAuditLog ──

export async function exportAuditLog(format: 'json' | 'csv'): Promise<string> {
  const logs = await getAuditLog()

  if (format === 'json') {
    return JSON.stringify(logs, null, 2)
  }

  const header = '날짜,액션,카테고리,상세'
  const rows = logs.map((entry) =>
    [
      formatDateTime(entry.timestamp),
      escapeCsv(entry.action),
      escapeCsv(entry.category),
      escapeCsv(entry.detail),
    ].join(',')
  )

  return [header, ...rows].join('\n')
}

// ── getAuditStats ──

export async function getAuditStats(days?: number): Promise<AuditStats> {
  const cutoff = days
    ? Date.now() - days * 24 * 60 * 60 * 1000
    : 0

  const allLogs = await loadLogs()
  const logs = cutoff > 0
    ? allLogs.filter((e) => e.timestamp >= cutoff)
    : allLogs

  const byCategory: Record<string, number> = {}
  const byAction: Record<string, number> = {}
  const dailyMap: Record<string, number> = {}

  for (const entry of logs) {
    byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1
    byAction[entry.action] = (byAction[entry.action] ?? 0) + 1

    const dateKey = formatDate(entry.timestamp)
    dailyMap[dateKey] = (dailyMap[dateKey] ?? 0) + 1
  }

  const dailyActivity = Object.entries(dailyMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => b.date.localeCompare(a.date))

  return {
    totalActions: logs.length,
    byCategory,
    byAction,
    dailyActivity,
  }
}

// ── cleanOldLogs ──

export async function cleanOldLogs(daysToKeep?: number): Promise<number> {
  const retention = daysToKeep ?? DEFAULT_RETENTION_DAYS
  const cutoff = Date.now() - retention * 24 * 60 * 60 * 1000

  const logs = await loadLogs()
  const kept = logs.filter((entry) => entry.timestamp >= cutoff)
  const removed = logs.length - kept.length

  if (removed > 0) {
    await saveLogs(kept)
  }

  return removed
}
