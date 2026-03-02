import { useLocale } from '../../i18n'
import type { ResearchProgress } from '../../lib/deepResearch'

interface DeepResearchToggleProps {
  enabled: boolean
  onToggle: () => void
  progress: ResearchProgress | null
}

const STEP_ICONS: Record<string, string> = {
  generating_queries: '🔍',
  searching: '🌐',
  writing_report: '📝',
}

export function DeepResearchToggle({ enabled, onToggle, progress }: DeepResearchToggleProps) {
  const { t } = useLocale()

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

      {progress && (
        <div className="deep-research-progress">
          <span className="dr-step-icon">{STEP_ICONS[progress.step] ?? '⏳'}</span>
          <span className="dr-step-detail">{progress.detail}</span>
          <div className="dr-progress-bar">
            <div
              className="dr-progress-fill"
              style={{ width: `${((progress.current + 1) / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
