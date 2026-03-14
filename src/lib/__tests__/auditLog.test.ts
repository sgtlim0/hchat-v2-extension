// lib/__tests__/auditLog.test.ts — Tests for audit log system

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SK } from '../storageKeys'
import {
  logAction,
  getAuditLog,
  exportAuditLog,
  getAuditStats,
  cleanOldLogs,
  type AuditEntry,
  type AuditAction,
  type AuditCategory,
  type ActionType,
  type AuditFilters,
  type AuditStats,
} from '../auditLog'

describe('auditLog', () => {
  // ── logAction ──
  describe('logAction', () => {
    it('should store a log entry with auto-generated id and timestamp', async () => {
      const action: AuditAction = {
        category: 'chat',
        action: 'create',
        detail: '새 대화 생성',
      }

      await logAction(action)

      const logs = await getAuditLog()
      expect(logs).toHaveLength(1)
      expect(logs[0].id).toBeDefined()
      expect(logs[0].timestamp).toBeGreaterThan(0)
      expect(logs[0].category).toBe('chat')
      expect(logs[0].action).toBe('create')
      expect(logs[0].detail).toBe('새 대화 생성')
    })

    it('should store metadata when provided', async () => {
      await logAction({
        category: 'tool',
        action: 'execute',
        detail: '번역 도구 실행',
        metadata: { toolId: 'translate', inputLength: 500 },
      })

      const logs = await getAuditLog()
      expect(logs[0].metadata).toEqual({ toolId: 'translate', inputLength: 500 })
    })

    it('should enforce FIFO with max 1000 entries', async () => {
      // Insert 1000 entries
      for (let i = 0; i < 1000; i++) {
        await logAction({
          category: 'chat',
          action: 'create',
          detail: `entry-${i}`,
        })
      }

      // Insert one more
      await logAction({
        category: 'settings',
        action: 'update',
        detail: 'entry-overflow',
      })

      const logs = await getAuditLog()
      expect(logs.length).toBeLessThanOrEqual(1000)
      // Oldest entry should have been removed
      const details = logs.map((l) => l.detail)
      expect(details).not.toContain('entry-0')
      expect(details).toContain('entry-overflow')
    })
  })

  // ── getAuditLog ──
  describe('getAuditLog', () => {
    beforeEach(async () => {
      await logAction({ category: 'chat', action: 'create', detail: '대화 생성' })
      await logAction({ category: 'assistant', action: 'update', detail: '비서 수정' })
      await logAction({ category: 'tool', action: 'execute', detail: '도구 실행' })
      await logAction({ category: 'settings', action: 'update', detail: '설정 변경' })
    })

    it('should return all logs in newest-first order', async () => {
      const logs = await getAuditLog()

      expect(logs).toHaveLength(4)
      // Newest first (timestamps may be equal, so check reverse-insertion order)
      for (let i = 0; i < logs.length - 1; i++) {
        expect(logs[i].timestamp).toBeGreaterThanOrEqual(logs[i + 1].timestamp)
      }
    })

    it('should filter by category', async () => {
      const logs = await getAuditLog({ category: 'chat' })

      expect(logs).toHaveLength(1)
      expect(logs[0].category).toBe('chat')
    })

    it('should filter by action type', async () => {
      const logs = await getAuditLog({ action: 'update' })

      expect(logs).toHaveLength(2)
      logs.forEach((l) => expect(l.action).toBe('update'))
    })

    it('should filter by keyword', async () => {
      const logs = await getAuditLog({ keyword: '비서' })

      expect(logs).toHaveLength(1)
      expect(logs[0].detail).toContain('비서')
    })

    it('should filter by date range', async () => {
      const now = Date.now()
      const logs = await getAuditLog({
        startDate: now - 1000,
        endDate: now + 1000,
      })

      expect(logs).toHaveLength(4)
    })

    it('should combine multiple filters', async () => {
      const logs = await getAuditLog({
        category: 'assistant',
        action: 'update',
      })

      expect(logs).toHaveLength(1)
      expect(logs[0].detail).toBe('비서 수정')
    })
  })

  // ── exportAuditLog ──
  describe('exportAuditLog', () => {
    beforeEach(async () => {
      await logAction({ category: 'chat', action: 'create', detail: '대화 생성' })
      await logAction({ category: 'tool', action: 'execute', detail: '도구 실행' })
    })

    it('should export as JSON string', async () => {
      const json = await exportAuditLog('json')
      const parsed = JSON.parse(json)

      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed).toHaveLength(2)
      expect(parsed[0].category).toBeDefined()
    })

    it('should export as CSV with header', async () => {
      const csv = await exportAuditLog('csv')
      const lines = csv.trim().split('\n')

      expect(lines[0]).toBe('날짜,액션,카테고리,상세')
      expect(lines.length).toBe(3) // header + 2 entries
    })
  })

  // ── getAuditStats ──
  describe('getAuditStats', () => {
    beforeEach(async () => {
      await logAction({ category: 'chat', action: 'create', detail: 'a' })
      await logAction({ category: 'chat', action: 'create', detail: 'b' })
      await logAction({ category: 'tool', action: 'execute', detail: 'c' })
      await logAction({ category: 'settings', action: 'update', detail: 'd' })
    })

    it('should return total action count', async () => {
      const stats = await getAuditStats()

      expect(stats.totalActions).toBe(4)
    })

    it('should group by category', async () => {
      const stats = await getAuditStats()

      expect(stats.byCategory['chat']).toBe(2)
      expect(stats.byCategory['tool']).toBe(1)
      expect(stats.byCategory['settings']).toBe(1)
    })

    it('should group by action type', async () => {
      const stats = await getAuditStats()

      expect(stats.byAction['create']).toBe(2)
      expect(stats.byAction['execute']).toBe(1)
      expect(stats.byAction['update']).toBe(1)
    })

    it('should include daily activity', async () => {
      const stats = await getAuditStats()

      expect(stats.dailyActivity.length).toBeGreaterThanOrEqual(1)
      const todayEntry = stats.dailyActivity[0]
      expect(todayEntry.count).toBe(4)
    })
  })

  // ── cleanOldLogs ──
  describe('cleanOldLogs', () => {
    it('should remove logs older than specified days', async () => {
      const now = Date.now()
      const oldEntry: AuditEntry = {
        id: 'old-id',
        timestamp: now - 100 * 24 * 60 * 60 * 1000,
        category: 'chat',
        action: 'create',
        detail: 'old entry',
      }
      const recentEntry: AuditEntry = {
        id: 'recent-id',
        timestamp: now,
        category: 'chat',
        action: 'create',
        detail: 'recent entry',
      }

      // Directly set storage with aged entry
      await chrome.storage.local.set({
        [SK.AUDIT_LOG]: [oldEntry, recentEntry],
      })

      const removed = await cleanOldLogs(90)

      expect(removed).toBe(1)
      const remaining = await getAuditLog()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].detail).toBe('recent entry')
    })

    it('should default to 90 days', async () => {
      await logAction({ category: 'chat', action: 'create', detail: 'fresh' })

      const removed = await cleanOldLogs()

      expect(removed).toBe(0)
      const remaining = await getAuditLog()
      expect(remaining).toHaveLength(1)
    })

    it('should return 0 when no logs exist', async () => {
      const removed = await cleanOldLogs(30)

      expect(removed).toBe(0)
    })
  })
})
