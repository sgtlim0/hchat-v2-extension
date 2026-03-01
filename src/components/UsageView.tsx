import { useState, useEffect } from 'react'
import { Usage, formatCost, formatTokens, type UsageSummary } from '../lib/usage'

export function UsageView() {
  const [summary, setSummary] = useState<UsageSummary | null>(null)
  const [days, setDays] = useState(30)

  const load = () => Usage.getSummary(days).then(setSummary)
  useEffect(() => { load() }, [days])

  const handleClear = async () => {
    if (!confirm('모든 사용량 기록을 삭제하시겠습니까?')) return
    await Usage.clearAll()
    load()
  }

  if (!summary) return <div style={{ padding: 16 }}><span className="spinner-sm" /></div>

  const providerColors: Record<string, string> = {
    claude: '#9f7aea',
    openai: '#48bb78',
    gemini: '#63b3ed',
  }

  const maxCost = Math.max(...summary.byDate.map((d) => d.cost), 0.001)

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
            <div className="usage-provider-dot" style={{ background: providerColors[provider] ?? 'var(--text3)' }} />
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

      {/* Daily chart (simple bar chart) */}
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
