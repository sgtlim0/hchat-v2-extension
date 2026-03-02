import { useState, useRef, useEffect } from 'react'
import { useLocale } from '../../i18n'
import { TTS } from '../../lib/tts'
import { MD } from './MarkdownRenderer'
import { AgentStepsView } from './AgentStepsView'
import { SearchSources } from './SearchSources'
import type { ChatMessage } from '../../lib/chatHistory'

export interface MsgBubbleProps {
  msg: ChatMessage
  onCopy: (t: string) => void
  onTTS: (msgId: string, text: string) => void
  onEdit?: (msgId: string, newContent: string) => void
  onRegenerate?: () => void
  onFork?: (msgId: string) => void
  onPin?: (msgId: string) => void
}

export function MsgBubble({ msg, onCopy, onTTS, onEdit, onRegenerate, onFork, onPin }: MsgBubbleProps) {
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
