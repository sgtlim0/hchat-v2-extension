import { describe, it, expect, beforeEach } from 'vitest'
import { DocTemplateStore, base64ToFile, TemplateStoreError } from '../docTemplateStore'

beforeEach(async () => {
  await chrome.storage.local.clear()
})

function createMockFile(name: string, size?: number): File {
  const content = 'x'.repeat(size ?? 100)
  return new File([content], name, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

// --- list ---

describe('DocTemplateStore.list', () => {
  it('빈 목록 반환', async () => {
    const list = await DocTemplateStore.list()
    expect(list).toEqual([])
  })

  it('저장된 템플릿 목록 반환', async () => {
    await DocTemplateStore.save('Template 1', createMockFile('t1.docx'), 3, 'report')
    await DocTemplateStore.save('Template 2', createMockFile('t2.docx'), 5, 'email')

    const list = await DocTemplateStore.list()
    expect(list).toHaveLength(2)
  })

  it('최신순 정렬', async () => {
    await DocTemplateStore.save('Old', createMockFile('old.docx'), 1, 'memo')
    // Ensure different createdAt timestamp
    await new Promise((r) => setTimeout(r, 5))
    await DocTemplateStore.save('New', createMockFile('new.docx'), 2, 'report')

    const list = await DocTemplateStore.list()
    expect(list[0].name).toBe('New')
    expect(list[1].name).toBe('Old')
  })
})

// --- save ---

describe('DocTemplateStore.save', () => {
  it('템플릿 저장 및 ID 할당', async () => {
    const template = await DocTemplateStore.save('My Template', createMockFile('test.docx'), 4, 'proposal')

    expect(template.id).toBeTruthy()
    expect(template.id).toMatch(/^tmpl_/)
    expect(template.name).toBe('My Template')
    expect(template.fieldCount).toBe(4)
    expect(template.category).toBe('proposal')
    expect(template.usageCount).toBe(0)
    expect(template.docxBase64).toBeTruthy()
  })

  it('Base64 변환 검증', async () => {
    const template = await DocTemplateStore.save('B64 Test', createMockFile('b64.docx'), 1, 'memo')

    expect(typeof template.docxBase64).toBe('string')
    expect(template.docxBase64.length).toBeGreaterThan(0)
  })

  it('최대 개수 초과 시 에러', async () => {
    // Save 10 templates
    for (let i = 0; i < 10; i++) {
      await DocTemplateStore.save(`T${i}`, createMockFile(`t${i}.docx`), 1, 'report')
    }

    await expect(
      DocTemplateStore.save('T10', createMockFile('t10.docx'), 1, 'report'),
    ).rejects.toThrow(TemplateStoreError)
    await expect(
      DocTemplateStore.save('T10', createMockFile('t10.docx'), 1, 'report'),
    ).rejects.toThrow('Maximum 10')
  })

  it('파일 크기 초과 시 에러', async () => {
    const bigFile = createMockFile('big.docx')
    Object.defineProperty(bigFile, 'size', { value: 6 * 1024 * 1024 })

    await expect(
      DocTemplateStore.save('Big', bigFile, 1, 'report'),
    ).rejects.toThrow(TemplateStoreError)
    await expect(
      DocTemplateStore.save('Big', bigFile, 1, 'report'),
    ).rejects.toThrow('5MB')
  })
})

// --- get ---

describe('DocTemplateStore.get', () => {
  it('존재하는 템플릿 반환', async () => {
    const saved = await DocTemplateStore.save('Find Me', createMockFile('find.docx'), 2, 'email')
    const found = await DocTemplateStore.get(saved.id)

    expect(found).not.toBeNull()
    expect(found!.name).toBe('Find Me')
    expect(found!.fieldCount).toBe(2)
  })

  it('없는 ID는 null', async () => {
    const result = await DocTemplateStore.get('nonexistent')
    expect(result).toBeNull()
  })
})

// --- delete ---

describe('DocTemplateStore.delete', () => {
  it('템플릿 삭제', async () => {
    const saved = await DocTemplateStore.save('Delete Me', createMockFile('del.docx'), 1, 'memo')
    const result = await DocTemplateStore.delete(saved.id)

    expect(result).toBe(true)
    const found = await DocTemplateStore.get(saved.id)
    expect(found).toBeNull()
  })

  it('없는 ID 삭제 시 false', async () => {
    const result = await DocTemplateStore.delete('nonexistent')
    expect(result).toBe(false)
  })

  it('다른 템플릿에 영향 없음', async () => {
    const t1 = await DocTemplateStore.save('Keep', createMockFile('k.docx'), 1, 'report')
    const t2 = await DocTemplateStore.save('Remove', createMockFile('r.docx'), 1, 'email')

    await DocTemplateStore.delete(t2.id)

    const list = await DocTemplateStore.list()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(t1.id)
  })

  it('삭제 후 새 템플릿 저장 가능', async () => {
    // Fill to max
    for (let i = 0; i < 10; i++) {
      await DocTemplateStore.save(`T${i}`, createMockFile(`t${i}.docx`), 1, 'report')
    }
    const list = await DocTemplateStore.list()
    await DocTemplateStore.delete(list[0].id)

    // Now should be able to add one more
    const newT = await DocTemplateStore.save('New', createMockFile('new.docx'), 1, 'report')
    expect(newT.name).toBe('New')
  })
})

// --- incrementUsage ---

describe('DocTemplateStore.incrementUsage', () => {
  it('사용 횟수 증가', async () => {
    const saved = await DocTemplateStore.save('Counter', createMockFile('c.docx'), 1, 'report')
    expect(saved.usageCount).toBe(0)

    await DocTemplateStore.incrementUsage(saved.id)
    await DocTemplateStore.incrementUsage(saved.id)
    await DocTemplateStore.incrementUsage(saved.id)

    const updated = await DocTemplateStore.get(saved.id)
    expect(updated!.usageCount).toBe(3)
  })

  it('다른 템플릿 카운터에 영향 없음', async () => {
    const t1 = await DocTemplateStore.save('T1', createMockFile('t1.docx'), 1, 'report')
    const t2 = await DocTemplateStore.save('T2', createMockFile('t2.docx'), 1, 'email')

    await DocTemplateStore.incrementUsage(t1.id)

    const fetched = await DocTemplateStore.get(t2.id)
    expect(fetched!.usageCount).toBe(0)
  })
})

// --- base64ToFile ---

describe('base64ToFile', () => {
  it('Base64를 File로 변환', () => {
    const base64 = btoa('test content')
    const file = base64ToFile(base64, 'test.docx')
    expect(file).toBeInstanceOf(File)
    expect(file.name).toBe('test.docx')
    expect(file.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  })

  it('파일 크기가 원본과 일치', () => {
    const content = 'hello world'
    const base64 = btoa(content)
    const file = base64ToFile(base64, 'test.docx')
    expect(file.size).toBe(content.length)
  })
})

// --- exportTemplates ---

describe('DocTemplateStore.exportTemplates', () => {
  it('모든 템플릿 내보내기', async () => {
    await DocTemplateStore.save('Template 1', createMockFile('t1.docx'), 3, 'report')
    await DocTemplateStore.save('Template 2', createMockFile('t2.docx'), 5, 'email')

    const json = await DocTemplateStore.exportTemplates()
    const parsed = JSON.parse(json)

    expect(parsed.version).toBe(1)
    expect(parsed.exportedAt).toBeTruthy()
    expect(parsed.templates).toHaveLength(2)
    expect(parsed.templates[0].name).toBeTruthy()
    expect(parsed.templates[0].docxBase64).toBeTruthy()
  })

  it('빈 갤러리 내보내기', async () => {
    const json = await DocTemplateStore.exportTemplates()
    const parsed = JSON.parse(json)

    expect(parsed.version).toBe(1)
    expect(parsed.templates).toEqual([])
  })

  it('유효한 JSON 형식', async () => {
    await DocTemplateStore.save('Test', createMockFile('test.docx'), 2, 'memo')

    const json = await DocTemplateStore.exportTemplates()
    expect(() => JSON.parse(json)).not.toThrow()
  })
})

// --- importTemplates ---

describe('DocTemplateStore.importTemplates', () => {
  it('유효한 JSON 가져오기', async () => {
    const t1 = await DocTemplateStore.save('Export1', createMockFile('e1.docx'), 2, 'report')
    const t2 = await DocTemplateStore.save('Export2', createMockFile('e2.docx'), 3, 'email')

    const json = await DocTemplateStore.exportTemplates()
    await chrome.storage.local.clear()

    const result = await DocTemplateStore.importTemplates(json)
    expect(result.imported).toBe(2)
    expect(result.skipped).toBe(0)

    const list = await DocTemplateStore.list()
    expect(list).toHaveLength(2)
  })

  it('중복 이름 건너뛰기', async () => {
    await DocTemplateStore.save('Duplicate', createMockFile('d1.docx'), 1, 'memo')
    const json = await DocTemplateStore.exportTemplates()

    const result = await DocTemplateStore.importTemplates(json)
    expect(result.imported).toBe(0)
    expect(result.skipped).toBe(1)

    const list = await DocTemplateStore.list()
    expect(list).toHaveLength(1)
  })

  it('최대 개수 초과 시 일부만 가져오기', async () => {
    // Fill to max
    for (let i = 0; i < 10; i++) {
      await DocTemplateStore.save(`Existing${i}`, createMockFile(`e${i}.docx`), 1, 'report')
    }

    // Export one more template from different storage
    await chrome.storage.local.clear()
    await DocTemplateStore.save('Extra', createMockFile('extra.docx'), 1, 'memo')
    const json = await DocTemplateStore.exportTemplates()

    // Restore original 10
    await chrome.storage.local.clear()
    for (let i = 0; i < 10; i++) {
      await DocTemplateStore.save(`Existing${i}`, createMockFile(`e${i}.docx`), 1, 'report')
    }

    const result = await DocTemplateStore.importTemplates(json)
    expect(result.imported).toBe(0)
    expect(result.skipped).toBe(1)
  })

  it('잘못된 JSON 형식 에러', async () => {
    await expect(
      DocTemplateStore.importTemplates('invalid json'),
    ).rejects.toThrow(TemplateStoreError)
    await expect(
      DocTemplateStore.importTemplates('invalid json'),
    ).rejects.toThrow('Invalid JSON format')
  })

  it('잘못된 구조 에러', async () => {
    const badJson = JSON.stringify({ foo: 'bar' })
    await expect(
      DocTemplateStore.importTemplates(badJson),
    ).rejects.toThrow(TemplateStoreError)
    await expect(
      DocTemplateStore.importTemplates(badJson),
    ).rejects.toThrow('Invalid template export format')
  })

  it('새 ID 생성', async () => {
    const t1 = await DocTemplateStore.save('Original', createMockFile('o.docx'), 1, 'report')
    const json = await DocTemplateStore.exportTemplates()
    await chrome.storage.local.clear()

    await DocTemplateStore.importTemplates(json)
    const list = await DocTemplateStore.list()

    expect(list[0].id).not.toBe(t1.id)
    expect(list[0].id).toMatch(/^tmpl_/)
  })

  it('사용 횟수 초기화', async () => {
    const t1 = await DocTemplateStore.save('Used', createMockFile('u.docx'), 1, 'report')
    await DocTemplateStore.incrementUsage(t1.id)
    await DocTemplateStore.incrementUsage(t1.id)

    const json = await DocTemplateStore.exportTemplates()
    await chrome.storage.local.clear()

    await DocTemplateStore.importTemplates(json)
    const list = await DocTemplateStore.list()

    expect(list[0].usageCount).toBe(0)
  })

  it('라운드트립 일관성', async () => {
    await DocTemplateStore.save('RT1', createMockFile('rt1.docx'), 2, 'report')
    await DocTemplateStore.save('RT2', createMockFile('rt2.docx'), 3, 'email')

    const json = await DocTemplateStore.exportTemplates()
    await chrome.storage.local.clear()
    await DocTemplateStore.importTemplates(json)

    const list = await DocTemplateStore.list()
    expect(list).toHaveLength(2)
    expect(list.some((t) => t.name === 'RT1')).toBe(true)
    expect(list.some((t) => t.name === 'RT2')).toBe(true)
    expect(list[0].fieldCount).toBeGreaterThan(0)
    expect(list[0].docxBase64).toBeTruthy()
  })
})
