import { useState, useEffect } from 'react'
import { Usage, formatCost, formatTokens, exportUsageAsCSV, type UsageSummary, type UsageFeature } from '../lib/usage'
import { downloadBlob } from '../lib/exportChat'
import { useLocale } from '../i18n'

const PROVIDER_COLORS: Record<string, string> = {
  bedrock: '#ff9900',
  claude: '#9f7aea',
  openai: '#10a37f',
  gemini: '#4285f4',
}

const FEATURE_COLORS: Record<UsageFeature, string> = {
  chat: '#34d399',
  group: '#60a5fa',
  tool: '#fbbf24',
  agent: '#a78bfa',
  debate: '#f87171',
  report: '#fb923c',
}

export function UsageView() {
  const { t } = useLocale()
  const [summary, setSummary] = useState<UsageSummary | null>(null)
  const [featureBreakdown, setFeatureBreakdown] = useState<Record<string, number>>({})
  const [days, setDays] = useState(30)

  const load = async () => {
    const s = await Usage.getSummary(days)
    setSummary(s)

    // Build feature breakdown from raw records
    const records = await Usage.getRecords()
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const filtered = records.filter((r) => r.date >= cutoffStr)
    const breakdown: Record<string, number> = {}
    for (const r of filtered) {
      const f = r.feature ?? 'chat'
      breakdown[f] = (breakdown[f] ?? 0) + r.requests
    }
    setFeatureBreakdown(breakdown)
  }

  useEffect(() => { load() }, [days])

  const handleClear = async () => {
    if (!confirm(t('usage.clearConfirm'))) return
    await Usage.clearAll()
    load()
  }

  if (!summary) return <div style={{ padding: 16 }}><span className="spinner-sm" /></div>

  const maxCost = Math.max(...summary.byDate.map((d) => d.cost), 0.001)
  const totalFeatureRequests = Object.values(featureBreakdown).reduce((a, b) => a + b, 0) || 1

  return (
    <div className="usage-view">
      <div className="usage-header">
        <span className="usage-title">{t('usage.title')}</span>
        <select className="select select-sm" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>{t('usage.days7')}</option>
          <option value={30}>{t('usage.days30')}</option>
          <option value={90}>{t('usage.days90')}</option>
        </select>
      </div>

      {/* Summary cards */}
      <div className="usage-cards">
        <div className="usage-card">
          <div className="usage-card-label">{t('usage.totalRequests')}</div>
          <div className="usage-card-value">{summary.totalRequests.toLocaleString()}</div>
        </div>
        <div className="usage-card">
          <div className="usage-card-label">{t('usage.totalTokens')}</div>
          <div className="usage-card-value">{formatTokens(summary.totalInputTokens + summary.totalOutputTokens)}</div>
        </div>
        <div className="usage-card">
          <div className="usage-card-label">{t('usage.estimatedCost')}</div>
          <div className="usage-card-value usage-cost">{formatCost(summary.totalCost)}</div>
        </div>
      </div>

      {/* Provider breakdown */}
      <div className="usage-section">
        <div className="usage-section-title">{t('usage.byProvider')}</div>
        {Object.entries(summary.byProvider).map(([provider, data]) => (
          <div key={provider} className="usage-provider-row">
            <div className="usage-provider-dot" style={{ background: PROVIDER_COLORS[provider] ?? 'var(--text3)' }} />
            <span className="usage-provider-name">{provider}</span>
            <span className="usage-provider-stat">{t('usage.count', { n: data.requests })}</span>
            <span className="usage-provider-stat">{formatTokens(data.tokens)}</span>
            <span className="usage-provider-stat usage-cost">{formatCost(data.cost)}</span>
          </div>
        ))}
        {Object.keys(summary.byProvider).length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--text3)', padding: '8px 0' }}>{t('usage.noRecords')}</div>
        )}
      </div>

      {/* Feature breakdown */}
      {Object.keys(featureBreakdown).length > 0 && (
        <div className="usage-section">
          <div className="usage-section-title">{t('usage.byFeature')}</div>
          {(Object.entries(featureBreakdown) as [string, number][])
            .sort((a, b) => b[1] - a[1])
            .map(([feature, count]) => {
              const percent = (count / totalFeatureRequests) * 100
              const color = FEATURE_COLORS[feature as UsageFeature] ?? 'var(--text3)'
              return (
                <div key={feature} className="usage-feature-row">
                  <span className="usage-feature-name">{t(`usage.features.${feature}`)}</span>
                  <div className="usage-feature-bar">
                    <div className="usage-feature-fill" style={{ width: `${percent}%`, background: color }} />
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text2)', minWidth: 40, textAlign: 'right' }}>{t('usage.count', { n: count })}</span>
                </div>
              )
            })}
        </div>
      )}

      {/* Daily chart */}
      {summary.byDate.length > 0 && (
        <div className="usage-section">
          <div className="usage-section-title">{t('usage.dailyCost')}</div>
          <div className="usage-chart">
            {summary.byDate.slice(-14).map((d) => (
              <div key={d.date} className="usage-bar-col">
                <div
                  className="usage-bar"
                  style={{ height: `${Math.max((d.cost / maxCost) * 60, 2)}px` }}
                  title={`${d.date}: ${formatCost(d.cost)} (${t('usage.count', { n: d.requests })})`}
                />
                <div className="usage-bar-label">{d.date.slice(5)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding: '8px 0', display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="btn btn-ghost btn-xs" onClick={async () => {
          try {
            const records = await Usage.getRecords()
            if (records.length === 0) return
            const csv = exportUsageAsCSV(records)
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
            const date = new Date().toISOString().slice(0, 10)
            downloadBlob(blob, `h-chat-usage-${date}.csv`)
          } catch (error) {
            console.error('CSV export failed:', error)
          }
        }}>
          {t('usage.exportCSV')}
        </button>
        <button className="btn btn-ghost btn-xs" style={{ color: 'var(--red)' }} onClick={handleClear}>
          {t('usage.clearAll')}
        </button>
        <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 4 }}>
          {t('usage.disclaimer')}
        </div>
      </div>
    </div>
  )
}
