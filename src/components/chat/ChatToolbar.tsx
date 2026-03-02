import { useLocale } from '../../i18n'
import type { PageContext } from '../../lib/pageContext'
import type { Summary } from '../../lib/summarize'
import type { ExportFormat } from '../../lib/exportChat'

interface ChatToolbarProps {
  convTitle?: string
  contextEnabled?: boolean
  pageCtx: PageContext | null
  onToggleContext?: () => void
  showExport: boolean
  onToggleExport: () => void
  hasMessages: boolean
  hasConv: boolean
  onExport: (format: ExportFormat) => void
  onCopyConv: () => void
  canSummarize: boolean
  summarizing: boolean
  summary: Summary | null
  onToggleSummary: () => void
  onSummarize: () => void
  pinnedCount: number
  showPinned: boolean
  onTogglePinned: () => void
  onNew: () => void
}

export function ChatToolbar({
  convTitle,
  contextEnabled,
  pageCtx,
  onToggleContext,
  showExport,
  onToggleExport,
  hasMessages,
  hasConv,
  onExport,
  onCopyConv,
  canSummarize,
  summarizing,
  summary,
  onToggleSummary,
  onSummarize,
  pinnedCount,
  showPinned,
  onTogglePinned,
  onNew,
}: ChatToolbarProps) {
  const { t } = useLocale()

  return (
    <div className="chat-toolbar">
      <span className="conv-title">{convTitle ?? t('chat.newConv')}</span>
      {contextEnabled && pageCtx && (
        <span className="badge badge-green" title={pageCtx.url} style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={onToggleContext}>
          📄 {pageCtx.title?.slice(0, 20) || 'Page'}
        </span>
      )}
      {!contextEnabled && (
        <button className="icon-btn btn-xs" title={t('chat.contextOn')} onClick={onToggleContext} style={{ opacity: 0.5 }}>📄</button>
      )}
      <div style={{ position: 'relative' }}>
        <button className="icon-btn" title={t('chat.exportTitle')} onClick={onToggleExport} disabled={!hasConv || !hasMessages}>📤</button>
        {showExport && hasConv && (
          <div className="export-menu">
            <button className="export-item" onClick={() => onExport('markdown')}>📝 Markdown</button>
            <button className="export-item" onClick={() => onExport('html')}>🌐 HTML</button>
            <button className="export-item" onClick={() => onExport('json')}>📦 JSON</button>
            <button className="export-item" onClick={() => onExport('txt')}>📄 {t('chat.exportText')}</button>
            <div className="export-divider" />
            <button className="export-item" onClick={onCopyConv}>📋 {t('chat.exportCopy')}</button>
          </div>
        )}
      </div>
      {canSummarize && (
        <button
          className={`icon-btn${summarizing ? ' spinning' : ''}`}
          title={summary ? t('chat.summaryView') : t('chat.summaryGenerate')}
          onClick={summary ? onToggleSummary : onSummarize}
          disabled={summarizing}
        >
          {summarizing ? '⏳' : '📋'}
        </button>
      )}
      {pinnedCount > 0 && (
        <button
          className={`icon-btn${showPinned ? ' pin-active' : ''}`}
          title={t('chat.pinnedMessages', { n: pinnedCount })}
          onClick={onTogglePinned}
        >
          📌
        </button>
      )}
      <button className="icon-btn" title={t('chat.newChat')} onClick={onNew}>✏️</button>
    </div>
  )
}
