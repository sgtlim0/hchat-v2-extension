import { useState, useRef, useEffect, useCallback } from 'react'
import { useChat } from '../hooks/useChat'
import { useLocale } from '../i18n'
import { ModelSelector } from './ModelSelector'
import { PersonaSelector } from './PersonaSelector'
import { PromptLibrary, type Prompt } from '../lib/promptLibrary'
import { fileToBase64, getCurrentPageContent } from '../lib/pageReader'
import { exportConversation, downloadBlob, copyConversationAsMarkdown, type ExportFormat } from '../lib/exportChat'
import { TTS } from '../lib/tts'
import { STT } from '../lib/stt'
import { generateSummary, saveSummary, loadSummary, type Summary } from '../lib/summarize'
import { ChatHistory } from '../lib/chatHistory'
import { type PageContext, buildPageSystemPrompt } from '../lib/pageContext'
import type { Config } from '../hooks/useConfig'
import type { ChatMessage } from '../lib/chatHistory'
import type { AgentStep } from '../lib/agent'

interface Props {
  config: Config
  onNewConv?: () => void
  loadConvId?: string
  contextEnabled?: boolean
  onToggleContext?: () => void
  onRegisterActions?: (actions: { startNew: () => void; stop: () => void; focusInput: () => void }) => void
  onForkConv?: (newConvId: string) => void
}

/** Enhanced code block with language label and copy button */
function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const { t } = useLocale()
  const [copied, setCopied] = useState(false)
  const displayLang = lang || detectLanguage(code)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-block-lang">{displayLang}</span>
        <button className="code-block-copy" onClick={handleCopy}>
          {copied ? `✓ ${t('common.copied')}` : `📋 ${t('common.copy')}`}
        </button>
      </div>
      <pre className="code-block-body"><code>{code}</code></pre>
    </div>
  )
}

/** Simple language detection from code content */
function detectLanguage(code: string): string {
  if (/^(import |from |export |const |let |var |function |class |=>)/.test(code)) return 'javascript'
  if (/^(def |class |import |from |print\(|if __name__)/.test(code)) return 'python'
  if (/<\/?[a-z][\s\S]*>/i.test(code) && /<\/[a-z]+>/i.test(code)) return 'html'
  if (/^\s*\{[\s\S]*"[^"]+"\s*:/.test(code)) return 'json'
  if (/^(SELECT |INSERT |UPDATE |DELETE |CREATE |ALTER )/i.test(code)) return 'sql'
  if (/^#include|^int main\(|^void |^printf\(/.test(code)) return 'c'
  if (/^package |^func |^type |^import \(/.test(code)) return 'go'
  if (/^\s*[\w-]+\s*\{[\s\S]*\}/.test(code) && /:\s*[^;]+;/.test(code)) return 'css'
  return 'code'
}

/** Markdown renderer with enhanced code blocks */
function MD({ text }: { text: string }) {
  // Split by fenced code blocks first
  const parts: Array<{ type: 'text' | 'code'; content: string; lang?: string }> = []
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'code', content: match[2].trimEnd(), lang: match[1] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) })
  }

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

function SearchSources({ sources }: { sources: { title: string; url: string }[] }) {
  const { t } = useLocale()
  return (
    <div className="search-sources">
      <span className="search-sources-label">{t('chat.sources')}</span>
      {sources.map((s, i) => (
        <a key={i} href={s.url} target="_blank" rel="noreferrer" className="source-chip" title={s.url}>
          {s.title.slice(0, 30) || new URL(s.url).hostname}
        </a>
      ))}
    </div>
  )
}

function AgentStepsView({ steps }: { steps: AgentStep[] }) {
  const { t } = useLocale()
  const [expanded, setExpanded] = useState(false)
  const toolSteps = steps.filter((s) => s.type === 'tool_call' || s.type === 'tool_result')
  if (toolSteps.length === 0) return null

  return (
    <div className="agent-steps">
      <button className="agent-steps-toggle" onClick={() => setExpanded(!expanded)}>
        <span>{expanded ? '▼' : '▶'}</span>
        <span>{t('chat.toolUsage', { n: toolSteps.length / 2 })}</span>
      </button>
      {expanded && (
        <div className="agent-steps-list">
          {toolSteps.map((step) => (
            <div key={step.id} className={`agent-step agent-step-${step.type}`}>
              {step.type === 'tool_call' && (
                <>
                  <span className="agent-step-icon">🔧</span>
                  <span className="agent-step-name">{step.toolName}</span>
                  <span className="agent-step-detail">{step.toolInput ? JSON.stringify(step.toolInput).slice(0, 80) : ''}</span>
                </>
              )}
              {step.type === 'tool_result' && (
                <>
                  <span className="agent-step-icon">📋</span>
                  <span className="agent-step-result">{step.content.slice(0, 150)}{step.content.length > 150 ? '...' : ''}</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface MsgBubbleProps {
  msg: ChatMessage
  onCopy: (t: string) => void
  onTTS: (msgId: string, text: string) => void
  onEdit?: (msgId: string, newContent: string) => void
  onRegenerate?: () => void
  onFork?: (msgId: string) => void
  onPin?: (msgId: string) => void
}

function MsgBubble({ msg, onCopy, onTTS, onEdit, onRegenerate, onFork, onPin }: MsgBubbleProps) {
  const { t } = useLocale()
  const isUser = msg.role === 'user'
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(msg.content)
  const editRef = useRef<HTMLTextAreaElement>(null)
  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus()
      editRef.current.style.height = 'auto'
      editRef.current.style.height = editRef.current.scrollHeight + 'px'
    }
  }, [editing])

  const handleEditSave = () => {
    const trimmed = editText.trim()
    if (trimmed && trimmed !== msg.content) {
      onEdit?.(msg.id, trimmed)
    }
    setEditing(false)
  }

  const handleEditCancel = () => {
    setEditText(msg.content)
    setEditing(false)
  }

  return (
    <div className={`msg ${isUser ? 'msg-user' : 'msg-ai'}`}>
      <div className="msg-avatar">{isUser ? t('common.me') : 'H'}</div>
      <div className="msg-body">
        {msg.imageUrl && <img src={msg.imageUrl} className="msg-img" alt="attachment" />}
        {editing ? (
          <div className="msg-edit-area">
            <textarea
              ref={editRef}
              className="msg-edit-textarea"
              value={editText}
              onChange={(e) => { setEditText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSave() } if (e.key === 'Escape') handleEditCancel() }}
            />
            <div className="msg-edit-actions">
              <button className="btn btn-primary btn-xs" onClick={handleEditSave}>{t('chat.saveResend')}</button>
              <button className="btn btn-ghost btn-xs" onClick={handleEditCancel}>{t('common.cancel')}</button>
            </div>
          </div>
        ) : (
          <div className={`msg-bubble${msg.error ? ' error' : ''}`}>
            {isUser ? msg.content : <MD text={msg.content} />}
            {msg.streaming && <span className="cursor"> ▌</span>}
          </div>
        )}
        {msg.agentSteps && msg.agentSteps.length > 0 && (
          <AgentStepsView steps={msg.agentSteps} />
        )}
        {msg.searchSources && msg.searchSources.length > 0 && (
          <SearchSources sources={msg.searchSources} />
        )}
        <div className="msg-footer">
          <span className="msg-time">{formatTime(msg.ts)}</span>
          {msg.model && <span className="msg-model-tag">{msg.model.split('-')[1]}</span>}
          {msg.pinned && <span className="msg-pin-badge">📌</span>}
          {!msg.streaming && !editing && (
            <div className="msg-actions">
              <button className="icon-btn btn-xs" title={t('chat.copyBtn')} onClick={() => onCopy(msg.content)}>📋</button>
              {isUser && onEdit && (
                <button className="icon-btn btn-xs" title={t('chat.editBtn')} onClick={() => setEditing(true)}>✏️</button>
              )}
              {!isUser && (
                <>
                  <button
                    className={`icon-btn btn-xs tts-btn${TTS.isPlaying(msg.id) ? ' playing' : ''}`}
                    title={TTS.isPlaying(msg.id) ? t('chat.stopReading') : t('chat.readAloud')}
                    onClick={() => onTTS(msg.id, msg.content)}
                  >
                    {TTS.isPlaying(msg.id) ? '⏹' : '🔊'}
                  </button>
                  {onRegenerate && (
                    <button className="icon-btn btn-xs" title={t('chat.regenerate')} onClick={onRegenerate}>🔄</button>
                  )}
                </>
              )}
              {onPin && (
                <button className={`icon-btn btn-xs${msg.pinned ? ' pin-active' : ''}`} title={msg.pinned ? t('chat.unpinMessage') : t('chat.pinMessage')} onClick={() => onPin(msg.id)}>📌</button>
              )}
              {onFork && (
                <button className="icon-btn btn-xs" title={t('chat.forkConv')} onClick={() => onFork(msg.id)}>🔀</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ChatView({ config, onNewConv, loadConvId, contextEnabled, onToggleContext, onRegisterActions, onForkConv }: Props) {
  const { t } = useLocale()
  const { conv, messages, isLoading, isSearching, agentMode, setAgentMode, personaId, setPersonaId, error, currentModel, setCurrentModel, sendMessage, startNew, loadConv, stop, editAndResend, regenerate } = useChat(config)
  const [, setTTSRefresh] = useState(0)
  const [, setSTTRefresh] = useState(0)
  const [input, setInput] = useState('')
  const [attachment, setAttachment] = useState<{ name: string; base64: string } | null>(null)
  const [showPrompts, setShowPrompts] = useState(false)
  const [promptSearch, setPromptSearch] = useState('')
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [promptIdx, setPromptIdx] = useState(0)
  const [toast, setToast] = useState('')
  const [showExport, setShowExport] = useState(false)
  const [pageCtx, setPageCtx] = useState<PageContext | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [showSummary, setShowSummary] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [showPinned, setShowPinned] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (loadConvId) loadConv(loadConvId) }, [loadConvId, loadConv])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Register actions for keyboard shortcuts
  useEffect(() => {
    onRegisterActions?.({
      startNew: () => handleNew(),
      stop,
      focusInput: () => textareaRef.current?.focus(),
    })
  }, [onRegisterActions, stop]) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen page context changes
  useEffect(() => {
    const handler = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes['hchat:page-context']) {
        setPageCtx(changes['hchat:page-context'].newValue ?? null)
      }
    }
    chrome.storage.local.onChanged.addListener(handler)
    // Load initial
    chrome.storage.local.get('hchat:page-context', (r) => {
      if (r['hchat:page-context']) setPageCtx(r['hchat:page-context'])
    })
    return () => chrome.storage.local.onChanged.removeListener(handler)
  }, [])

  // TTS state change listener
  useEffect(() => {
    TTS.onStateChange(() => setTTSRefresh((n) => n + 1))
    return () => { TTS.stop(); TTS.onStateChange(() => {}) }
  }, [])

  // STT state change listener
  useEffect(() => {
    STT.onStateChange(() => setSTTRefresh((n) => n + 1))
    return () => { STT.stop(); STT.onStateChange(() => {}) }
  }, [])

  const handleTTS = useCallback((msgId: string, text: string) => {
    if (TTS.isPlaying(msgId)) {
      TTS.stop()
    } else {
      TTS.speak(text, msgId)
    }
  }, [])

  const handleSTT = useCallback(() => {
    if (STT.getState() === 'listening') {
      STT.stop()
    } else {
      STT.start((text, isFinal) => {
        if (isFinal) {
          setInput((prev) => prev + (prev ? ' ' : '') + text)
        }
      })
    }
  }, [])

  const handleEdit = useCallback((msgId: string, newContent: string) => {
    editAndResend(msgId, newContent)
  }, [editAndResend])

  const handleRegenerate = useCallback(() => {
    regenerate()
  }, [regenerate])

  // Load summary when conv changes
  useEffect(() => {
    if (conv?.id) {
      loadSummary(conv.id).then(setSummary)
    } else {
      setSummary(null)
    }
  }, [conv?.id])

  const handleSummarize = useCallback(async () => {
    if (!conv || summarizing) return
    setSummarizing(true)
    try {
      const text = await generateSummary(conv, config.aws, currentModel)
      const s: Summary = { convId: conv.id, text, createdAt: Date.now(), messageCount: conv.messages.length }
      await saveSummary(s)
      setSummary(s)
      setShowSummary(true)
    } catch (err) {
      showToast(t('chat.summaryFailed', { error: String(err) }))
    }
    setSummarizing(false)
  }, [conv, config.aws, currentModel, summarizing, t])

  const handleFork = useCallback(async (msgId: string) => {
    if (!conv) return
    const forked = await ChatHistory.fork(conv.id, msgId)
    if (forked) {
      showToast(t('chat.forked'))
      onForkConv?.(forked.id)
    }
  }, [conv, onForkConv, t])

  const handlePin = useCallback(async (msgId: string) => {
    if (!conv) return
    const pinned = await ChatHistory.toggleMessagePin(conv.id, msgId)
    // Reload to reflect pin state
    await loadConv(conv.id)
    showToast(pinned ? t('chat.pinned') : t('chat.unpinned'))
  }, [conv, loadConv, t])

  const pinnedMessages = messages.filter((m) => m.pinned)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 1800) }

  const copyMsg = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
    showToast(t('chat.copiedToast'))
  }, [t])

  // Prompt library search
  useEffect(() => {
    if (!showPrompts) return
    PromptLibrary.searchByShortcut(promptSearch).then(setPrompts)
  }, [showPrompts, promptSearch])

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    setInput(v)
    // Auto resize
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px'
    // Prompt popup trigger
    if (v.startsWith('/')) {
      setShowPrompts(true)
      setPromptSearch(v.slice(1))
      setPromptIdx(0)
    } else {
      setShowPrompts(false)
    }
  }

  const applyPrompt = (p: Prompt) => {
    setInput(p.content.replace('{{content}}', ''))
    setShowPrompts(false)
    PromptLibrary.incrementUsage(p.id)
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showPrompts) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setPromptIdx((i) => Math.min(i + 1, prompts.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setPromptIdx((i) => Math.max(i - 1, 0)) }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (prompts[promptIdx]) applyPrompt(prompts[promptIdx]); return }
      if (e.key === 'Escape') { setShowPrompts(false); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const needsPageContext = (text: string): boolean =>
    /이\s*페이지|현재\s*페이지|this\s*page|페이지\s*(요약|번역|설명|분석|정리)|웹\s*페이지/i.test(text)

  const buildPageContextPrompt = async (): Promise<string | undefined> => {
    try {
      const page = await getCurrentPageContent()
      if (page.text && page.text.length > 20) {
        return buildPageSystemPrompt({
          url: page.url,
          title: page.title,
          text: page.text,
          ts: Date.now(),
        })
      }
    } catch { /* content script not available or no active tab */ }
    return undefined
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    setAttachment(null)
    setShowPrompts(false)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    // Build page context system prompt if enabled or if message references the page
    let systemPrompt: string | undefined
    if (contextEnabled || needsPageContext(text)) {
      systemPrompt = await buildPageContextPrompt()
    }

    await sendMessage(text, { imageBase64: attachment?.base64, systemPrompt })
  }

  const handleExport = async (format: ExportFormat) => {
    if (!conv) return
    const blob = exportConversation({ format, conversation: conv, includeTimestamps: true, includeModelInfo: true })
    const ext = { markdown: 'md', html: 'html', json: 'json', txt: 'txt' }[format]
    const safeName = conv.title.replace(/[^a-zA-Z0-9가-힣_-]/g, '_').slice(0, 40)
    downloadBlob(blob, `${safeName}.${ext}`)
    setShowExport(false)
    showToast(t('chat.exportDone'))
  }

  const handleCopyConv = async () => {
    if (!conv) return
    await copyConversationAsMarkdown(conv)
    setShowExport(false)
    showToast(t('common.copiedClipboard'))
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const b64 = await fileToBase64(file)
    setAttachment({ name: file.name, base64: b64 })
    e.target.value = ''
  }

  const handleNew = async () => {
    await startNew()
    setInput('')
    setAttachment(null)
    onNewConv?.()
  }

  const SUGGESTIONS = [
    { icon: '📄', text: t('chat.suggestions.summarize') },
    { icon: '✏️', text: t('chat.suggestions.email') },
    { icon: '💡', text: t('chat.suggestions.brainstorm') },
    { icon: '🌐', text: t('chat.suggestions.translate') },
  ]

  return (
    <div className="chat-wrap">
      {/* Toolbar */}
      <div className="chat-toolbar">
        <span className="conv-title">{conv?.title ?? t('chat.newConv')}</span>
        {contextEnabled && pageCtx && (
          <span className="badge badge-green" title={pageCtx.url} style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={onToggleContext}>
            📄 {pageCtx.title?.slice(0, 20) || 'Page'}
          </span>
        )}
        {!contextEnabled && (
          <button className="icon-btn btn-xs" title={t('chat.contextOn')} onClick={onToggleContext} style={{ opacity: 0.5 }}>📄</button>
        )}
        <div style={{ position: 'relative' }}>
          <button className="icon-btn" title={t('chat.exportTitle')} onClick={() => setShowExport(!showExport)} disabled={!conv || messages.length === 0}>📤</button>
          {showExport && conv && (
            <div className="export-menu">
              <button className="export-item" onClick={() => handleExport('markdown')}>📝 Markdown</button>
              <button className="export-item" onClick={() => handleExport('html')}>🌐 HTML</button>
              <button className="export-item" onClick={() => handleExport('json')}>📦 JSON</button>
              <button className="export-item" onClick={() => handleExport('txt')}>📄 {t('chat.exportText')}</button>
              <div className="export-divider" />
              <button className="export-item" onClick={handleCopyConv}>📋 {t('chat.exportCopy')}</button>
            </div>
          )}
        </div>
        {conv && messages.length > 2 && (
          <button
            className={`icon-btn${summarizing ? ' spinning' : ''}`}
            title={summary ? t('chat.summaryView') : t('chat.summaryGenerate')}
            onClick={summary ? () => setShowSummary(!showSummary) : handleSummarize}
            disabled={summarizing}
          >
            {summarizing ? '⏳' : '📋'}
          </button>
        )}
        {pinnedMessages.length > 0 && (
          <button
            className={`icon-btn${showPinned ? ' pin-active' : ''}`}
            title={t('chat.pinnedMessages', { n: pinnedMessages.length })}
            onClick={() => setShowPinned(!showPinned)}
          >
            📌
          </button>
        )}
        <button className="icon-btn" title={t('chat.newChat')} onClick={handleNew}>✏️</button>
      </div>

      {/* Summary panel */}
      {showSummary && summary && (
        <div className="summary-panel">
          <div className="summary-header">
            <span className="summary-title">{t('chat.summaryTitle')}</span>
            <span className="summary-meta">{t('chat.summaryMeta', { n: summary.messageCount })}</span>
            <button className="icon-btn btn-xs" onClick={() => setShowSummary(false)}>✕</button>
          </div>
          <div className="summary-body">{summary.text}</div>
          <div className="summary-footer">
            <button className="btn btn-ghost btn-xs" onClick={handleSummarize}>
              {summarizing ? t('chat.summaryGenerating') : t('chat.summaryRegenerate')}
            </button>
          </div>
        </div>
      )}

      {/* Pinned messages panel */}
      {showPinned && pinnedMessages.length > 0 && (
        <div className="pinned-panel">
          <div className="pinned-header">
            <span>{t('chat.pinnedMessages', { n: pinnedMessages.length })}</span>
            <button className="icon-btn btn-xs" onClick={() => setShowPinned(false)}>✕</button>
          </div>
          {pinnedMessages.map((m) => (
            <div key={m.id} className="pinned-item">
              <span className="pinned-role">{m.role === 'user' ? t('common.me') : 'AI'}</span>
              <span className="pinned-text">{m.content.slice(0, 120)}{m.content.length > 120 ? '...' : ''}</span>
              <button className="icon-btn btn-xs" title={t('chat.unpinMessage')} onClick={() => handlePin(m.id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-logo">H</div>
            <h2>{t('welcome.title')}</h2>
            <p>{t('welcome.chatSubtitle')}</p>
            <div className="suggestions-grid">
              {SUGGESTIONS.map((s) => (
                <button key={s.text} className="suggestion-card" onClick={async () => {
                  const systemPrompt = needsPageContext(s.text) ? await buildPageContextPrompt() : undefined
                  sendMessage(s.text, { systemPrompt })
                }}>
                  <span className="s-icon">{s.icon}</span>
                  <span className="s-text">{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => <MsgBubble key={m.id} msg={m} onCopy={copyMsg} onTTS={handleTTS} onEdit={handleEdit} onRegenerate={handleRegenerate} onFork={handleFork} onPin={handlePin} />)
        )}
        {isSearching && (
          <div className="search-indicator">
            <span className="spinner-sm" />
            <span>{t('chat.searchingWeb')}</span>
          </div>
        )}
        {error && !isLoading && (
          <div style={{ color: 'var(--red)', fontSize: 11, padding: '4px 12px' }}>⚠ {error}</div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input area */}
      <div className="input-area">
        {attachment && (
          <div className="input-attachments">
            <div className="attachment-chip">
              <span>📎</span>
              <span>{attachment.name}</span>
              <button className="icon-btn btn-xs" onClick={() => setAttachment(null)}>✕</button>
            </div>
          </div>
        )}

        {/* Prompt popup */}
        {showPrompts && prompts.length > 0 && (
          <div className="prompt-popup">
            {prompts.slice(0, 8).map((p, i) => (
              <div
                key={p.id}
                className={`prompt-popup-item ${i === promptIdx ? 'selected' : ''}`}
                onClick={() => applyPrompt(p)}
              >
                <span className="shortcut">/{p.shortcut}</span>
                <span className="ptitle">{p.title}</span>
                <span className="pcat">{p.category}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ position: 'relative' }}>
          <div className="input-row">
            <textarea
              ref={textareaRef}
              className="chat-textarea"
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={agentMode ? t('chat.agentPlaceholder') : t('chat.placeholder')}
              rows={1}
            />
            <div className="input-actions">
              <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFile} />
              <button
                className={`icon-btn agent-toggle${agentMode ? ' active' : ''}`}
                title={agentMode ? t('chat.agentModeOff') : t('chat.agentModeOn')}
                onClick={() => setAgentMode(!agentMode)}
              >🤖</button>
              {STT.isSupported() && (
                <button
                  className={`icon-btn stt-btn${STT.getState() === 'listening' ? ' listening' : ''}`}
                  title={STT.getState() === 'listening' ? t('chat.voiceInputStop') : t('chat.voiceInput')}
                  onClick={handleSTT}
                >🎤</button>
              )}
              <button className="icon-btn" title={t('chat.fileAttach')} onClick={() => fileRef.current?.click()}>📎</button>
              {isLoading ? (
                <button className="send-btn stop" onClick={stop} title={t('chat.stopBtn')}>⏹</button>
              ) : (
                <button className="send-btn" onClick={handleSend} disabled={!input.trim()}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="input-meta">
          <ModelSelector value={currentModel} onChange={setCurrentModel} config={config} />
          <PersonaSelector value={personaId} onChange={setPersonaId} />
          {agentMode && <span className="agent-badge">🤖 {t('chat.agentMode')}</span>}
          <span className="text-xs">{t('chat.promptHint')}</span>
        </div>
      </div>

      {toast && <div className="copy-toast">{toast}</div>}
    </div>
  )
}
