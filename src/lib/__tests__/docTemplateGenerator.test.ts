import { describe, it, expect, vi } from 'vitest'
import {
  generateFieldSuggestions,
  generateFullTemplateDoc,
} from '../docTemplateGenerator'
import type { ParsedTemplate, TemplateField } from '../docTemplateParser'

// --- generateFieldSuggestions ---

describe('generateFieldSuggestions', () => {
  it('필드 제안 생성', async () => {
    const fields: TemplateField[] = [
      { id: 'name', name: '담당자', label: '담당자', context: '', sectionIndex: 0 },
      { id: 'date', name: '날짜', label: '날짜', context: '', sectionIndex: 0 },
    ]

    const mockFn = vi.fn().mockResolvedValue('{"담당자": "홍길동", "날짜": "2025-01-01"}')
    const result = await generateFieldSuggestions(fields, '', mockFn)

    expect(result).toEqual({ '담당자': '홍길동', '날짜': '2025-01-01' })
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('빈 필드 배열은 빈 객체', async () => {
    const mockFn = vi.fn()
    const result = await generateFieldSuggestions([], '', mockFn)
    expect(result).toEqual({})
    expect(mockFn).not.toHaveBeenCalled()
  })

  it('잘못된 JSON 응답은 빈 객체', async () => {
    const fields: TemplateField[] = [
      { id: 'a', name: 'a', label: 'a', context: '', sectionIndex: 0 },
    ]
    const mockFn = vi.fn().mockResolvedValue('not json at all')
    const result = await generateFieldSuggestions(fields, '', mockFn)
    expect(result).toEqual({})
  })

  it('JSON이 텍스트에 포함된 경우 추출', async () => {
    const fields: TemplateField[] = [
      { id: 'name', name: 'name', label: 'Name', context: '', sectionIndex: 0 },
    ]
    const mockFn = vi.fn().mockResolvedValue('Here is the result:\n{"name": "John"}\nEnd.')
    const result = await generateFieldSuggestions(fields, '', mockFn)
    expect(result).toEqual({ name: 'John' })
  })

  it('context가 프롬프트에 포함', async () => {
    const fields: TemplateField[] = [
      { id: 'x', name: 'x', label: 'X', context: '', sectionIndex: 0 },
    ]
    const mockFn = vi.fn().mockResolvedValue('{"x": "val"}')
    await generateFieldSuggestions(fields, 'Important context', mockFn)
    expect(mockFn.mock.calls[0][0]).toContain('Important context')
  })

  it('숫자 값을 문자열로 변환', async () => {
    const fields: TemplateField[] = [
      { id: 'count', name: 'count', label: 'Count', context: '', sectionIndex: 0 },
    ]
    const mockFn = vi.fn().mockResolvedValue('{"count": 42}')
    const result = await generateFieldSuggestions(fields, '', mockFn)
    expect(result).toEqual({ count: '42' })
  })
})

// --- generateFullTemplateDoc ---

describe('generateFullTemplateDoc', () => {
  const baseTemplate: ParsedTemplate = {
    title: '{{project}} 보고서',
    sections: [
      { index: 0, heading: '개요', content: '{{project}}에 대한 개요입니다.', level: 1 },
      { index: 1, heading: '상세 내용', content: '{{detail}}', level: 1 },
    ],
    fields: [
      { id: 'project', name: 'project', label: '프로젝트', context: '', sectionIndex: 0 },
      { id: 'detail', name: 'detail', label: '상세', context: '', sectionIndex: 1 },
    ],
    rawMarkdown: '# {{project}} 보고서\n\n## 개요\n\n{{project}}에 대한 개요입니다.\n\n## 상세 내용\n\n{{detail}}\n',
  }

  it('전체 문서 생성', async () => {
    const mockFn = vi.fn().mockResolvedValue('AI가 확장한 내용입니다.')
    const onProgress = vi.fn()

    const result = await generateFullTemplateDoc(
      baseTemplate,
      { project: 'Alpha', detail: '핵심 내용' },
      mockFn,
      onProgress,
    )

    expect(result.title).toBe('Alpha 보고서')
    expect(result.markdown).toContain('# Alpha 보고서')
    expect(result.sections).toHaveLength(2)
    expect(result.createdAt).toBeGreaterThan(0)
  })

  it('진행률 콜백 호출', async () => {
    const mockFn = vi.fn().mockResolvedValue('content')
    const onProgress = vi.fn()

    await generateFullTemplateDoc(
      baseTemplate,
      { project: 'Test', detail: 'Detail' },
      mockFn,
      onProgress,
    )

    expect(onProgress).toHaveBeenCalledTimes(2)
    expect(onProgress).toHaveBeenCalledWith(1, 2)
    expect(onProgress).toHaveBeenCalledWith(2, 2)
  })

  it('AI 생성 함수 호출 횟수 = 섹션 수', async () => {
    const mockFn = vi.fn().mockResolvedValue('expanded')

    await generateFullTemplateDoc(
      baseTemplate,
      { project: 'X', detail: 'Y' },
      mockFn,
    )

    expect(mockFn).toHaveBeenCalledTimes(2)
  })

  it('빈 섹션 처리', async () => {
    const emptyTemplate: ParsedTemplate = {
      title: 'Empty',
      sections: [],
      fields: [],
      rawMarkdown: '# Empty\n',
    }

    const mockFn = vi.fn()
    const result = await generateFullTemplateDoc(emptyTemplate, {}, mockFn)

    expect(result.title).toBe('Empty')
    expect(result.sections).toHaveLength(0)
    expect(mockFn).not.toHaveBeenCalled()
  })

  it('에러 전파', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('API 오류'))

    await expect(
      generateFullTemplateDoc(
        baseTemplate,
        { project: 'Test', detail: 'Detail' },
        mockFn,
      ),
    ).rejects.toThrow('API 오류')
  })

  it('플레이스홀더가 프롬프트에 값으로 교체되어 전달', async () => {
    const mockFn = vi.fn().mockResolvedValue('content')

    await generateFullTemplateDoc(
      baseTemplate,
      { project: 'Alpha', detail: '핵심' },
      mockFn,
    )

    // First section's prompt should contain 'Alpha' (filled placeholder)
    const firstPrompt = mockFn.mock.calls[0][0]
    expect(firstPrompt).toContain('Alpha')
  })

  it('onProgress 없이도 동작', async () => {
    const mockFn = vi.fn().mockResolvedValue('content')

    // Should not throw without onProgress
    const result = await generateFullTemplateDoc(
      baseTemplate,
      { project: 'NoProgress', detail: 'Detail' },
      mockFn,
    )

    expect(result.title).toBe('NoProgress 보고서')
  })

  it('이전 섹션이 다음 생성에 컨텍스트로 전달', async () => {
    let callCount = 0
    const mockFn = vi.fn().mockImplementation(async () => {
      callCount++
      return `섹션 ${callCount} 내용`
    })

    await generateFullTemplateDoc(
      baseTemplate,
      { project: 'Test', detail: 'Detail' },
      mockFn,
    )

    // Second call should reference first section's content
    const secondPrompt = mockFn.mock.calls[1][0]
    expect(secondPrompt).toContain('섹션 1 내용')
  })
})
