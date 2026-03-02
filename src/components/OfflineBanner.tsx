import { useState, useEffect } from 'react'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { useLocale } from '../i18n'
import { MessageQueue } from '../lib/messageQueue'

export function OfflineBanner() {
  const { isOnline } = useNetworkStatus()
  const { t } = useLocale()
  const [showReconnected, setShowReconnected] = useState(false)
  const [queueCount, setQueueCount] = useState(0)
  const [wasOffline, setWasOffline] = useState(false)

  // Track offline -> online transitions
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true)
      setShowReconnected(false)
    } else if (wasOffline) {
      setShowReconnected(true)
      const timer = setTimeout(() => setShowReconnected(false), 3000)
      setWasOffline(false)
      return () => clearTimeout(timer)
    }
  }, [isOnline, wasOffline])

  // Poll queue count when offline
  useEffect(() => {
    if (isOnline) {
      setQueueCount(0)
      return
    }

    const updateCount = async () => {
      const items = await MessageQueue.getAll()
      setQueueCount(items.length)
    }

    updateCount()
    const interval = setInterval(updateCount, 2000)
    return () => clearInterval(interval)
  }, [isOnline])

  if (isOnline && !showReconnected) return null

  const isReconnected = isOnline && showReconnected

  return (
    <div
      className="offline-banner"
      style={{
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 500,
        textAlign: 'center',
        color: 'var(--text0)',
        background: isReconnected
          ? 'rgba(52, 211, 153, 0.15)'
          : 'rgba(251, 191, 36, 0.15)',
        borderBottom: `1px solid ${isReconnected ? 'var(--accent)' : 'var(--amber)'}`,
      }}
    >
      {isReconnected
        ? t('offline.reconnected')
        : (
          <>
            {t('offline.status')}
            {queueCount > 0 && ` (${t('offline.queued', { n: queueCount })})`}
          </>
        )
      }
    </div>
  )
}
