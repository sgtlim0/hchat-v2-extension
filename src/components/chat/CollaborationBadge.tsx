// CollaborationBadge — Tab collaboration status indicator

import { useState, useEffect, useRef, useCallback } from 'react'
import { t } from '../../i18n'
import {
  createCollabSession,
  getActiveSessions,
  type SyncMessage,
  type CollabSession,
} from '../../lib/collaborationMode'

interface Props {
  convId: string | null
  onSyncMessage?: (msg: SyncMessage) => void
}

const FLASH_DURATION = 600

export function CollaborationBadge({ convId, onSyncMessage }: Props) {
  const [connected, setConnected] = useState(false)
  const [flashing, setFlashing] = useState(false)
  const [sessionCount, setSessionCount] = useState(0)
  const sessionRef = useRef<CollabSession | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleUpdate = useCallback(
    (msg: SyncMessage) => {
      onSyncMessage?.(msg)

      // Trigger flash animation
      setFlashing(true)
      if (flashTimerRef.current !== null) {
        clearTimeout(flashTimerRef.current)
      }
      flashTimerRef.current = setTimeout(() => {
        setFlashing(false)
        flashTimerRef.current = null
      }, FLASH_DURATION)
    },
    [onSyncMessage],
  )

  useEffect(() => {
    if (!convId) {
      setConnected(false)
      return
    }

    const session = createCollabSession(convId)
    sessionRef.current = session

    setConnected(session.isConnected())
    setSessionCount(getActiveSessions().length)

    session.onUpdate(handleUpdate)

    return () => {
      session.close()
      sessionRef.current = null
      if (flashTimerRef.current !== null) {
        clearTimeout(flashTimerRef.current)
        flashTimerRef.current = null
      }
    }
  }, [convId, handleUpdate])

  if (!convId) return null

  const statusText = connected ? t('collab.syncing') : t('collab.disconnected')
  const indicatorClass = [
    'collab-indicator',
    connected ? 'connected' : 'disconnected',
    flashing ? 'flash' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="collab-badge" role="status" aria-live="polite">
      <span data-testid="collab-indicator" className={indicatorClass} />
      <span className="collab-status">{statusText}</span>
      {sessionCount > 0 && (
        <span className="collab-count">
          <span>{sessionCount}</span>
          <span>{t('collab.tabs')}</span>
        </span>
      )}
    </div>
  )
}
