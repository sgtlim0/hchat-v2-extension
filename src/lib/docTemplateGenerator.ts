// lib/docTemplateGenerator.ts — AI-powered template field suggestions and document generation

import type { ParsedTemplate, TemplateField, TemplateSection } from './docTemplateParser'

export interface GeneratedTemplateDoc {
  title: string
  markdown: string
  sections: { heading: string; content: string }[]
  createdAt: number
}

type GenerateFn = (prompt: string) => Promise<string>

/**
 * Generate AI suggestions for all template fields based on context.
 */
export async function generateFieldSuggestions(
  fields: readonly TemplateField[],
  context: string,
  generateFn: GenerateFn,
): Promise<Record<string, string>> {
  if (fields.length === 0) return {}

  const fieldList = fields.map((f) => `- ${f.name}`).join('\n')
  const contextPart = context ? `\n\n참고 정보:\n${context}` : ''

  const prompt = `다음 문서 템플릿의 필드에 적절한 값을 제안해주세요.
JSON 객체로 반환해주세요 (예: {"필드명": "제안 값"}).
간결하고 전문적인 내용으로 작성해주세요.

필드 목록:
${fieldList}${contextPart}

JSON 객체만 반환해주세요.`

  const response = await generateFn(prompt)

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return {}
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    const result: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed)) {
      result[key] = String(value)
    }
    return result
  } catch {
    return {}
  }
}

/**
 * Generate a full document from a template with AI-expanded content.
 * Fields are filled first, then each section is expanded by AI.
 */
export async function generateFullTemplateDoc(
  template: ParsedTemplate,
  values: Record<string, string>,
  generateFn: GenerateFn,
  onProgress?: (current: number, total: number) => void,
): Promise<GeneratedTemplateDoc> {
  const sections = template.sections.filter((s) => s.heading || s.content)
  const total = sections.length
  const expandedSections: { heading: string; content: string }[] = []

  for (let i = 0; i < sections.length; i++) {
    onProgress?.(i + 1, total)

    const section = sections[i]
    const sectionContent = fillSectionPlaceholders(section, values)

    // If section has content (not just placeholders), expand it with AI
    if (sectionContent.trim().length > 0) {
      const expanded = await expandSection(
        section.heading,
        sectionContent,
        template.title,
        expandedSections,
        generateFn,
      )
      expandedSections.push({ heading: section.heading, content: expanded })
    } else {
      expandedSections.push({ heading: section.heading, content: sectionContent })
    }
  }

  // Build final markdown
  const mdParts: string[] = [`# ${fillTitlePlaceholders(template.title, values)}`, '']
  for (const section of expandedSections) {
    if (section.heading) {
      mdParts.push(`## ${section.heading}`, '')
    }
    if (section.content) {
      mdParts.push(section.content, '')
    }
  }
  const markdown = mdParts.join('\n')

  return {
    title: fillTitlePlaceholders(template.title, values),
    markdown,
    sections: expandedSections,
    createdAt: Date.now(),
  }
}

function fillSectionPlaceholders(
  section: TemplateSection,
  values: Record<string, string>,
): string {
  let content = section.content
  for (const [key, value] of Object.entries(values)) {
    content = content.replace(
      new RegExp(`\\{\\{${escapeRegex(key)}\\}\\}`, 'g'),
      value,
    )
  }
  return content
}

function fillTitlePlaceholders(
  title: string,
  values: Record<string, string>,
): string {
  let result = title
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(
      new RegExp(`\\{\\{${escapeRegex(key)}\\}\\}`, 'g'),
      value,
    )
  }
  return result
}

async function expandSection(
  heading: string,
  content: string,
  docTitle: string,
  previousSections: readonly { heading: string; content: string }[],
  generateFn: GenerateFn,
): Promise<string> {
  const prevContext = previousSections.length > 0
    ? `\n\n이전 섹션:\n${previousSections.map((s) => `## ${s.heading}\n${s.content}`).join('\n\n')}`
    : ''

  const prompt = `문서 "${docTitle}"의 다음 섹션을 확장하여 작성해주세요.

섹션 제목: ${heading}
기존 내용 (템플릿에서 채워진 필드 포함):
${content}${prevContext}

위 내용을 기반으로 더 상세하고 전문적인 내용으로 확장해주세요.
기존 내용의 핵심 정보는 유지하면서 보완하세요.
Markdown 형식으로 섹션 내용만 작성해주세요. 섹션 제목(##)은 포함하지 마세요.`

  return generateFn(prompt)
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
