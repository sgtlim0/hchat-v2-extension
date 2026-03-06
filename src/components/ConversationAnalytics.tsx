import { useState, useEffect } from 'react'
import { useLocale } from '../i18n'
import { ChatHistory } from '../lib/chatHistory'
import {
  aggregateConversations,
  extractTopics,
  getDailyActivity,
  getHourlyHeatmap,
  compareProviders,
} from '../lib/analyticsEngine'
import type {
  AggregateResult,
  Topic,
  DailyActivity,
  ProviderComparison,
} from '../lib/analyticsEngine'

interface Props {
  onClose: () => void
}

interface AnalyticsData {
  aggregate: AggregateResult
  topics: Topic[]
  daily: DailyActivity[]
  hourly: number[]
  providers: ProviderComparison[]
}

export function ConversationAnalytics({ onClose }: Props) {
  const { t } = useLocale()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AnalyticsData | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        const index = await ChatHistory.listIndex()

        // Convert index to ConversationMeta format
        const conversations = index.map((item) => ({
          id: item.id,
          model: item.model,
          provider: detectProvider(item.model),
          messageCount: 0,
          createdAt: item.updatedAt,
          updatedAt: item.updatedAt,
        }))

        const aggregate = aggregateConversations(conversations)
        const topics = extractTopics([], 10)
        const daily = getDailyActivity(conversations, 14)
        const hourly = getHourlyHeatmap(conversations)
        const providers = compareProviders(conversations)

        if (!cancelled) {
          setData({ aggregate, topics, daily, hourly, providers })
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="analytics-container" style={{ padding: 16 }}>
        <div style={{ textAlign: 'center', color: 'var(--text2)' }}>
          {t('common.loading')}
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const { aggregate, topics, daily, hourly, providers } = data
  const maxDailyMessages = Math.max(...daily.map((d) => d.messages), 1)
  const maxHourly = Math.max(...hourly, 1)
  const maxTopicScore = Math.max(...topics.map((tp) => tp.score), 1)

  return (
    <div className="analytics-container" style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
          {t('analytics.title')}
        </h3>
        <button
          className="btn btn-ghost btn-sm"
          onClick={onClose}
          style={{ fontSize: 12 }}
        >
          {t('common.close')}
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <SummaryCard label={t('analytics.totalConversations')} value={aggregate.totalConversations} />
        <SummaryCard label={t('analytics.totalMessages')} value={aggregate.totalMessages} />
        <SummaryCard label={t('analytics.avgMessages')} value={aggregate.avgMessagesPerConv} />
      </div>

      {/* Provider Comparison */}
      <Section title={t('analytics.providerComparison')}>
        {providers.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>-</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {providers.map((p) => (
              <div key={p.provider} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <span style={{ fontWeight: 500 }}>{p.provider}</span>
                <span style={{ color: 'var(--text2)' }}>
                  {p.count} {t('analytics.conversations')} / {Math.round(p.avgResponseLength)} chars
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Topic Keywords */}
      <Section title={t('analytics.topTopics')}>
        {topics.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>-</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {topics.map((tp) => {
              const minSize = 11
              const maxSize = 20
              const fontSize = minSize + ((tp.score / maxTopicScore) * (maxSize - minSize))
              return (
                <span
                  key={tp.word}
                  style={{
                    fontSize: `${fontSize}px`,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: 'var(--bg2)',
                    color: 'var(--text1)',
                    fontWeight: 500,
                  }}
                >
                  {tp.word}
                </span>
              )
            })}
          </div>
        )}
      </Section>

      {/* Daily Activity */}
      <Section title={t('analytics.dailyActivity')}>
        {daily.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>-</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {daily.map((d) => {
              const widthPct = (d.messages / maxDailyMessages) * 100
              return (
                <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                  <span style={{ width: 42, flexShrink: 0, color: 'var(--text2)' }}>
                    {d.date.slice(5)}
                  </span>
                  <div style={{ flex: 1, height: 14, background: 'var(--bg2)', borderRadius: 4, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${widthPct}%`,
                        height: '100%',
                        background: 'var(--accent)',
                        borderRadius: 4,
                        transition: 'width 0.3s',
                      }}
                    />
                  </div>
                  <span style={{ width: 28, textAlign: 'right', color: 'var(--text2)' }}>
                    {d.messages}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* Hourly Heatmap */}
      <Section title={t('analytics.hourlyHeatmap')}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 3 }}>
          {hourly.map((count, hour) => {
            const opacity = count === 0 ? 0.05 : count / maxHourly
            return (
              <div
                key={hour}
                data-testid={`heatmap-${hour}`}
                title={`${hour}:00 - ${count}`}
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  borderRadius: 3,
                  background: 'var(--accent)',
                  opacity,
                  cursor: 'default',
                }}
              />
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text3)', marginTop: 4 }}>
          <span>0h</span>
          <span>6h</span>
          <span>12h</span>
          <span>18h</span>
          <span>23h</span>
        </div>
      </Section>
    </div>
  )
}

// --- Sub-components ---

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg2)', textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text1)' }}>
        {Math.round(value)}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 2 }}>
        {label}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: 'var(--text1)' }}>
        {title}
      </h4>
      {children}
    </div>
  )
}

// --- Helpers ---

function detectProvider(model: string): 'bedrock' | 'openai' | 'gemini' {
  if (model.includes('gpt') || model.includes('o1') || model.includes('o3')) {
    return 'openai'
  }
  if (model.includes('gemini')) {
    return 'gemini'
  }
  return 'bedrock'
}
