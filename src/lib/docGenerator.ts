// lib/docGenerator.ts — AI document generation engine

export type DocType = 'report' | 'email' | 'proposal' | 'meeting' | 'memo'

export interface DocSection {
  title: string
  content: string
}

export interface GeneratedDoc {
  title: string
  type: DocType
  sections: DocSection[]
  markdown: string
  createdAt: number
}

type GenerateFn = (prompt: string) => Promise<string>

const DOC_TYPE_PROMPTS: Record<string, Record<DocType, string>> = {
  ko: {
    report: '비즈니스 보고서',
    email: '비즈니스 이메일',
    proposal: '제안서',
    meeting: '회의록',
    memo: '업무 메모',
  },
  en: {
    report: 'business report',
    email: 'business email',
    proposal: 'proposal',
    meeting: 'meeting minutes',
    memo: 'business memo',
  },
  ja: {
    report: 'ビジネスレポート',
    email: 'ビジネスメール',
    proposal: '提案書',
    meeting: '議事録',
    memo: '業務メモ',
  },
}

export function getDocTypePrompt(docType: DocType, locale: string): string {
  const lang = DOC_TYPE_PROMPTS[locale] ?? DOC_TYPE_PROMPTS['en']
  return lang[docType] ?? docType
}

function parseJsonArray(text: string): string[] {
  const jsonMatch = text.match(/\[[\s\S]*?\]/)
  if (!jsonMatch) {
    throw new Error('Failed to parse outline from AI response')
  }
  const parsed: unknown = JSON.parse(jsonMatch[0])
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Empty outline received')
  }
  return parsed.map(String)
}

export async function generateOutline(
  topic: string,
  docType: DocType,
  context: string,
  generateFn: GenerateFn,
): Promise<string[]> {
  const contextPart = context ? `\n\n참고 배경 정보:\n${context}` : ''
  const prompt = `다음 주제로 "${getDocTypePrompt(docType, 'ko')}" 문서의 목차(섹션 제목 목록)를 생성해주세요.
JSON 배열 형태로 반환해주세요 (예: ["서론", "본론", "결론"]).
5-8개의 적절한 섹션 제목을 만들어주세요.

주제: ${topic}${contextPart}`

  const response = await generateFn(prompt)
  return parseJsonArray(response)
}

export async function generateSection(
  sectionTitle: string,
  topic: string,
  docType: DocType,
  context: string,
  previousSections: string,
  generateFn: GenerateFn,
): Promise<string> {
  const contextPart = context ? `\n\n배경 정보:\n${context}` : ''
  const prevPart = previousSections
    ? `\n\n이전 섹션 내용:\n${previousSections}`
    : ''

  const prompt = `"${getDocTypePrompt(docType, 'ko')}" 문서의 다음 섹션을 작성해주세요.

문서 주제: ${topic}
현재 섹션: ${sectionTitle}${contextPart}${prevPart}

Markdown 형식으로 해당 섹션의 내용만 작성해주세요. 섹션 제목(##)은 포함하지 마세요.`

  return generateFn(prompt)
}

export async function generateFullDoc(
  topic: string,
  docType: DocType,
  context: string,
  outline: readonly string[],
  generateFn: GenerateFn,
  onProgress: (current: number, total: number) => void,
): Promise<GeneratedDoc> {
  const sections: DocSection[] = []
  const total = outline.length

  for (let i = 0; i < total; i++) {
    onProgress(i + 1, total)
    const previousSections = sections
      .map((s) => `## ${s.title}\n${s.content}`)
      .join('\n\n')

    const content = await generateSection(
      outline[i],
      topic,
      docType,
      context,
      previousSections,
      generateFn,
    )
    sections.push({ title: outline[i], content })
  }

  const markdown = buildMarkdown(topic, sections)

  return {
    title: topic,
    type: docType,
    sections,
    markdown,
    createdAt: Date.now(),
  }
}

function buildMarkdown(title: string, sections: readonly DocSection[]): string {
  const parts = [`# ${title}`, '']
  for (const section of sections) {
    parts.push(`## ${section.title}`, '', section.content, '')
  }
  return parts.join('\n')
}

export function exportAsMarkdown(doc: GeneratedDoc): Blob {
  return new Blob([doc.markdown], { type: 'text/markdown;charset=utf-8' })
}

export async function markdownToDocx(markdown: string, title: string): Promise<Blob> {
  const { Document, Packer, Paragraph, HeadingLevel } = await import('docx')
  const lines = markdown.split('\n')
  const children: InstanceType<typeof Paragraph>[] = []

  for (const line of lines) {
    const trimmed = line.trimEnd()
    if (trimmed.startsWith('### ')) {
      children.push(new Paragraph({
        text: trimmed.slice(4),
        heading: HeadingLevel.HEADING_3,
      }))
    } else if (trimmed.startsWith('## ')) {
      children.push(new Paragraph({
        text: trimmed.slice(3),
        heading: HeadingLevel.HEADING_2,
      }))
    } else if (trimmed.startsWith('# ')) {
      children.push(new Paragraph({
        text: trimmed.slice(2),
        heading: HeadingLevel.HEADING_1,
      }))
    } else if (/^[-*]\s/.test(trimmed)) {
      children.push(new Paragraph({
        text: trimmed.replace(/^[-*]\s/, ''),
        bullet: { level: 0 },
      }))
    } else if (trimmed === '') {
      children.push(new Paragraph({ text: '' }))
    } else {
      children.push(new Paragraph({ text: trimmed }))
    }
  }

  const doc = new Document({
    title,
    sections: [{ children }],
  })

  return Packer.toBlob(doc)
}
