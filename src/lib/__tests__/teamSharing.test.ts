import { describe, it, expect, beforeEach } from 'vitest'
import {
  createSharePackage,
  exportPackage,
  importPackage,
  validatePackage,
  applyPackage,
  getShareHistory,
  addShareRecord,
  type ShareItem,
  type SharePackage,
  type ShareRecord,
} from '../teamSharing'

beforeEach(async () => {
  await chrome.storage.local.clear()
})

// --- createSharePackage ---

describe('createSharePackage', () => {
  it('빈 items로 패키지 생성', () => {
    const pkg = createSharePackage([], { author: 'user1', description: 'empty' })

    expect(pkg.formatVersion).toBe(1)
    expect(pkg.author).toBe('user1')
    expect(pkg.description).toBe('empty')
    expect(pkg.items).toEqual([])
    expect(pkg.createdAt).toBeGreaterThan(0)
  })

  it('여러 타입 혼합 items로 패키지 생성', () => {
    const items: ShareItem[] = [
      { type: 'assistant', data: { name: 'coder' } },
      { type: 'prompt', data: { text: 'hello' } },
      { type: 'template', data: { title: 'doc' } },
      { type: 'chain', data: { steps: [] } },
    ]

    const pkg = createSharePackage(items, { author: 'team', description: 'mixed' })

    expect(pkg.items).toHaveLength(4)
    expect(pkg.items[0].type).toBe('assistant')
    expect(pkg.items[3].type).toBe('chain')
  })
})

// --- exportPackage / importPackage ---

describe('exportPackage / importPackage', () => {
  it('JSON 왕복: export → import 동일 데이터', () => {
    const items: ShareItem[] = [
      { type: 'assistant', data: { name: 'test' } },
    ]
    const original = createSharePackage(items, { author: 'a', description: 'd' })
    const json = exportPackage(original)
    const restored = importPackage(json)

    expect(restored.formatVersion).toBe(original.formatVersion)
    expect(restored.author).toBe(original.author)
    expect(restored.items).toEqual(original.items)
  })

  it('잘못된 JSON 입력 시 에러', () => {
    expect(() => importPackage('not json {')).toThrow()
  })

  it('formatVersion 누락 시 에러', () => {
    const invalid = JSON.stringify({ author: 'a', items: [] })
    expect(() => importPackage(invalid)).toThrow()
  })

  it('잘못된 formatVersion 시 에러', () => {
    const invalid = JSON.stringify({
      formatVersion: 99,
      author: 'a',
      description: 'd',
      createdAt: Date.now(),
      items: [],
    })
    expect(() => importPackage(invalid)).toThrow()
  })
})

// --- validatePackage ---

describe('validatePackage', () => {
  function makeValidPackage(overrides?: Partial<SharePackage>): SharePackage {
    return {
      formatVersion: 1,
      author: 'user',
      description: 'desc',
      createdAt: Date.now(),
      items: [{ type: 'assistant', data: {} }],
      ...overrides,
    }
  }

  it('유효한 패키지', () => {
    const result = validatePackage(makeValidPackage())
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('author 누락', () => {
    const result = validatePackage(makeValidPackage({ author: '' }))
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('잘못된 formatVersion', () => {
    const result = validatePackage(makeValidPackage({ formatVersion: 2 }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('formatVersion'))
  })

  it('잘못된 item type', () => {
    const result = validatePackage(
      makeValidPackage({ items: [{ type: 'unknown' as 'assistant', data: {} }] }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('type'))
  })

  it('크기 초과 (5MB)', () => {
    const bigData = 'x'.repeat(5 * 1024 * 1024 + 1)
    const result = validatePackage(
      makeValidPackage({ items: [{ type: 'prompt', data: bigData }] }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('5MB'))
  })
})

// --- applyPackage ---

describe('applyPackage', () => {
  it('중복 없음 — 전부 추가', async () => {
    const pkg = createSharePackage(
      [
        { type: 'assistant', data: { id: 'a1', name: 'coder' } },
        { type: 'prompt', data: { id: 'p1', text: 'hello' } },
      ],
      { author: 'user', description: 'test' },
    )

    const result = await applyPackage(pkg)

    expect(result.added).toBe(2)
    expect(result.skipped).toBe(0)
    expect(result.updated).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it('중복 시 기본 스킵', async () => {
    // 먼저 하나 추가
    const pkg1 = createSharePackage(
      [{ type: 'assistant', data: { id: 'a1', name: 'coder' } }],
      { author: 'user', description: 'first' },
    )
    await applyPackage(pkg1)

    // 같은 id로 다시 추가
    const pkg2 = createSharePackage(
      [{ type: 'assistant', data: { id: 'a1', name: 'coder-v2' } }],
      { author: 'user', description: 'second' },
    )
    const result = await applyPackage(pkg2)

    expect(result.skipped).toBe(1)
    expect(result.added).toBe(0)
  })

  it('덮어쓰기 옵션', async () => {
    const pkg1 = createSharePackage(
      [{ type: 'assistant', data: { id: 'a1', name: 'old' } }],
      { author: 'user', description: 'first' },
    )
    await applyPackage(pkg1)

    const pkg2 = createSharePackage(
      [{ type: 'assistant', data: { id: 'a1', name: 'new' } }],
      { author: 'user', description: 'second' },
    )
    const result = await applyPackage(pkg2, { overwrite: true })

    expect(result.updated).toBe(1)
    expect(result.added).toBe(0)
    expect(result.skipped).toBe(0)
  })
})

// --- getShareHistory / addShareRecord ---

describe('shareHistory', () => {
  it('초기 히스토리 비어 있음', async () => {
    const history = await getShareHistory()
    expect(history).toEqual([])
  })

  it('레코드 추가 및 조회', async () => {
    const record: ShareRecord = {
      id: 'rec-1',
      type: 'export',
      packageName: 'My Package',
      itemCount: 3,
      timestamp: Date.now(),
    }

    await addShareRecord(record)
    const history = await getShareHistory()

    expect(history).toHaveLength(1)
    expect(history[0].packageName).toBe('My Package')
  })

  it('max 50 FIFO', async () => {
    for (let i = 0; i < 55; i++) {
      await addShareRecord({
        id: `rec-${i}`,
        type: 'import',
        packageName: `pkg-${i}`,
        itemCount: 1,
        timestamp: i,
      })
    }

    const history = await getShareHistory()

    expect(history).toHaveLength(50)
    // 가장 오래된 5개 제거됨 — 첫 항목은 rec-5
    expect(history[0].id).toBe('rec-5')
  })
})

// --- 에지 케이스 ---

describe('edge cases', () => {
  it('빈 패키지 applyPackage', async () => {
    const pkg = createSharePackage([], { author: 'user', description: 'empty' })
    const result = await applyPackage(pkg)

    expect(result.added).toBe(0)
    expect(result.skipped).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it('알 수 없는 타입이 포함된 패키지 validatePackage', () => {
    const pkg: SharePackage = {
      formatVersion: 1,
      author: 'user',
      description: 'desc',
      createdAt: Date.now(),
      items: [{ type: 'unknown-thing' as 'assistant', data: {} }],
    }

    const result = validatePackage(pkg)
    expect(result.valid).toBe(false)
  })

  it('workflow 타입 항목 정상 처리', () => {
    const pkg = createSharePackage(
      [{ type: 'workflow', data: { name: 'flow1' } }],
      { author: 'user', description: 'workflows' },
    )

    const result = validatePackage(pkg)
    expect(result.valid).toBe(true)
  })
})
