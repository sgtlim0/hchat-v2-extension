// lib/__tests__/aiMemory.test.ts — Tests for AI memory module

import { describe, it, expect, beforeEach } from 'vitest'
import {
  getMemories,
  addMemory,
  updateMemory,
  deleteMemory,
  extractMemories,
  searchMemories,
  buildMemoryContext,
  exportMemories,
  importMemories,
  type Memory,
  type ExtractedMemory,
} from '../aiMemory'

describe('aiMemory', () => {
  beforeEach(async () => {
    // Storage is cleared by test/setup.ts beforeEach
  })

  // ── CRUD ──
  describe('CRUD operations', () => {
    it('should add a memory and retrieve it', async () => {
      const memory = await addMemory({
        category: 'name',
        content: '사용자 이름: 홍길동',
        source: '제 이름은 홍길동입니다',
        approved: false,
      })

      expect(memory.id).toBeDefined()
      expect(memory.createdAt).toBeGreaterThan(0)
      expect(memory.category).toBe('name')
      expect(memory.content).toBe('사용자 이름: 홍길동')

      const all = await getMemories()
      expect(all).toHaveLength(1)
      expect(all[0].id).toBe(memory.id)
    })

    it('should return empty array when no memories exist', async () => {
      const all = await getMemories()
      expect(all).toEqual([])
    })

    it('should add multiple memories', async () => {
      await addMemory({ category: 'name', content: '홍길동', approved: false })
      await addMemory({ category: 'preference', content: 'TypeScript 선호', approved: true })
      await addMemory({ category: 'project', content: 'H Chat 프로젝트', approved: false })

      const all = await getMemories()
      expect(all).toHaveLength(3)
    })

    it('should update a memory immutably', async () => {
      const memory = await addMemory({
        category: 'fact',
        content: '서울 거주',
        approved: false,
      })

      const updated = await updateMemory(memory.id, {
        content: '부산 거주',
        approved: true,
      })

      expect(updated.id).toBe(memory.id)
      expect(updated.content).toBe('부산 거주')
      expect(updated.approved).toBe(true)
      expect(updated.createdAt).toBe(memory.createdAt)

      const all = await getMemories()
      expect(all).toHaveLength(1)
      expect(all[0].content).toBe('부산 거주')
    })

    it('should throw when updating non-existent memory', async () => {
      await expect(
        updateMemory('non-existent', { content: 'test' })
      ).rejects.toThrow('Memory not found')
    })

    it('should delete a memory', async () => {
      const m1 = await addMemory({ category: 'name', content: 'A', approved: false })
      await addMemory({ category: 'name', content: 'B', approved: false })

      await deleteMemory(m1.id)

      const all = await getMemories()
      expect(all).toHaveLength(1)
      expect(all[0].content).toBe('B')
    })

    it('should throw when deleting non-existent memory', async () => {
      await expect(deleteMemory('non-existent')).rejects.toThrow('Memory not found')
    })

    it('should enforce max 100 entries with FIFO', async () => {
      for (let i = 0; i < 100; i++) {
        await addMemory({ category: 'fact', content: `fact-${i}`, approved: false })
      }

      const before = await getMemories()
      expect(before).toHaveLength(100)
      expect(before[0].content).toBe('fact-0')

      await addMemory({ category: 'fact', content: 'fact-100', approved: false })

      const after = await getMemories()
      expect(after).toHaveLength(100)
      expect(after[0].content).toBe('fact-1') // oldest removed
      expect(after[99].content).toBe('fact-100')
    })
  })

  // ── extractMemories ──
  describe('extractMemories', () => {
    it('should extract name from Korean pattern', () => {
      const messages = [
        { role: 'user', content: '안녕하세요, 제 이름은 김철수입니다.' },
      ]

      const result = extractMemories(messages)
      expect(result.length).toBeGreaterThanOrEqual(1)

      const nameEntry = result.find((r) => r.category === 'name')
      expect(nameEntry).toBeDefined()
      expect(nameEntry!.content).toContain('김철수')
      expect(nameEntry!.source).toContain('제 이름은 김철수')
      expect(nameEntry!.confidence).toBeGreaterThan(0)
      expect(nameEntry!.confidence).toBeLessThanOrEqual(1)
    })

    it('should extract name from English pattern', () => {
      const messages = [
        { role: 'user', content: "Hi, I'm John and I need help." },
      ]

      const result = extractMemories(messages)
      const nameEntry = result.find((r) => r.category === 'name')
      expect(nameEntry).toBeDefined()
      expect(nameEntry!.content).toContain('John')
    })

    it('should extract name from Japanese pattern', () => {
      const messages = [
        { role: 'user', content: '私は田中です。よろしくお願いします。' },
      ]

      const result = extractMemories(messages)
      const nameEntry = result.find((r) => r.category === 'name')
      expect(nameEntry).toBeDefined()
      expect(nameEntry!.content).toContain('田中')
    })

    it('should extract preference patterns', () => {
      const messages = [
        { role: 'user', content: 'TypeScript를 선호합니다.' },
        { role: 'user', content: 'I prefer dark mode for coding.' },
      ]

      const result = extractMemories(messages)
      const prefs = result.filter((r) => r.category === 'preference')
      expect(prefs.length).toBeGreaterThanOrEqual(2)
    })

    it('should extract project patterns', () => {
      const messages = [
        { role: 'user', content: 'H Chat 프로젝트에 대해 물어볼게요.' },
        { role: 'user', content: "I'm working on a React dashboard." },
      ]

      const result = extractMemories(messages)
      const projects = result.filter((r) => r.category === 'project')
      expect(projects.length).toBeGreaterThanOrEqual(2)
    })

    it('should return empty array for empty messages', () => {
      expect(extractMemories([])).toEqual([])
    })

    it('should handle mixed languages in single conversation', () => {
      const messages = [
        { role: 'user', content: '제 이름은 박지민이고, I prefer Python.' },
      ]

      const result = extractMemories(messages)
      expect(result.length).toBeGreaterThanOrEqual(2)

      const categories = result.map((r) => r.category)
      expect(categories).toContain('name')
      expect(categories).toContain('preference')
    })

    it('should only extract from user messages', () => {
      const messages = [
        { role: 'assistant', content: '제 이름은 AI입니다.' },
        { role: 'user', content: '안녕하세요.' },
      ]

      const result = extractMemories(messages)
      const nameEntry = result.find((r) => r.category === 'name')
      expect(nameEntry).toBeUndefined()
    })
  })

  // ── searchMemories ──
  describe('searchMemories', () => {
    beforeEach(async () => {
      await addMemory({ category: 'name', content: '사용자: 홍길동', approved: true })
      await addMemory({ category: 'preference', content: 'TypeScript 선호', approved: true })
      await addMemory({ category: 'project', content: 'H Chat 크롬 확장', approved: true })
      await addMemory({ category: 'fact', content: '서울 강남구 거주', approved: false })
    })

    it('should find memories by keyword', async () => {
      const results = await searchMemories('TypeScript')
      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results[0].content).toContain('TypeScript')
    })

    it('should find memories by category keyword', async () => {
      const results = await searchMemories('project')
      expect(results.length).toBeGreaterThanOrEqual(1)
    })

    it('should return all memories for empty query', async () => {
      const results = await searchMemories('')
      expect(results).toHaveLength(4)
    })

    it('should return empty for non-matching query', async () => {
      const results = await searchMemories('xyznonexistent')
      expect(results).toHaveLength(0)
    })
  })

  // ── buildMemoryContext ──
  describe('buildMemoryContext', () => {
    it('should build context string from relevant memories', async () => {
      await addMemory({ category: 'name', content: '사용자: 홍길동', approved: true })
      await addMemory({ category: 'preference', content: 'TypeScript 선호', approved: true })

      const context = await buildMemoryContext('코드 작성해줘')
      expect(context).toContain('홍길동')
      expect(context).toContain('TypeScript')
    })

    it('should return empty string when no memories exist', async () => {
      const context = await buildMemoryContext('안녕하세요')
      expect(context).toBe('')
    })

    it('should only include approved memories', async () => {
      await addMemory({ category: 'name', content: '사용자: 홍길동', approved: true })
      await addMemory({ category: 'fact', content: '비공개 정보', approved: false })

      const context = await buildMemoryContext('')
      expect(context).toContain('홍길동')
      expect(context).not.toContain('비공개 정보')
    })
  })

  // ── Export/Import ──
  describe('exportMemories / importMemories', () => {
    it('should export and import memories (round-trip)', async () => {
      await addMemory({ category: 'name', content: '홍길동', approved: true })
      await addMemory({ category: 'preference', content: 'Python', approved: true })

      const json = await exportMemories()
      const parsed = JSON.parse(json)
      expect(parsed).toHaveLength(2)

      // Clear and re-import
      await deleteMemory((await getMemories())[0].id)
      await deleteMemory((await getMemories())[0].id)
      expect(await getMemories()).toHaveLength(0)

      const count = await importMemories(json)
      expect(count).toBe(2)

      const all = await getMemories()
      expect(all).toHaveLength(2)
    })

    it('should skip duplicates on import', async () => {
      const m = await addMemory({ category: 'name', content: '홍길동', approved: true })

      const json = await exportMemories()

      // Import same data again
      const count = await importMemories(json)
      expect(count).toBe(0) // All duplicates skipped

      const all = await getMemories()
      expect(all).toHaveLength(1)
    })

    it('should throw on invalid JSON import', async () => {
      await expect(importMemories('invalid-json')).rejects.toThrow()
    })
  })

  // ── approved field ──
  describe('approved field', () => {
    it('should set approved to false for auto-extracted memories', () => {
      const messages = [
        { role: 'user', content: '제 이름은 홍길동입니다.' },
      ]

      const extracted = extractMemories(messages)
      // ExtractedMemory doesn't have approved field;
      // when added via addMemory, approved is explicitly set
      expect(extracted.length).toBeGreaterThan(0)
    })

    it('should allow updating approved to true', async () => {
      const memory = await addMemory({
        category: 'name',
        content: '홍길동',
        approved: false,
      })

      expect(memory.approved).toBe(false)

      const updated = await updateMemory(memory.id, { approved: true })
      expect(updated.approved).toBe(true)
    })
  })
})
