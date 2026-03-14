import { useEffect, useState } from 'react'
import '../styles/global.css'
import { useLocale } from '../i18n'
import { PROVIDER_COLORS } from '../lib/providers/types'
import { SK } from '../lib/storageKeys'

export function PopupApp() {
  const { t } = useLocale()
  const [hasCredentials, setHasCredentials] = useState(false)

  useEffect(() => {
    chrome.storage.local.get(SK.CONFIG, (r) => {
      const cfg = r[SK.CONFIG]
      setHasCredentials(!!cfg?.aws?.accessKeyId && !!cfg?.aws?.secretAccessKey)
    })
  }, [])

  const openPanel = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      await chrome.sidePanel.open({ tabId: tab.id })
      window.close()
    }
  }

  return (
    <div style={{
      width: 300,
      background: 'var(--bg1)',
      fontFamily: 'IBM Plex Sans KR, sans-serif',
      color: 'var(--text0)',
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
      overflow: 'hidden',
      borderRadius: 0,
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #34d399, #10b981)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, fontSize: 16, color: '#061210' }}>H</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>H Chat</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'IBM Plex Mono, monospace' }}>AWS Bedrock · Claude</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <span style={{
            padding: '3px 10px', borderRadius: 999, fontSize: 10, fontFamily: 'IBM Plex Mono, monospace',
            background: hasCredentials ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
            color: hasCredentials ? '#34d399' : '#f87171',
          }}>
            {hasCredentials ? t('common.connected') : t('common.notConfigured')}
          </span>
        </div>
      </div>

      {/* AWS Status */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: hasCredentials ? PROVIDER_COLORS.bedrock : 'var(--bg5)', flexShrink: 0 }} />
        <span style={{ fontSize: 12, flex: 1 }}>AWS Bedrock</span>
        <span style={{ fontSize: 10, fontFamily: 'IBM Plex Mono, monospace', color: hasCredentials ? PROVIDER_COLORS.bedrock : 'var(--text3)' }}>
          {hasCredentials ? `✓ ${t('common.connected')}` : t('common.noKey')}
        </span>
      </div>

      {/* Quick actions */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{t('popup.quickActions')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[
            { icon: '📄', label: t('popup.pageSummary') },
            { icon: '🌐', label: t('popup.translate') },
            { icon: '✏️', label: t('popup.writing') },
            { icon: '🤖', label: t('popup.groupChat') },
          ].map((q) => (
            <button key={q.label} onClick={openPanel} style={{
              background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8,
              padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 11, color: 'var(--text1)', cursor: 'pointer',
              transition: 'all 0.12s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text1)' }}
            >
              <span>{q.icon}</span>
              <span>{q.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Open button */}
      <div style={{ padding: '12px 16px' }}>
        <button onClick={openPanel} style={{
          width: '100%', background: 'linear-gradient(135deg, #34d399, #10b981)', color: '#061210',
          border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700,
          fontFamily: 'IBM Plex Sans KR, sans-serif', cursor: 'pointer',
        }}>
          {t('popup.openPanel')}
        </button>
      </div>
    </div>
  )
}
