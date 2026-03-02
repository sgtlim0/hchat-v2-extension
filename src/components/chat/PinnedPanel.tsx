import { useLocale } from '../../i18n'
import type { ChatMessage } from '../../lib/chatHistory'

interface PinnedPanelProps {
  messages: ChatMessage[]
  onClose: () => void
  onUnpin: (msgId: string) => void
}

export function PinnedPanel({ messages, onClose, onUnpin }: PinnedPanelProps) {
  const { t } = useLocale()

  return (
    <div className="pinned-panel">
      <div className="pinned-header">
        <span>{t('chat.pinnedMessages', { n: messages.length })}</span>
        <button className="icon-btn btn-xs" onClick={onClose}>✕</button>
      </div>
      {messages.map((m) => (
        <div key={m.id} className="pinned-item">
          <span className="pinned-role">{m.role === 'user' ? t('common.me') : 'AI'}</span>
          <span className="pinned-text">{m.content.slice(0, 120)}{m.content.length > 120 ? '...' : ''}</span>
          <button className="icon-btn btn-xs" title={t('chat.unpinMessage')} onClick={() => onUnpin(m.id)}>✕</button>
        </div>
      ))}
    </div>
  )
}
