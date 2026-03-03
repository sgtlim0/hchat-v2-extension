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
