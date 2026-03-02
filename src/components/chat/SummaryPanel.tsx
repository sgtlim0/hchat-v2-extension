import { useLocale } from '../../i18n'
import type { Summary } from '../../lib/summarize'

interface SummaryPanelProps {
  summary: Summary
  summarizing: boolean
  onClose: () => void
  onRegenerate: () => void
}

export function SummaryPanel({ summary, summarizing, onClose, onRegenerate }: SummaryPanelProps) {
  const { t } = useLocale()

  return (
    <div className="summary-panel">
      <div className="summary-header">
        <span className="summary-title">{t('chat.summaryTitle')}</span>
        <span className="summary-meta">{t('chat.summaryMeta', { n: summary.messageCount })}</span>
        <button className="icon-btn btn-xs" onClick={onClose}>✕</button>
      </div>
      <div className="summary-body">{summary.text}</div>
      <div className="summary-footer">
        <button className="btn btn-ghost btn-xs" onClick={onRegenerate}>
          {summarizing ? t('chat.summaryGenerating') : t('chat.summaryRegenerate')}
        </button>
      </div>
    </div>
  )
}
