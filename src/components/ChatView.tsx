import { useState, useRef, useEffect, useCallback } from 'react'
import { useChat } from '../hooks/useChat'
import { useLocale } from '../i18n'
import { useChatVoice } from '../hooks/useChatVoice'
import { useChatPrompts } from '../hooks/useChatPrompts'
import { useDeepResearch } from '../hooks/useDeepResearch'
import { fileToBase64, getCurrentPageContent } from '../lib/pageReader'
import { exportConversation, downloadBlob, copyConversationAsMarkdown, type ExportFormat } from '../lib/exportChat'
import { generateSummary, saveSummary, loadSummary, type Summary } from '../lib/summarize'
import { ChatHistory } from '../lib/chatHistory'
import { type PageContext, buildPageSystemPrompt } from '../lib/pageContext'
import { ChatToolbar } from './chat/ChatToolbar'
import { ChatInputArea } from './chat/ChatInputArea'
import { SummaryPanel } from './chat/SummaryPanel'
import { PinnedPanel } from './chat/PinnedPanel'
import { UsageAlertBanner } from './chat/UsageAlertBanner'
import { ChatMessages } from './chat/ChatMessages'
import { ChatMetaBar } from './chat/ChatMetaBar'
import { checkAndNotify, type UsageAlertState } from '../lib/usageAlert'
import type { Config } from '../hooks/useConfig'
import type { ThinkingDepth } from '../lib/providers/types'
import { SK } from '../lib/storageKeys'

interface Props {
  config: Config
  onNewConv?: () => void
  loadConvId?: string
  contextEnabled?: boolean
  onToggleContext?: () => void
  initialPrompt?: string
  onConsumePrompt?: () => void
  onRegisterActions?: (actions: { startNew: () => void; stop: () => void; focusInput: () => void }) => void
  onForkConv?: (newConvId: string) => void
}

export function ChatView({ config, onNewConv, loadConvId, contextEnabled, onToggleContext, initialPrompt, onConsumePrompt, onRegisterActions, onForkConv }: Props) {
  const { t, locale } = useLocale()
  const { conv, messages, isLoading, isSearching, agentMode, setAgentMode, assistantId, setAssistantId, error, currentModel, setCurrentModel, sendMessage, startNew, loadConv, stop, editAndResend, regenerate, piiDetections, confirmSendWithPII } = useChat(config)

  const [thinkingDepth, setThinkingDepth] = useState<ThinkingDepth>('normal')
  const [input, setInput] = useState('')
  const [attachment, setAttachment] = useState<{ name: string; base64: string } | null>(null)
  const [toast, setToast] = useState('')
  const [showExport, setShowExport] = useState(false)
  const [pageCtx, setPageCtx] = useState<PageContext | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [showSummary, setShowSummary] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [showPinned, setShowPinned] = useState(false)
  const [usageAlert, setUsageAlert] = useState<UsageAlertState | null>(null)
  const [alertDismissed, setAlertDismissed] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 1800) }

  const { voiceMode, toggleVoiceMode, handleTTS, handleSTT } = useChatVoice(sendMessage, isLoading, messages, setInput, input, textareaRef)
  const { showPrompts, setShowPrompts, prompts, promptIdx, applyPrompt, handlePromptInput, handlePromptKeyDown } = useChatPrompts(setInput, textareaRef)
  const { deepResearch, setDeepResearch, researchProgress, researchSources, researchReport, handleDeepResearch } = useDeepResearch(config, currentModel, sendMessage, showToast, t, locale)

  useEffect(() => { if (loadConvId) loadConv(loadConvId) }, [loadConvId, loadConv])

  useEffect(() => {
    onRegisterActions?.({
      startNew: () => handleNew(),
      stop,
      focusInput: () => textareaRef.current?.focus(),
    })
  }, [onRegisterActions, stop]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes[SK.PAGE_CONTEXT]) setPageCtx(changes[SK.PAGE_CONTEXT].newValue ?? null)
    }
    chrome.storage.local.onChanged.addListener(handler)
    chrome.storage.local.get(SK.PAGE_CONTEXT, (r) => {
      if (r[SK.PAGE_CONTEXT]) setPageCtx(r[SK.PAGE_CONTEXT])
    })
    return () => chrome.storage.local.onChanged.removeListener(handler)
  }, [])

  useEffect(() => {
    if (config.budget.monthly > 0) {
      checkAndNotify(config.budget).then(setUsageAlert)
    }
  }, [config.budget, isLoading])

  useEffect(() => {
    if (initialPrompt) {
      setInput(initialPrompt.replace('{{content}}', ''))
      textareaRef.current?.focus()
      onConsumePrompt?.()
    }
  }, [initialPrompt]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (conv?.id) loadSummary(conv.id).then(setSummary)
    else setSummary(null)
  }, [conv?.id])

  const handleEdit = useCallback((msgId: string, newContent: string) => { editAndResend(msgId, newContent) }, [editAndResend])
  const handleRegenerate = useCallback(() => { regenerate() }, [regenerate])

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

  const copyMsg = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
    showToast(t('chat.copiedToast'))
  }, [t])

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    setInput(v)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px'
    handlePromptInput(v)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (handlePromptKeyDown(e)) return
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
    if (deepResearch) {
      await handleDeepResearch(text)
      return
    }
    let systemPrompt: string | undefined
    if (contextEnabled || needsPageContext(text)) systemPrompt = await buildPageContextPrompt()
    await sendMessage(text, { imageBase64: attachment?.base64, systemPrompt, thinkingDepth })
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

  const handleSuggestionClick = async (text: string) => {
    const systemPrompt = needsPageContext(text) ? await buildPageContextPrompt() : undefined
    sendMessage(text, { systemPrompt })
  }

  const SUGGESTIONS = [
    { icon: '📄', text: t('chat.suggestions.summarize') },
    { icon: '✏️', text: t('chat.suggestions.email') },
    { icon: '💡', text: t('chat.suggestions.brainstorm') },
    { icon: '🌐', text: t('chat.suggestions.translate') },
  ]

  return (
    <div className="chat-wrap" role="main">
      <ChatToolbar
        convTitle={conv?.title} contextEnabled={contextEnabled} pageCtx={pageCtx}
        onToggleContext={onToggleContext} showExport={showExport}
        onToggleExport={() => setShowExport(!showExport)} hasMessages={messages.length > 0}
        hasConv={!!conv} onExport={handleExport} onCopyConv={handleCopyConv}
        canSummarize={!!conv && messages.length > 2} summarizing={summarizing} summary={summary}
        onToggleSummary={() => setShowSummary(!showSummary)} onSummarize={handleSummarize}
        pinnedCount={pinnedMessages.length} showPinned={showPinned}
        onTogglePinned={() => setShowPinned(!showPinned)} onNew={handleNew}
      />

      {showSummary && summary && (
        <SummaryPanel summary={summary} summarizing={summarizing} onClose={() => setShowSummary(false)} onRegenerate={handleSummarize} />
      )}

      {showPinned && pinnedMessages.length > 0 && (
        <PinnedPanel messages={pinnedMessages} onClose={() => setShowPinned(false)} onUnpin={handlePin} />
      )}

      {usageAlert && usageAlert.level !== 'none' && !alertDismissed && (
        <UsageAlertBanner alert={usageAlert} onDismiss={() => setAlertDismissed(true)} />
      )}

      <ChatMessages
        messages={messages} convId={conv?.id} isSearching={isSearching}
        error={error} isLoading={isLoading} onCopy={copyMsg} onTTS={handleTTS}
        onEdit={handleEdit} onRegenerate={handleRegenerate} onFork={handleFork}
        onPin={handlePin} onSuggestionClick={handleSuggestionClick} suggestions={SUGGESTIONS} t={t}
      />

      <ChatInputArea
        input={input} onInputChange={handleInput} onKeyDown={handleKeyDown}
        onSend={handleSend} onStop={stop} isLoading={isLoading} agentMode={agentMode}
        onToggleAgent={() => setAgentMode(!agentMode)} onSTT={handleSTT}
        voiceMode={voiceMode} onToggleVoiceMode={toggleVoiceMode}
        attachment={attachment} onRemoveAttachment={() => setAttachment(null)}
        onFileSelect={handleFile} showPrompts={showPrompts} prompts={prompts}
        promptIdx={promptIdx} onApplyPrompt={applyPrompt} textareaRef={textareaRef}
        fileRef={fileRef} piiDetections={piiDetections} onConfirmPII={confirmSendWithPII}
      />

      <ChatMetaBar
        currentModel={currentModel} onModelChange={setCurrentModel} config={config}
        thinkingDepth={thinkingDepth} onThinkingDepthChange={setThinkingDepth}
        assistantId={assistantId} onAssistantChange={setAssistantId}
        deepResearch={deepResearch} onToggleDeepResearch={() => setDeepResearch(!deepResearch)}
        researchProgress={researchProgress} researchSources={researchSources}
        streamingReport={researchReport} agentMode={agentMode} voiceMode={voiceMode} t={t}
      />

      {toast && <div className="copy-toast" role="status" aria-live="polite">{toast}</div>}
    </div>
  )
}
