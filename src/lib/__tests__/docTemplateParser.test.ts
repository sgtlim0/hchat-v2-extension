import { describe, it, expect } from 'vitest'
import {
  extractPlaceholders,
  parseDocxTemplate,
  fillTemplate,
  TemplateParseError,
  type ParsedTemplate,
} from '../docTemplateParser'

// --- Helper: create a minimal DOCX file ---

async function createDocx(paragraphs: { text: string; style?: string }[]): Promise<File> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()

  const bodyXml = paragraphs.map((p) => {
    const styleXml = p.style
      ? `<w:pPr><w:pStyle w:val="${p.style}"/></w:pPr>`
      : ''
    return `<w:p>${styleXml}<w:r><w:t>${p.text}</w:t></w:r></w:p>`
  }).join('')

  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${bodyXml}</w:body>
</w:document>`)

  const blob = await zip.generateAsync({ type: 'blob' })
  return new File([blob], 'template.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

// --- extractPlaceholders ---

describe('extractPlaceholders', () => {
  it('단일 플레이스홀더 추출', () => {
    expect(extractPlaceholders('Hello {{name}}')).toEqual(['name'])
  })

  it('여러 플레이스홀더 추출', () => {
    expect(extractPlaceholders('{{first}} and {{second}}')).toEqual(['first', 'second'])
  })

  it('중복 제거', () => {
    expect(extractPlaceholders('{{a}} {{b}} {{a}}')).toEqual(['a', 'b'])
  })

  it('공백 트림', () => {
    expect(extractPlaceholders('{{ name }}')).toEqual(['name'])
  })

  it('플레이스홀더 없으면 빈 배열', () => {
    expect(extractPlaceholders('no placeholders here')).toEqual([])
  })

  it('빈 문자열은 빈 배열', () => {
    expect(extractPlaceholders('')).toEqual([])
  })

  it('중첩 중괄호 — 내부 {{}} 캡처', () => {
    // {{{nested}}} has {{nested}} inside, which gets captured
    expect(extractPlaceholders('{{{nested}}}')).toEqual(['{nested'])
  })

  it('불완전한 플레이스홀더 무시', () => {
    expect(extractPlaceholders('{{incomplete')).toEqual([])
  })

  it('한글 플레이스홀더', () => {
    expect(extractPlaceholders('{{회사명}} {{담당자}}')).toEqual(['회사명', '담당자'])
  })

  it('빈 플레이스홀더 {{}} 무시', () => {
    expect(extractPlaceholders('{{}}는 비어있음')).toEqual([])
  })
})

// --- parseDocxTemplate ---

describe('parseDocxTemplate', () => {
  it('기본 문서 파싱', async () => {
    const file = await createDocx([
      { text: 'My Document', style: 'Title' },
      { text: 'Introduction', style: 'Heading1' },
      { text: 'Hello {{name}}, welcome to {{company}}.' },
    ])

    const result = await parseDocxTemplate(file)
    expect(result.title).toBe('My Document')
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].heading).toBe('Introduction')
    expect(result.fields).toHaveLength(2)
    expect(result.fields[0].name).toBe('name')
    expect(result.fields[1].name).toBe('company')
  })

  it('여러 섹션 파싱', async () => {
    const file = await createDocx([
      { text: 'Report', style: 'Title' },
      { text: 'Summary', style: 'Heading1' },
      { text: '{{summary_text}}' },
      { text: 'Details', style: 'Heading1' },
      { text: '{{detail_text}}' },
    ])

    const result = await parseDocxTemplate(file)
    expect(result.sections).toHaveLength(2)
    expect(result.sections[0].heading).toBe('Summary')
    expect(result.sections[1].heading).toBe('Details')
    expect(result.fields).toHaveLength(2)
  })

  it('제목 없으면 파일명 사용', async () => {
    const file = await createDocx([
      { text: 'Just content' },
    ])

    const result = await parseDocxTemplate(file)
    expect(result.title).toBe('template')
  })

  it('필드 없는 문서', async () => {
    const file = await createDocx([
      { text: 'Title', style: 'Title' },
      { text: 'No placeholders here' },
    ])

    const result = await parseDocxTemplate(file)
    expect(result.fields).toHaveLength(0)
  })

  it('rawMarkdown 생성', async () => {
    const file = await createDocx([
      { text: 'Doc Title', style: 'Title' },
      { text: 'Section 1', style: 'Heading1' },
      { text: 'Content here' },
    ])

    const result = await parseDocxTemplate(file)
    expect(result.rawMarkdown).toContain('# Doc Title')
    expect(result.rawMarkdown).toContain('## Section 1')
    expect(result.rawMarkdown).toContain('Content here')
  })

  it('잘못된 ZIP 파일 에러', async () => {
    const file = new File(['not a zip'], 'bad.docx')
    await expect(parseDocxTemplate(file)).rejects.toThrow(TemplateParseError)
    await expect(parseDocxTemplate(file)).rejects.toThrow('unable to open as ZIP archive')
  })

  it('word/document.xml 없으면 에러', async () => {
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    zip.file('other.xml', '<data/>')
    const blob = await zip.generateAsync({ type: 'blob' })
    const file = new File([blob], 'bad.docx')

    await expect(parseDocxTemplate(file)).rejects.toThrow(TemplateParseError)
    await expect(parseDocxTemplate(file)).rejects.toThrow('word/document.xml')
  })

  it('Heading2 스타일 감지', async () => {
    const file = await createDocx([
      { text: 'Title', style: 'Title' },
      { text: 'Sub Section', style: 'Heading2' },
      { text: 'Content' },
    ])

    const result = await parseDocxTemplate(file)
    expect(result.sections[0].heading).toBe('Sub Section')
    expect(result.sections[0].level).toBe(2)
  })

  it('필드 sectionIndex 매핑', async () => {
    const file = await createDocx([
      { text: 'Doc', style: 'Title' },
      { text: 'Part A', style: 'Heading1' },
      { text: '{{field_a}}' },
      { text: 'Part B', style: 'Heading1' },
      { text: '{{field_b}}' },
    ])

    const result = await parseDocxTemplate(file)
    expect(result.fields[0].sectionIndex).toBe(0)
    expect(result.fields[1].sectionIndex).toBe(1)
  })

  it('TemplateParseError 인스턴스 검증', () => {
    const err = new TemplateParseError('test')
    expect(err.name).toBe('TemplateParseError')
    expect(err.message).toBe('test')
    expect(err).toBeInstanceOf(Error)
  })
})

// --- fillTemplate ---

describe('fillTemplate', () => {
  const baseTemplate: ParsedTemplate = {
    title: 'Test {{company}}',
    sections: [
      { index: 0, heading: 'Intro', content: 'Hello {{name}}, from {{company}}.', level: 1 },
    ],
    fields: [
      { id: 'name', name: 'name', label: 'Name', context: '', sectionIndex: 0 },
      { id: 'company', name: 'company', label: 'Company', context: '', sectionIndex: 0 },
    ],
    rawMarkdown: '# Test {{company}}\n\n## Intro\n\nHello {{name}}, from {{company}}.\n',
  }

  it('모든 플레이스홀더 교체', () => {
    const result = fillTemplate(baseTemplate, { name: 'Alice', company: 'ACME' })
    expect(result).toContain('Hello Alice, from ACME.')
    expect(result).toContain('# Test ACME')
    expect(result).not.toContain('{{')
  })

  it('일부만 교체', () => {
    const result = fillTemplate(baseTemplate, { name: 'Bob' })
    expect(result).toContain('Hello Bob')
    expect(result).toContain('{{company}}')
  })

  it('빈 값 객체 — 원본 유지', () => {
    const result = fillTemplate(baseTemplate, {})
    expect(result).toContain('{{name}}')
    expect(result).toContain('{{company}}')
  })

  it('특수문자 포함된 값', () => {
    const result = fillTemplate(baseTemplate, {
      name: 'John (CEO)',
      company: 'A&B Corp.',
    })
    expect(result).toContain('Hello John (CEO)')
    expect(result).toContain('A&B Corp.')
  })

  it('여러 번 등장하는 플레이스홀더 모두 교체', () => {
    const result = fillTemplate(baseTemplate, { company: 'ACME' })
    // company appears in both title and content
    expect(result).toContain('# Test ACME')
    expect(result).toContain('from ACME.')
    expect(result).not.toContain('{{company}}')
  })
})
