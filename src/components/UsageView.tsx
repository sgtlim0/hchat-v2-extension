import { useState, useEffect } from 'react'
import { Usage, formatCost, formatTokens, type UsageSummary, type UsageFeature } from '../lib/usage'

const PROVIDER_COLORS: Record<string, string> = {
  bedrock: '#ff9900',
  claude: '#9f7aea',
  openai: '#10a37f',
  gemini: '#4285f4',
}

const FEATURE_LABELS: Record<UsageFeature, string> = {
  chat: '채팅',
  group: '그룹',
  tool: '도구',
  agent: '에이전트',
  debate: '토론',
  report: '리포트',
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
    if (!confirm('모든 사용량 기록을 삭제하시겠습니까?')) return
    await Usage.clearAll()
    load()
  }

  if (!summary) return <div style={{ padding: 16 }}><span className="spinner-sm" /></div>

  const maxCost = Math.max(...summary.byDate.map((d) => d.cost), 0.001)
  const totalFeatureRequests = Object.values(featureBreakdown).reduce((a, b) => a + b, 0) || 1

  return (
    <div className="usage-view">
      <div className="usage-header">
        <span className="usage-title">📊 사용량 통계</span>
        <select className="select select-sm" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>7일</option>
          <option value={30}>30일</option>
          <option value={90}>90일</option>
        </select>
      </div>

      {/* Summary cards */}
      <div className="usage-cards">
        <div className="usage-card">
          <div className="usage-card-label">총 요청</div>
          <div className="usage-card-value">{summary.totalRequests.toLocaleString()}</div>
        </div>
        <div className="usage-card">
          <div className="usage-card-label">총 토큰</div>
          <div className="usage-card-value">{formatTokens(summary.totalInputTokens + summary.totalOutputTokens)}</div>
        </div>
        <div className="usage-card">
          <div className="usage-card-label">예상 비용</div>
          <div className="usage-card-value usage-cost">{formatCost(summary.totalCost)}</div>
        </div>
      </div>

      {/* Provider breakdown */}
      <div className="usage-section">
        <div className="usage-section-title">프로바이더별</div>
        {Object.entries(summary.byProvider).map(([provider, data]) => (
          <div key={provider} className="usage-provider-row">
            <div className="usage-provider-dot" style={{ background: PROVIDER_COLORS[provider] ?? 'var(--text3)' }} />
            <span className="usage-provider-name">{provider}</span>
            <span className="usage-provider-stat">{data.requests}회</span>
            <span className="usage-provider-stat">{formatTokens(data.tokens)}</span>
            <span className="usage-provider-stat usage-cost">{formatCost(data.cost)}</span>
          </div>
        ))}
        {Object.keys(summary.byProvider).length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--text3)', padding: '8px 0' }}>사용 기록이 없습니다</div>
        )}
      </div>

      {/* Feature breakdown */}
      {Object.keys(featureBreakdown).length > 0 && (
        <div className="usage-section">
          <div className="usage-section-title">기능별</div>
          {(Object.entries(featureBreakdown) as [string, number][])
            .sort((a, b) => b[1] - a[1])
            .map(([feature, count]) => {
              const percent = (count / totalFeatureRequests) * 100
              const color = FEATURE_COLORS[feature as UsageFeature] ?? 'var(--text3)'
              return (
                <div key={feature} className="usage-feature-row">
                  <span className="usage-feature-name">{FEATURE_LABELS[feature as UsageFeature] ?? feature}</span>
                  <div className="usage-feature-bar">
                    <div className="usage-feature-fill" style={{ width: `${percent}%`, background: color }} />
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text2)', minWidth: 40, textAlign: 'right' }}>{count}회</span>
                </div>
              )
            })}
        </div>
      )}

      {/* Daily chart */}
      {summary.byDate.length > 0 && (
        <div className="usage-section">
          <div className="usage-section-title">일별 비용</div>
          <div className="usage-chart">
            {summary.byDate.slice(-14).map((d) => (
              <div key={d.date} className="usage-bar-col">
                <div
                  className="usage-bar"
                  style={{ height: `${Math.max((d.cost / maxCost) * 60, 2)}px` }}
                  title={`${d.date}: ${formatCost(d.cost)} (${d.requests}회)`}
                />
                <div className="usage-bar-label">{d.date.slice(5)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding: '8px 0' }}>
        <button className="btn btn-ghost btn-xs" style={{ color: 'var(--red)' }} onClick={handleClear}>
          기록 초기화
        </button>
        <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 4 }}>
          * 토큰 수는 추정치이며, 실제 API 사용량과 다를 수 있습니다
        </div>
      </div>
    </div>
  )
}
