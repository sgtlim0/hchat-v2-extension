import { useRef, useEffect, useState } from 'react'
import { List, useDynamicRowHeight, type ListImperativeAPI } from 'react-window'
import { MsgBubble } from './MsgBubble'
import type { ChatMessage } from '../../lib/chatHistory'

interface Props {
  messages: ChatMessage[]
  convId?: string
  isSearching: boolean
  error: string
  isLoading: boolean
  onCopy: (text: string) => void
  onTTS: (msgId: string, text: string) => void
  onEdit: (msgId: string, newContent: string) => void
  onRegenerate: () => void
  onFork: (msgId: string) => void
  onPin: (msgId: string) => void
  onSuggestionClick: (text: string) => void
  suggestions: { icon: string; text: string }[]
  t: (key: string) => string
}

export function ChatMessages({
  messages, convId, isSearching, error, isLoading,
  onCopy, onTTS, onEdit, onRegenerate, onFork, onPin,
  onSuggestionClick, suggestions, t,
}: Props) {
  const endRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<ListImperativeAPI | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = useState(600)

  const dynamicRowHeight = useDynamicRowHeight({
    defaultRowHeight: 150,
    key: convId || 'default',
  })

  useEffect(() => {
    if (containerRef.current) {
      const updateHeight = () => {
        if (containerRef.current) setContainerHeight(containerRef.current.clientHeight)
      }
      updateHeight()
      window.addEventListener('resize', updateHeight)
      return () => window.removeEventListener('resize', updateHeight)
    }
  }, [])

  useEffect(() => {
    if (messages.length > 50 && listRef.current) {
      listRef.current.scrollToRow(messages.length - 1, 'end')
    } else {
      endRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  return (
    <div className="messages" ref={containerRef} role="log" aria-live="polite" aria-relevant="additions">
      {messages.length === 0 ? (
        <div className="chat-empty">
          <div className="chat-empty-logo">H</div>
          <h2>{t('welcome.title')}</h2>
          <p>{t('welcome.chatSubtitle')}</p>
          <div className="suggestions-grid">
            {suggestions.map((s) => (
              <button key={s.text} className="suggestion-card" onClick={() => onSuggestionClick(s.text)}>
                <span className="s-icon">{s.icon}</span>
                <span className="s-text">{s.text}</span>
              </button>
            ))}
          </div>
        </div>
      ) : messages.length > 50 ? (
        <List
          listRef={listRef}
          defaultHeight={containerHeight}
          rowCount={messages.length}
          rowHeight={dynamicRowHeight}
          overscanCount={5}
          rowComponent={({ index, ...props }) => (
            <MsgBubble
              key={messages[index].id}
              msg={messages[index]}
              onCopy={onCopy}
              onTTS={onTTS}
              onEdit={onEdit}
              onRegenerate={onRegenerate}
              onFork={onFork}
              onPin={onPin}
              {...props}
            />
          )}
          rowProps={{}}
        />
      ) : (
        messages.map((m) => <MsgBubble key={m.id} msg={m} onCopy={onCopy} onTTS={onTTS} onEdit={onEdit} onRegenerate={onRegenerate} onFork={onFork} onPin={onPin} />)
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
  )
}
