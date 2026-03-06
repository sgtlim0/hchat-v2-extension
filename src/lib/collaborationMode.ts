// lib/collaborationMode.ts — Tab collaboration and sync system via BroadcastChannel

export type SyncType =
  | 'message_added'
  | 'message_updated'
  | 'typing'
  | 'sync_request'
  | 'heartbeat'

export interface SyncMessage {
  type: SyncType
  convId: string
  tabId: string
  timestamp: number
  payload?: unknown
}

export interface CollabSession {
  convId: string
  tabId: string
  sendUpdate(type: SyncType, payload?: unknown): void
  onUpdate(callback: (msg: SyncMessage) => void): void
  close(): void
  isConnected(): boolean
}

const HEARTBEAT_INTERVAL = 5000
const CHANNEL_PREFIX = 'hchat-collab-'

/** Active sessions registry */
const activeSessions = new Map<string, CollabSession>()

/** Generate a unique tab identifier */
function generateTabId(): string {
  return crypto.randomUUID()
}

/** Create a collaboration session for a conversation */
export function createCollabSession(convId: string): CollabSession {
  const tabId = generateTabId()
  const channelName = `${CHANNEL_PREFIX}${convId}`
  const channel = new BroadcastChannel(channelName)

  let connected = true
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  const listeners: Array<(msg: SyncMessage) => void> = []

  function buildMessage(type: SyncType, payload?: unknown): SyncMessage {
    return {
      type,
      convId,
      tabId,
      timestamp: Date.now(),
      ...(payload !== undefined ? { payload } : {}),
    }
  }

  function sendUpdate(type: SyncType, payload?: unknown): void {
    if (!connected) return
    const msg = buildMessage(type, payload)
    channel.postMessage(msg)
  }

  function onUpdate(callback: (msg: SyncMessage) => void): void {
    listeners.push(callback)
  }

  // Handle incoming messages (filter out own tab)
  channel.onmessage = (event: MessageEvent) => {
    const msg = event.data as SyncMessage
    if (msg.tabId === tabId) return
    for (const cb of listeners) {
      cb(msg)
    }
  }

  // Start heartbeat
  heartbeatTimer = setInterval(() => {
    sendUpdate('heartbeat')
  }, HEARTBEAT_INTERVAL)

  function close(): void {
    if (!connected) return
    connected = false
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
    channel.close()
    activeSessions.delete(`${convId}:${tabId}`)
  }

  function isConnected(): boolean {
    return connected
  }

  const session: CollabSession = {
    convId,
    tabId,
    sendUpdate,
    onUpdate,
    close,
    isConnected,
  }

  activeSessions.set(`${convId}:${tabId}`, session)

  return session
}

/** Resolve conflict between two sync messages using last-write-wins */
export function resolveConflict(
  local: SyncMessage,
  remote: SyncMessage
): SyncMessage {
  if (remote.timestamp > local.timestamp) {
    return remote
  }
  return local
}

/** Get list of active session conversation IDs */
export function getActiveSessions(): string[] {
  const convIds = new Set<string>()
  for (const session of activeSessions.values()) {
    if (session.isConnected()) {
      convIds.add(session.convId)
    }
  }
  return [...convIds]
}
