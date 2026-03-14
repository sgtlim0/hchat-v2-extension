import { useMemo } from 'react'
import { CodeBlock } from './CodeBlock'

/** Escape HTML special characters to prevent XSS */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Parse inline markdown patterns into React elements */
function parseInlineMarkdown(text: string): React.ReactNode[] {
  const escaped = escapeHtml(text)
  const nodes: React.ReactNode[] = []
  // Match bold (**...**), italic (*...*), inline code (`...`)
  const inlineRegex = /\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = inlineRegex.exec(escaped)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(escaped.slice(lastIndex, match.index))
    }
    if (match[1] !== undefined) {
      nodes.push(<strong key={`s${key++}`}>{match[1]}</strong>)
    } else if (match[2] !== undefined) {
      nodes.push(<em key={`e${key++}`}>{match[2]}</em>)
    } else if (match[3] !== undefined) {
      nodes.push(<code key={`c${key++}`}>{match[3]}</code>)
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < escaped.length) {
    nodes.push(escaped.slice(lastIndex))
  }

  return nodes
}

/** Check if a line is a heading and return the element, or null */
function tryParseHeading(line: string, key: number): React.ReactNode | null {
  const h3Match = line.match(/^### (.+)$/)
  if (h3Match) return <h3 key={key}>{parseInlineMarkdown(h3Match[1])}</h3>

  const h2Match = line.match(/^## (.+)$/)
  if (h2Match) return <h2 key={key}>{parseInlineMarkdown(h2Match[1])}</h2>

  const h1Match = line.match(/^# (.+)$/)
  if (h1Match) return <h1 key={key}>{parseInlineMarkdown(h1Match[1])}</h1>

  return null
}

/** Parse a text block (non-code) into React elements */
function parseTextBlock(content: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const paragraphs = content.split(/\n\n/)
  let key = 0

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim()
    if (!trimmed) continue

    const lines = trimmed.split('\n')

    // Check if all lines are list items
    const listItems: string[] = []
    let allList = true

    for (const line of lines) {
      const listMatch = line.match(/^- (.+)$/)
      if (listMatch) {
        listItems.push(listMatch[1])
      } else {
        allList = false
      }
    }

    if (allList && listItems.length > 0) {
      nodes.push(
        <ul key={`ul${key++}`}>
          {listItems.map((item, i) => (
            <li key={i}>{parseInlineMarkdown(item)}</li>
          ))}
        </ul>
      )
      continue
    }

    // Process lines: headings become top-level elements, others group into paragraphs
    const pendingLines: string[] = []

    const flushPending = () => {
      if (pendingLines.length === 0) return
      const lineNodes: React.ReactNode[] = []
      for (let i = 0; i < pendingLines.length; i++) {
        if (i > 0) lineNodes.push(<br key={`br${key++}`} />)
        lineNodes.push(<span key={`ln${key++}`}>{parseInlineMarkdown(pendingLines[i])}</span>)
      }
      nodes.push(<p key={`p${key++}`}>{lineNodes}</p>)
      pendingLines.length = 0
    }

    for (const line of lines) {
      const heading = tryParseHeading(line, key++)
      if (heading) {
        flushPending()
        nodes.push(heading)
      } else {
        pendingLines.push(line)
      }
    }
    flushPending()
  }

  return nodes
}

/** Markdown renderer with enhanced code blocks — XSS-safe (no dangerouslySetInnerHTML) */
export function MD({ text }: { text: string }) {
  const parts = useMemo(() => {
    const result: Array<{ type: 'text' | 'code'; content: string; lang?: string }> = []
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = codeBlockRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: 'text', content: text.slice(lastIndex, match.index) })
      }
      result.push({ type: 'code', content: match[2].trimEnd(), lang: match[1] })
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < text.length) {
      result.push({ type: 'text', content: text.slice(lastIndex) })
    }

    return result
  }, [text])

  return (
    <div className="md">
      {parts.map((part, i) => {
        if (part.type === 'code') {
          return <CodeBlock key={i} code={part.content} lang={part.lang ?? ''} />
        }
        return <div key={i}>{parseTextBlock(part.content)}</div>
      })}
    </div>
  )
}
