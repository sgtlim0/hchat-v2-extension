import { useLocale } from '../../i18n'
import type { ResearchProgress, SourceRef } from '../../lib/deepResearch'

interface DeepResearchToggleProps {
  enabled: boolean
  onToggle: () => void
  progress: ResearchProgress | null
  sources?: SourceRef[]
  streamingReport?: string
}

const STEP_ICONS: Record<string, string> = {
  generating_queries: '🔍',
  searching: '🌐',
  writing_report: '📝',
}

export function DeepResearchToggle({ enabled, onToggle, progress, sources = [], streamingReport = '' }: DeepResearchToggleProps) {
  const { t } = useLocale()

  const isActive = !!progress

  return (
    <div className="deep-research-toggle-wrap">
      <button
        className={`deep-research-toggle${enabled ? ' active' : ''}`}
        onClick={onToggle}
        title={enabled ? t('deepResearch.disable') : t('deepResearch.enable')}
      >
        <span className="dr-icon">🔬</span>
        <span className="dr-label">{t('deepResearch.label')}</span>
      </button>

      {isActive && (
        <div className="deep-research-progress">
          <div className="dr-status-row">
            <span className="dr-step-icon">{STEP_ICONS[progress.step] ?? '⏳'}</span>
            <span className="dr-step-detail">{progress.detail}</span>
            <div className="dr-progress-bar">
              <div
                className="dr-progress-fill"
                style={{ width: `${((progress.current + 1) / progress.total) * 100}%` }}
              />
            </div>
          </div>

          {/* Intermediate search results */}
          {sources.length > 0 && (
            <div className="dr-sources-preview">
              <span className="dr-sources-label">
                {t('deepResearch.sourcesFound', { count: sources.length })}
              </span>
              <ul className="dr-sources-list">
                {sources.slice(0, 5).map((s, i) => (
                  <li key={`${s.url}-${i}`} className="dr-source-item" title={s.url}>
                    {s.title.slice(0, 60)}{s.title.length > 60 ? '...' : ''}
                  </li>
                ))}
                {sources.length > 5 && (
                  <li className="dr-source-more">+{sources.length - 5} {t('deepResearch.moreResults')}</li>
                )}
              </ul>
            </div>
          )}

          {/* Streaming report preview */}
          {streamingReport && (
            <div className="dr-report-preview">
              <span className="dr-report-label">{t('deepResearch.reportPreview')}</span>
              <div className="dr-report-text">
                {streamingReport.slice(0, 300)}{streamingReport.length > 300 ? '...' : ''}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
