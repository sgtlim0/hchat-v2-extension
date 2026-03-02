// lib/docTemplateParser.ts — DOCX template parsing with {{placeholder}} extraction

export interface TemplateField {
  id: string
  name: string
  label: string
  context: string
  defaultValue?: string
  sectionIndex: number
}

export interface TemplateSection {
  index: number
  heading: string
  content: string
  level: number
}

export interface ParsedTemplate {
  title: string
  sections: TemplateSection[]
  fields: TemplateField[]
  rawMarkdown: string
}

export class TemplateParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TemplateParseError'
  }
}

const PLACEHOLDER_REGEX = /\{\{([^}]+)\}\}/g

/**
 * Extract all {{placeholder}} names from text.
 */
export function extractPlaceholders(text: string): string[] {
  const matches: string[] = []
  let match
  while ((match = PLACEHOLDER_REGEX.exec(text)) !== null) {
    const name = match[1].trim()
    if (name && !matches.includes(name)) {
      matches.push(name)
    }
  }
  // Reset regex lastIndex
  PLACEHOLDER_REGEX.lastIndex = 0
  return matches
}

/**
 * Parse a DOCX template file, extracting sections and {{field}} placeholders.
 */
export async function parseDocxTemplate(file: File): Promise<ParsedTemplate> {
  const JSZip = (await import('jszip')).default
  const buffer = await file.arrayBuffer()

  let zip
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch {
    throw new TemplateParseError('Invalid DOCX file: unable to open as ZIP archive')
  }

  const docXml = zip.file('word/document.xml')
  if (!docXml) {
    throw new TemplateParseError('Invalid DOCX file: missing word/document.xml')
  }

  const xmlContent = await docXml.async('string')
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlContent, 'application/xml')

  const nsW = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

  // Extract paragraphs
  const paragraphs = doc.getElementsByTagNameNS(nsW, 'p')
  const lines: { text: string; isHeading: boolean; headingLevel: number }[] = []

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i]
    // Get all text runs
    const runs = para.getElementsByTagNameNS(nsW, 't')
    let text = ''
    for (let j = 0; j < runs.length; j++) {
      text += runs[j].textContent ?? ''
    }

    // Detect heading style
    const pPr = para.getElementsByTagNameNS(nsW, 'pPr')[0]
    const pStyle = pPr?.getElementsByTagNameNS(nsW, 'pStyle')[0]
    const styleVal = pStyle?.getAttribute('w:val') ?? ''

    let isHeading = false
    let headingLevel = 0

    // Common heading patterns: Heading1, Heading2, heading 1, Title
    const headingMatch = styleVal.match(/(?:heading|Heading)\s*(\d)/i)
    if (headingMatch) {
      isHeading = true
      headingLevel = parseInt(headingMatch[1], 10)
    } else if (/^title$/i.test(styleVal)) {
      isHeading = true
      headingLevel = 0 // Title is special
    }

    if (text.trim().length > 0) {
      lines.push({ text: text.trim(), isHeading, headingLevel })
    }
  }

  // Build sections and extract title
  let title = file.name.replace(/\.[^.]+$/, '')
  const sections: TemplateSection[] = []
  let currentSection: TemplateSection | null = null
  let sectionIndex = 0

  for (const line of lines) {
    if (line.isHeading && line.headingLevel === 0) {
      // Title
      title = line.text
      continue
    }

    if (line.isHeading && line.headingLevel > 0) {
      // New section
      if (currentSection) {
        sections.push(currentSection)
      }
      currentSection = {
        index: sectionIndex++,
        heading: line.text,
        content: '',
        level: line.headingLevel,
      }
    } else if (currentSection) {
      currentSection.content += (currentSection.content ? '\n' : '') + line.text
    } else {
      // Content before any heading — create a default section
      currentSection = {
        index: sectionIndex++,
        heading: '',
        content: line.text,
        level: 0,
      }
    }
  }

  if (currentSection) {
    sections.push(currentSection)
  }

  // Build raw markdown
  const mdParts: string[] = [`# ${title}`, '']
  for (const section of sections) {
    if (section.heading) {
      const prefix = '#'.repeat(section.level + 1)
      mdParts.push(`${prefix} ${section.heading}`, '')
    }
    if (section.content) {
      mdParts.push(section.content, '')
    }
  }
  const rawMarkdown = mdParts.join('\n')

  // Extract fields from all text
  const allText = [title, ...sections.map((s) => `${s.heading}\n${s.content}`)].join('\n')
  const allPlaceholders = extractPlaceholders(allText)

  const fields: TemplateField[] = allPlaceholders.map((name) => {
    // Find which section the field is in
    let fieldSectionIndex = 0
    for (const section of sections) {
      const sectionText = `${section.heading}\n${section.content}`
      if (sectionText.includes(`{{${name}}}`)) {
        fieldSectionIndex = section.index
        break
      }
    }

    return {
      id: name.toLowerCase().replace(/\s+/g, '_'),
      name,
      label: name,
      context: '',
      sectionIndex: fieldSectionIndex,
    }
  })

  return { title, sections, fields, rawMarkdown }
}

/**
 * Fill a template's placeholders with provided values.
 */
export function fillTemplate(
  template: ParsedTemplate,
  values: Record<string, string>,
): string {
  let result = template.rawMarkdown

  for (const [key, value] of Object.entries(values)) {
    // Replace all occurrences of {{key}}
    result = result.replace(
      new RegExp(`\\{\\{${escapeRegex(key)}\\}\\}`, 'g'),
      value,
    )
  }

  return result
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
