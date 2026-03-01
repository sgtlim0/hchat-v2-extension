import { useState } from 'react'
import { MODELS } from '../lib/models'
import type { Config } from '../hooks/useConfig'

interface Props {
  value: string
  onChange: (model: string) => void
  config: Config
}

export function ModelSelector({ value, onChange, config }: Props) {
  const [open, setOpen] = useState(false)
  const current = MODELS.find((m) => m.id === value) ?? MODELS[0]
  const hasCredentials = !!config.aws.accessKeyId && !!config.aws.secretAccessKey

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="model-selector-btn"
        onClick={() => setOpen(!open)}
      >
        <span>{current.emoji}</span>
        <span>{current.shortLabel}</span>
        <span style={{ color: 'var(--text3)' }}>▾</span>
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              marginBottom: 4,
              background: 'var(--bg2)',
              border: '1px solid var(--border2)',
              borderRadius: 'var(--radius)',
              boxShadow: 'var(--shadow)',
              zIndex: 100,
              minWidth: 200,
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '6px 12px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff9900', display: 'inline-block' }} />
              <span style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--mono)' }}>AWS Bedrock</span>
              {!hasCredentials && (
                <span className="badge badge-red" style={{ marginLeft: 'auto' }}>키 없음</span>
              )}
            </div>
            {MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => { onChange(m.id); setOpen(false) }}
                disabled={!hasCredentials}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '7px 12px',
                  background: value === m.id ? 'var(--accent-dim)' : 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: hasCredentials ? 'pointer' : 'not-allowed',
                  opacity: hasCredentials ? 1 : 0.4,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { if (hasCredentials) e.currentTarget.style.background = 'var(--bg3)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = value === m.id ? 'var(--accent-dim)' : 'transparent' }}
              >
                <span>{m.emoji}</span>
                <span style={{ fontSize: 12, color: 'var(--text0)' }}>{m.label}</span>
                {value === m.id && <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 12 }}>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
