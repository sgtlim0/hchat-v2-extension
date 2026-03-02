import { useLocale } from '../../i18n'
import type { UsageAlertState } from '../../lib/usageAlert'

interface UsageAlertBannerProps {
  alert: UsageAlertState
  onDismiss: () => void
}

export function UsageAlertBanner({ alert, onDismiss }: UsageAlertBannerProps) {
  const { t } = useLocale()

  if (alert.level === 'none') return null

  const isWarn = alert.level === 'warn'
  const pct = Math.round(alert.percentage)
  const barWidth = Math.min(pct, 100)

  return (
    <div className={`usage-alert-banner ${alert.level}`}>
      <div className="usage-alert-content">
        <span className="usage-alert-icon">{isWarn ? '⚠️' : '🚨'}</span>
        <div className="usage-alert-text">
          <strong>
            {isWarn
              ? t('usageAlert.warnTitle', { pct: String(pct) })
              : t('usageAlert.critTitle')}
          </strong>
          <span className="usage-alert-detail">
            ${alert.currentCost.toFixed(2)} / ${alert.budget.toFixed(2)} · {t('usageAlert.remaining')} ${alert.remaining.toFixed(2)}
          </span>
        </div>
        <button className="usage-alert-dismiss" onClick={onDismiss} title={t('common.close')}>×</button>
      </div>
      <div className="usage-alert-bar">
        <div className="usage-alert-bar-fill" style={{ width: `${barWidth}%` }} />
      </div>
    </div>
  )
}
