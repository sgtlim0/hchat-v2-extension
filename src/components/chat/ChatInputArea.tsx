import { useState, useEffect } from 'react'
import { useLocale } from '../../i18n'
import { STT } from '../../lib/stt'
import { VoiceWaveform } from './VoiceWaveform'
import { detectIntent, type DetectedIntent } from '../../lib/intentRouter'
import type { Prompt } from '../../lib/promptLibrary'
import type { PIIDetection } from '../../lib/guardrail'

const INTENT_ICONS: Record<string, string> = {
  translate: '🌐', analyze: '📊', write: '✍️', ocr: '📷',
  search: '🔍', code: '💻', debate: '⚔️', generate: '🎨',
}

interface ChatInputAreaProps {
  input: string
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onSend: () => void
  onStop: () => void
  isLoading: boolean
  agentMode: boolean
  onToggleAgent: () => void
  onSTT: () => void
  voiceMode?: boolean
  onToggleVoiceMode?: () => void
  attachment: { name: string; base64: string } | null
  onRemoveAttachment: () => void
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  showPrompts: boolean
  prompts: Prompt[]
  promptIdx: number
  onApplyPrompt: (p: Prompt) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  fileRef: React.RefObject<HTMLInputElement | null>
  piiDetections?: PIIDetection[]
  onConfirmPII?: (action: 'send' | 'mask' | 'cancel') => void
  onToggleTemplates?: () => void
  onApplyIntent?: (intent: DetectedIntent) => void
}

export function ChatInputArea({
  input,
  onInputChange,
  onKeyDown,
  onSend,
  onStop,
  isLoading,
  agentMode,
  onToggleAgent,
  onSTT,
  voiceMode,
  onToggleVoiceMode,
  attachment,
  onRemoveAttachment,
  onFileSelect,
  showPrompts,
  prompts,
  promptIdx,
  onApplyPrompt,
  textareaRef,
  fileRef,
  piiDetections = [],
  onConfirmPII,
  onToggleTemplates,
  onApplyIntent,
}: ChatInputAreaProps) {
  const { t } = useLocale()

  const [detectedIntent, setDetectedIntent] = useState<DetectedIntent | null>(null)

  useEffect(() => {
    if (!input || input.length < 5 || input.startsWith('/')) {
      setDetectedIntent(null)
      return
    }
    const timer = setTimeout(() => {
      const intent = detectIntent(input)
      setDetectedIntent(intent.type !== 'general' ? intent : null)
    }, 300)
    return () => clearTimeout(timer)
  }, [input])

  const isListening = STT.getState() === 'listening'

  const piiTypeLabels: Record<string, string> = {
    email: t('guardrailEmail'),
    phone: t('guardrailPhone'),
    ssn: t('guardrailSsn'),
    card: t('guardrailCard'),
    bank: t('guardrailBank'),
  }

  return (
    <div className={`input-area${voiceMode ? ' voice-mode-active' : ''}`}>
      {piiDetections.length > 0 && onConfirmPII && (
        <div className="pii-warning-banner">
          <div className="pii-warning-header">
            <span className="pii-warning-icon">⚠️</span>
            <span className="pii-warning-title">{t('guardrailWarning')}</span>
          </div>
          <div className="pii-warning-detections">
            {piiDetections.map((detection, idx) => (
              <div key={idx} className="pii-detection-item">
                <span className="pii-type">{piiTypeLabels[detection.type]}</span>
                <span className="pii-value">{detection.masked}</span>
              </div>
            ))}
          </div>
          <div className="pii-warning-message">
            {t('guardrailDetected', { count: piiDetections.length })}
          </div>
          <div className="pii-warning-actions">
            <button className="btn btn-sm btn-warning" onClick={() => onConfirmPII('mask')}>
              {t('guardrailSendMasked')}
            </button>
            <button className="btn btn-sm btn-secondary" onClick={() => onConfirmPII('send')}>
              {t('guardrailSendAsIs')}
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => onConfirmPII('cancel')}>
              {t('guardrailCancel')}
            </button>
          </div>
        </div>
      )}

      {voiceMode && (
        <div className="voice-mode-indicator">
          <div className="voice-mode-pulse">🎙️</div>
          <VoiceWaveform isListening={isListening} />
          <span className="voice-mode-text">{t('chat.voiceModeActive')}</span>
        </div>
      )}

      {attachment && (
        <div className="input-attachments">
          <div className="attachment-chip">
            <span>📎</span>
            <span>{attachment.name}</span>
            <button className="icon-btn btn-xs" onClick={onRemoveAttachment}>✕</button>
          </div>
        </div>
      )}

      {showPrompts && prompts.length > 0 && (
        <div className="prompt-popup">
          {prompts.slice(0, 8).map((p, i) => (
            <div
              key={p.id}
              className={`prompt-popup-item ${i === promptIdx ? 'selected' : ''}`}
              onClick={() => onApplyPrompt(p)}
            >
              <span className="shortcut">/{p.shortcut}</span>
              <span className="ptitle">{p.title}</span>
              <span className="pcat">{p.category}</span>
            </div>
          ))}
        </div>
      )}

      {detectedIntent && (
        <div className="intent-chip-bar" role="status" aria-label={t('intentSuggestion')}>
          <span className="intent-chip" onClick={() => onApplyIntent?.(detectedIntent)}>
            <span className="intent-chip-icon">{INTENT_ICONS[detectedIntent.type]}</span>
            <span className="intent-chip-label">{t(`intent.${detectedIntent.type}` as never)}</span>
            {detectedIntent.suggestedTool && (
              <span className="intent-chip-tool">→ {detectedIntent.suggestedTool}</span>
            )}
          </span>
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <div className="input-row">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            value={input}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
            placeholder={agentMode ? t('chat.agentPlaceholder') : t('chat.placeholder')}
            rows={1}
            disabled={voiceMode}
            aria-label={t('aria.chatInput')}
          />
          <div className="input-actions">
            <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={onFileSelect} />
            <button
              className={`icon-btn agent-toggle${agentMode ? ' active' : ''}`}
              title={agentMode ? t('chat.agentModeOff') : t('chat.agentModeOn')}
              onClick={onToggleAgent}
            >🤖</button>
            {STT.isSupported() && !voiceMode && (
              <button
                className={`icon-btn stt-btn${STT.getState() === 'listening' ? ' listening' : ''}`}
                title={STT.getState() === 'listening' ? t('chat.voiceInputStop') : t('chat.voiceInput')}
                aria-label={t('aria.voiceButton')}
                onClick={onSTT}
              >🎤</button>
            )}
            {STT.isSupported() && onToggleVoiceMode && (
              <button
                className={`icon-btn voice-mode-btn${voiceMode ? ' active' : ''}`}
                title={voiceMode ? t('chat.voiceModeOff') : t('chat.voiceModeOn')}
                onClick={onToggleVoiceMode}
              >🎙️</button>
            )}
            {onToggleTemplates && (
              <button
                className="icon-btn"
                title={t('chatTemplate')}
                onClick={onToggleTemplates}
              >📋</button>
            )}
            <button className="icon-btn" title={t('chat.fileAttach')} onClick={() => fileRef.current?.click()}>📎</button>
            {isLoading ? (
              <button className="send-btn stop" onClick={onStop} title={t('chat.stopBtn')}>⏹</button>
            ) : (
              <button className="send-btn" onClick={onSend} disabled={!input.trim()} aria-label={t('aria.sendButton')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
