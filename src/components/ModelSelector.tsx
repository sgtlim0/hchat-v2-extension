import { useState } from 'react'
import { useProvider } from '../hooks/useProvider'
import type { Config } from '../hooks/useConfig'
import type { ProviderType } from '../lib/providers/types'
import { useLocale } from '../i18n'

interface Props {
  value: string
  onChange: (model: string) => void
  config: Config
}

const PROVIDER_INFO: Record<ProviderType, { label: string; color: string }> = {
  bedrock: { label: 'AWS Bedrock', color: '#ff9900' },
  openai: { label: 'OpenAI', color: '#10a37f' },
  gemini: { label: 'Google Gemini', color: '#4285f4' },
}

export function ModelSelector({ value, onChange, config }: Props) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const { allModels, getProvider } = useProvider(config)

  const current = allModels.find((m) => m.id === value) ?? allModels[0]
  const autoRouting = config.autoRouting

  // Group models by provider
  const grouped = (['bedrock', 'openai', 'gemini'] as ProviderType[]).map((type) => ({
    type,
    ...PROVIDER_INFO[type],
    models: allModels.filter((m) => m.provider === type),
    configured: !!getProvider(allModels.find((m) => m.provider === type)?.id ?? '')?.isConfigured(),
  }))

  return (
    <div style={{ position: 'relative' }}>
      <button className="model-selector-btn" onClick={() => setOpen(!open)}>
        {autoRouting ? (
          <>
            <span>🔄</span>
            <span>{t('settings.auto')}</span>
          </>
        ) : (
          <>
            <span>{current?.emoji}</span>
            <span>{current?.shortLabel}</span>
          </>
        )}
        <span style={{ color: 'var(--text3)' }}>▾</span>
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
            background: 'var(--bg2)', border: '1px solid var(--border2)',
            borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
            zIndex: 100, minWidth: 220, overflow: 'hidden',
          }}>
            {autoRouting && (
              <div style={{
                padding: '6px 12px', background: 'var(--accent-dim)',
                fontSize: 10, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {t('settings.autoRoutingActive')}
              </div>
            )}

            {grouped.map((g) => (
              <div key={g.type}>
                <div style={{ padding: '6px 12px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: g.color, display: 'inline-block' }} />
                  <span style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--mono)' }}>{g.label}</span>
                  {!g.configured && (
                    <span className="badge badge-red" style={{ marginLeft: 'auto' }}>{t('common.noKey')}</span>
                  )}
                </div>
                {g.models.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { onChange(m.id); setOpen(false) }}
                    disabled={!g.configured}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      padding: '7px 12px', background: value === m.id && !autoRouting ? 'var(--accent-dim)' : 'transparent',
                      border: 'none', textAlign: 'left',
                      cursor: g.configured ? 'pointer' : 'not-allowed',
                      opacity: g.configured ? 1 : 0.4, transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => { if (g.configured) e.currentTarget.style.background = 'var(--bg3)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = value === m.id && !autoRouting ? 'var(--accent-dim)' : 'transparent' }}
                  >
                    <span>{m.emoji}</span>
                    <span style={{ fontSize: 12, color: 'var(--text0)' }}>{m.labelKey ? `${m.label} (${t('modelLabels.' + m.labelKey)})` : m.label}</span>
                    {value === m.id && !autoRouting && <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 12 }}>✓</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
