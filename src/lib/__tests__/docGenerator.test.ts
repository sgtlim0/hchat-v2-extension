import { describe, it, expect, vi } from 'vitest'
import {
  generateOutline,
  generateSection,
  generateFullDoc,
  exportAsMarkdown,
  markdownToDocx,
  getDocTypePrompt,
  type GeneratedDoc,
  type DocType,
} from '../docGenerator'

// --- getDocTypePrompt ---

describe('getDocTypePrompt', () => {
  it('한국어 보고서 프롬프트 반환', () => {
    expect(getDocTypePrompt('report', 'ko')).toBe('비즈니스 보고서')
  })

  it('영어 이메일 프롬프트 반환', () => {
    expect(getDocTypePrompt('email', 'en')).toBe('business email')
  })

  it('일본어 제안서 프롬프트 반환', () => {
    expect(getDocTypePrompt('proposal', 'ja')).toBe('提案書')
  })

  it('한국어 회의록 프롬프트 반환', () => {
    expect(getDocTypePrompt('meeting', 'ko')).toBe('회의록')
  })

  it('영어 메모 프롬프트 반환', () => {
    expect(getDocTypePrompt('memo', 'en')).toBe('business memo')
  })

  it('지원하지 않는 언어는 영어로 폴백', () => {
    expect(getDocTypePrompt('report', 'fr')).toBe('business report')
  })

  const docTypes: DocType[] = ['report', 'email', 'proposal', 'meeting', 'memo']
  for (const dt of docTypes) {
    it(`모든 언어에서 ${dt} 유형 반환`, () => {
      expect(getDocTypePrompt(dt, 'ko')).toBeTruthy()
      expect(getDocTypePrompt(dt, 'en')).toBeTruthy()
      expect(getDocTypePrompt(dt, 'ja')).toBeTruthy()
    })
  }
})

// --- generateOutline ---

describe('generateOutline', () => {
  it('AI 응답에서 JSON 배열 파싱', async () => {
    const mockFn = vi.fn().mockResolvedValue('다음은 목차입니다:\n["서론", "본론", "결론"]')
    const result = await generateOutline('테스트 주제', 'report', '', mockFn)
    expect(result).toEqual(['서론', '본론', '결론'])
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('배경 정보가 프롬프트에 포함됨', async () => {
    const mockFn = vi.fn().mockResolvedValue('["섹션1"]')
    await generateOutline('주제', 'email', '배경 정보입니다', mockFn)
    expect(mockFn.mock.calls[0][0]).toContain('배경 정보입니다')
  })

  it('JSON 배열이 없으면 에러', async () => {
    const mockFn = vi.fn().mockResolvedValue('응답에 배열이 없습니다')
    await expect(generateOutline('주제', 'report', '', mockFn)).rejects.toThrow('Failed to parse outline')
  })

  it('빈 배열이면 에러', async () => {
    const mockFn = vi.fn().mockResolvedValue('[]')
    await expect(generateOutline('주제', 'report', '', mockFn)).rejects.toThrow('Empty outline received')
  })

  it('배열 내 요소를 문자열로 변환', async () => {
    const mockFn = vi.fn().mockResolvedValue('[1, 2, 3]')
    const result = await generateOutline('주제', 'report', '', mockFn)
    expect(result).toEqual(['1', '2', '3'])
  })
})

// --- generateSection ---

describe('generateSection', () => {
  it('섹션 콘텐츠 생성', async () => {
    const mockFn = vi.fn().mockResolvedValue('섹션 내용입니다.')
    const result = await generateSection('서론', '테스트 주제', 'report', '', '', mockFn)
    expect(result).toBe('섹션 내용입니다.')
  })

  it('프롬프트에 섹션 제목 포함', async () => {
    const mockFn = vi.fn().mockResolvedValue('content')
    await generateSection('결론', '주제', 'report', '', '', mockFn)
    expect(mockFn.mock.calls[0][0]).toContain('결론')
  })

  it('이전 섹션 컨텍스트 전달', async () => {
    const mockFn = vi.fn().mockResolvedValue('content')
    await generateSection('본론', '주제', 'report', '', '## 서론\n이전 내용', mockFn)
    expect(mockFn.mock.calls[0][0]).toContain('이전 내용')
  })

  it('배경 정보 전달', async () => {
    const mockFn = vi.fn().mockResolvedValue('content')
    await generateSection('서론', '주제', 'proposal', '중요한 배경', '', mockFn)
    expect(mockFn.mock.calls[0][0]).toContain('중요한 배경')
  })
})

// --- generateFullDoc ---

describe('generateFullDoc', () => {
  it('전체 문서 생성', async () => {
    let callCount = 0
    const mockFn = vi.fn().mockImplementation(async () => {
      callCount++
      return `섹션 ${callCount} 내용`
    })
    const onProgress = vi.fn()

    const result = await generateFullDoc(
      '테스트', 'report', '', ['서론', '본론', '결론'], mockFn, onProgress,
    )

    expect(result.title).toBe('테스트')
    expect(result.type).toBe('report')
    expect(result.sections).toHaveLength(3)
    expect(result.sections[0].title).toBe('서론')
    expect(result.sections[0].content).toBe('섹션 1 내용')
    expect(result.markdown).toContain('# 테스트')
    expect(result.markdown).toContain('## 서론')
    expect(result.createdAt).toBeGreaterThan(0)
  })

  it('진행률 콜백 호출', async () => {
    const mockFn = vi.fn().mockResolvedValue('content')
    const onProgress = vi.fn()

    await generateFullDoc('주제', 'memo', '', ['A', 'B'], mockFn, onProgress)

    expect(onProgress).toHaveBeenCalledTimes(2)
    expect(onProgress).toHaveBeenCalledWith(1, 2)
    expect(onProgress).toHaveBeenCalledWith(2, 2)
  })

  it('섹션 생성 중 에러 전파', async () => {
    const mockFn = vi.fn()
      .mockResolvedValueOnce('content')
      .mockRejectedValueOnce(new Error('API error'))
    const onProgress = vi.fn()

    await expect(
      generateFullDoc('주제', 'report', '', ['A', 'B'], mockFn, onProgress),
    ).rejects.toThrow('API error')
  })

  it('이전 섹션을 다음 섹션 생성에 전달', async () => {
    const mockFn = vi.fn().mockResolvedValue('content')
    await generateFullDoc('주제', 'report', '', ['A', 'B'], mockFn, vi.fn())

    // 두 번째 호출의 프롬프트에 첫 번째 섹션이 포함
    const secondCall = mockFn.mock.calls[1][0]
    expect(secondCall).toContain('## A')
  })
})

// --- exportAsMarkdown ---

describe('exportAsMarkdown', () => {
  it('Markdown Blob 생성', () => {
    const doc: GeneratedDoc = {
      title: '테스트 문서',
      type: 'report',
      sections: [{ title: '서론', content: '내용' }],
      markdown: '# 테스트 문서\n\n## 서론\n\n내용\n',
      createdAt: Date.now(),
    }
    const blob = exportAsMarkdown(doc)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('text/markdown;charset=utf-8')
  })

  it('Blob 크기가 0보다 큼', () => {
    const doc: GeneratedDoc = {
      title: 'Test',
      type: 'memo',
      sections: [],
      markdown: '# Test',
      createdAt: Date.now(),
    }
    const blob = exportAsMarkdown(doc)
    expect(blob.size).toBeGreaterThan(0)
  })
})

// --- markdownToDocx ---

describe('markdownToDocx', () => {
  it('DOCX Blob 생성', async () => {
    const markdown = '# Title\n\n## Section\n\nParagraph text\n\n- Item 1\n- Item 2'
    const blob = await markdownToDocx(markdown, 'Test')
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('빈 Markdown도 처리', async () => {
    const blob = await markdownToDocx('', 'Empty')
    expect(blob).toBeInstanceOf(Blob)
  })

  it('다양한 헤딩 레벨 처리', async () => {
    const markdown = '# H1\n## H2\n### H3\nPlain text'
    const blob = await markdownToDocx(markdown, 'Headings')
    expect(blob.size).toBeGreaterThan(0)
  })

  it('불릿 리스트 처리 (- 와 *)', async () => {
    const markdown = '- Item A\n* Item B'
    const blob = await markdownToDocx(markdown, 'Lists')
    expect(blob.size).toBeGreaterThan(0)
  })
})
