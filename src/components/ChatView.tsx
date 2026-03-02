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
import { MsgBubble } from './chat/MsgBubble'
import { ChatToolbar } from './chat/ChatToolbar'
import { ChatInputArea } from './chat/ChatInputArea'
import { SummaryPanel } from './chat/SummaryPanel'
import { PinnedPanel } from './chat/PinnedPanel'
import type { Config } from '../hooks/useConfig'

interface Props {
  config: Config
  onNewConv?: () => void
  loadConvId?: string
  contextEnabled?: boolean
  onToggleContext?: () => void
  onRegisterActions?: (actions: { startNew: () => void; stop: () => void; focusInput: () => void }) => void
  onForkConv?: (newConvId: string) => void
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

  useEffect(() => {
    onRegisterActions?.({
      startNew: () => handleNew(),
      stop,
      focusInput: () => textareaRef.current?.focus(),
    })
  }, [onRegisterActions, stop]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes['hchat:page-context']) {
        setPageCtx(changes['hchat:page-context'].newValue ?? null)
      }
    }
    chrome.storage.local.onChanged.addListener(handler)
    chrome.storage.local.get('hchat:page-context', (r) => {
      if (r['hchat:page-context']) setPageCtx(r['hchat:page-context'])
    })
    return () => chrome.storage.local.onChanged.removeListener(handler)
  }, [])

  useEffect(() => {
    TTS.onStateChange(() => setTTSRefresh((n) => n + 1))
    return () => { TTS.stop(); TTS.onStateChange(() => {}) }
  }, [])

  useEffect(() => {
    STT.onStateChange(() => setSTTRefresh((n) => n + 1))
    return () => { STT.stop(); STT.onStateChange(() => {}) }
  }, [])

  const handleTTS = useCallback((msgId: string, text: string) => {
    if (TTS.isPlaying(msgId)) TTS.stop()
    else TTS.speak(text, msgId)
  }, [])

  const handleSTT = useCallback(() => {
    if (STT.getState() === 'listening') {
      STT.stop()
    } else {
      STT.start((text, isFinal) => {
        if (isFinal) setInput((prev) => prev + (prev ? ' ' : '') + text)
      })
    }
  }, [])

  const handleEdit = useCallback((msgId: string, newContent: string) => {
    editAndResend(msgId, newContent)
  }, [editAndResend])

  const handleRegenerate = useCallback(() => { regenerate() }, [regenerate])

  useEffect(() => {
    if (conv?.id) loadSummary(conv.id).then(setSummary)
    else setSummary(null)
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
    if (forked) { showToast(t('chat.forked')); onForkConv?.(forked.id) }
  }, [conv, onForkConv, t])

  const handlePin = useCallback(async (msgId: string) => {
    if (!conv) return
    const pinned = await ChatHistory.toggleMessagePin(conv.id, msgId)
    await loadConv(conv.id)
    showToast(pinned ? t('chat.pinned') : t('chat.unpinned'))
  }, [conv, loadConv, t])

  const pinnedMessages = messages.filter((m) => m.pinned)
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 1800) }

  const copyMsg = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
    showToast(t('chat.copiedToast'))
  }, [t])

  useEffect(() => {
    if (!showPrompts) return
    PromptLibrary.searchByShortcut(promptSearch).then(setPrompts)
  }, [showPrompts, promptSearch])

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    setInput(v)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px'
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
        return buildPageSystemPrompt({ url: page.url, title: page.title, text: page.text, ts: Date.now() })
      }
    } catch { /* content script not available */ }
    return undefined
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    setAttachment(null)
    setShowPrompts(false)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    let systemPrompt: string | undefined
    if (contextEnabled || needsPageContext(text)) systemPrompt = await buildPageContextPrompt()
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
      <ChatToolbar
        convTitle={conv?.title}
        contextEnabled={contextEnabled}
        pageCtx={pageCtx}
        onToggleContext={onToggleContext}
        showExport={showExport}
        onToggleExport={() => setShowExport(!showExport)}
        hasMessages={messages.length > 0}
        hasConv={!!conv}
        onExport={handleExport}
        onCopyConv={handleCopyConv}
        canSummarize={!!conv && messages.length > 2}
        summarizing={summarizing}
        summary={summary}
        onToggleSummary={() => setShowSummary(!showSummary)}
        onSummarize={handleSummarize}
        pinnedCount={pinnedMessages.length}
        showPinned={showPinned}
        onTogglePinned={() => setShowPinned(!showPinned)}
        onNew={handleNew}
      />

      {showSummary && summary && (
        <SummaryPanel
          summary={summary}
          summarizing={summarizing}
          onClose={() => setShowSummary(false)}
          onRegenerate={handleSummarize}
        />
      )}

      {showPinned && pinnedMessages.length > 0 && (
        <PinnedPanel
          messages={pinnedMessages}
          onClose={() => setShowPinned(false)}
          onUnpin={handlePin}
        />
      )}

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

      <ChatInputArea
        input={input}
        onInputChange={handleInput}
        onKeyDown={handleKeyDown}
        onSend={handleSend}
        onStop={stop}
        isLoading={isLoading}
        agentMode={agentMode}
        onToggleAgent={() => setAgentMode(!agentMode)}
        onSTT={handleSTT}
        attachment={attachment}
        onRemoveAttachment={() => setAttachment(null)}
        onFileSelect={handleFile}
        showPrompts={showPrompts}
        prompts={prompts}
        promptIdx={promptIdx}
        onApplyPrompt={applyPrompt}
        textareaRef={textareaRef}
        fileRef={fileRef}
      />

      <div className="input-meta">
        <ModelSelector value={currentModel} onChange={setCurrentModel} config={config} />
        <PersonaSelector value={personaId} onChange={setPersonaId} />
        {agentMode && <span className="agent-badge">🤖 {t('chat.agentMode')}</span>}
        <span className="text-xs">{t('chat.promptHint')}</span>
      </div>

      {toast && <div className="copy-toast">{toast}</div>}
    </div>
  )
}
