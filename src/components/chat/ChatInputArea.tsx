import { useLocale } from '../../i18n'
import { STT } from '../../lib/stt'
import type { Prompt } from '../../lib/promptLibrary'

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
  attachment: { name: string; base64: string } | null
  onRemoveAttachment: () => void
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  showPrompts: boolean
  prompts: Prompt[]
  promptIdx: number
  onApplyPrompt: (p: Prompt) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  fileRef: React.RefObject<HTMLInputElement | null>
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
  attachment,
  onRemoveAttachment,
  onFileSelect,
  showPrompts,
  prompts,
  promptIdx,
  onApplyPrompt,
  textareaRef,
  fileRef,
}: ChatInputAreaProps) {
  const { t } = useLocale()

  return (
    <div className="input-area">
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
          />
          <div className="input-actions">
            <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={onFileSelect} />
            <button
              className={`icon-btn agent-toggle${agentMode ? ' active' : ''}`}
              title={agentMode ? t('chat.agentModeOff') : t('chat.agentModeOn')}
              onClick={onToggleAgent}
            >🤖</button>
            {STT.isSupported() && (
              <button
                className={`icon-btn stt-btn${STT.getState() === 'listening' ? ' listening' : ''}`}
                title={STT.getState() === 'listening' ? t('chat.voiceInputStop') : t('chat.voiceInput')}
                onClick={onSTT}
              >🎤</button>
            )}
            <button className="icon-btn" title={t('chat.fileAttach')} onClick={() => fileRef.current?.click()}>📎</button>
            {isLoading ? (
              <button className="send-btn stop" onClick={onStop} title={t('chat.stopBtn')}>⏹</button>
            ) : (
              <button className="send-btn" onClick={onSend} disabled={!input.trim()}>
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
