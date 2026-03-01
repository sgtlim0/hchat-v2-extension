// lib/exportChat.ts — Conversation export in multiple formats
import type { Conversation } from './chatHistory'

export type ExportFormat = 'markdown' | 'html' | 'json' | 'txt'

export interface ExportOptions {
  format: ExportFormat
  conversation: Conversation
  includeTimestamps?: boolean
  includeModelInfo?: boolean
}

export function exportConversation(opts: ExportOptions): Blob {
  switch (opts.format) {
    case 'markdown': return exportMarkdown(opts)
    case 'html': return exportHtml(opts)
    case 'json': return exportJson(opts)
    case 'txt': return exportPlainText(opts)
  }
}

function exportMarkdown({ conversation: conv, includeTimestamps, includeModelInfo }: ExportOptions): Blob {
  const lines: string[] = [
    `# ${conv.title}`,
    '',
  ]

  if (includeModelInfo) {
    lines.push(`> Model: ${conv.model} | Created: ${new Date(conv.createdAt).toLocaleDateString('ko-KR')}`)
    lines.push('')
  }

  lines.push('---', '')

  for (const msg of conv.messages) {
    if (msg.streaming) continue
    const prefix = msg.role === 'user' ? '### User' : '### Assistant'
    const ts = includeTimestamps ? ` (${new Date(msg.ts).toLocaleString('ko-KR')})` : ''
    lines.push(`${prefix}${ts}`, '', msg.content, '')
  }

  return new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
}

function exportHtml({ conversation: conv }: ExportOptions): Blob {
  const messagesHtml = conv.messages
    .filter((m) => !m.streaming)
    .map((msg) => {
      const cls = msg.role === 'user' ? 'msg-user' : 'msg-ai'
      const content = msg.content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>')
      return `<div class="msg ${cls}">${content}</div>`
    })
    .join('\n')

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>${conv.title}</title>
  <style>
    body { font-family: -apple-system, 'Noto Sans KR', sans-serif; max-width: 720px; margin: 0 auto; padding: 24px; background: #0e1318; color: #eef1f5; }
    h1 { text-align: center; font-size: 18px; }
    .meta { text-align: center; color: #6b7c93; font-size: 13px; margin-bottom: 16px; }
    hr { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 16px 0; }
    .msg { margin: 12px 0; padding: 12px 16px; border-radius: 12px; font-size: 14px; line-height: 1.7; }
    .msg-user { background: linear-gradient(135deg, #183b2e, #0e2a1f); border: 1px solid rgba(52,211,153,0.18); margin-left: 48px; color: #d4f7e9; }
    .msg-ai { background: #141b24; border: 1px solid rgba(255,255,255,0.06); margin-right: 48px; }
    pre { background: #080b0e; padding: 12px; border-radius: 8px; overflow-x: auto; }
    code { font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 13px; }
  </style>
</head>
<body>
  <h1>${conv.title}</h1>
  <p class="meta">${conv.model} &middot; ${new Date(conv.createdAt).toLocaleDateString('ko-KR')}</p>
  <hr>
  ${messagesHtml}
</body>
</html>`

  return new Blob([html], { type: 'text/html;charset=utf-8' })
}

function exportJson({ conversation: conv }: ExportOptions): Blob {
  const data = {
    exportedAt: new Date().toISOString(),
    version: '2.0',
    conversation: {
      ...conv,
      messages: conv.messages.filter((m) => !m.streaming),
    },
  }
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
}

function exportPlainText({ conversation: conv }: ExportOptions): Blob {
  const lines = conv.messages
    .filter((m) => !m.streaming)
    .map((msg) => {
      const role = msg.role === 'user' ? 'User' : 'Assistant'
      return `[${role}]\n${msg.content}`
    })

  return new Blob([`${conv.title}\n${'='.repeat(40)}\n\n${lines.join('\n\n---\n\n')}\n`], { type: 'text/plain;charset=utf-8' })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function copyConversationAsMarkdown(conv: Conversation): Promise<void> {
  const blob = exportConversation({
    format: 'markdown',
    conversation: conv,
    includeTimestamps: false,
  })
  const text = await blob.text()
  await navigator.clipboard.writeText(text)
}
