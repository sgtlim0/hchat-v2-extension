import { useMemo } from 'react'
import { CodeBlock } from './CodeBlock'

/** Markdown renderer with enhanced code blocks */
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
        const html = part.content
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
          .replace(/`([^`]+)`/g, '<code>$1</code>')
          .replace(/^### (.+)$/gm, '<h3>$1</h3>')
          .replace(/^## (.+)$/gm, '<h2>$1</h2>')
          .replace(/^# (.+)$/gm, '<h1>$1</h1>')
          .replace(/^- (.+)$/gm, '<li>$1</li>')
          .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
          .replace(/\n\n/g, '</p><p>')
          .replace(/\n/g, '<br/>')
        return <div key={i} dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }} />
      })}
    </div>
  )
}
