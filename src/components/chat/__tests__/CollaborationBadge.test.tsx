import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import type { CollabSession, SyncMessage } from '../../../lib/collaborationMode'

// BroadcastChannel mock (global)
class MockBroadcastChannel {
  name: string
  onmessage: any = null
  constructor(name: string) {
    this.name = name
  }
  postMessage() {}
  close() {}
}
global.BroadcastChannel = MockBroadcastChannel as any

// Mock collaborationMode
let mockSession: CollabSession
let mockOnUpdateCallback: ((msg: SyncMessage) => void) | null = null

const mockCreateCollabSession = vi.fn((convId: string) => {
  mockOnUpdateCallback = null
  mockSession = {
    convId,
    tabId: 'mock-tab-id',
    sendUpdate: vi.fn(),
    onUpdate: vi.fn((cb: (msg: SyncMessage) => void) => {
      mockOnUpdateCallback = cb
    }),
    close: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
  }
  return mockSession
})

const mockGetActiveSessions = vi.fn().mockReturnValue(['conv-1'])

vi.mock('../../../lib/collaborationMode', () => ({
  createCollabSession: (...args: any[]) => mockCreateCollabSession(...args),
  getActiveSessions: () => mockGetActiveSessions(),
}))

vi.mock('../../../i18n', () => ({
  t: (key: string) => key,
}))

describe('CollaborationBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnUpdateCallback = null
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  async function importComponent() {
    const mod = await import('../CollaborationBadge')
    return mod.CollaborationBadge
  }

  it('convId가 null이면 null을 렌더링한다', async () => {
    const CollaborationBadge = await importComponent()
    const { container } = render(<CollaborationBadge convId={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('연결 시 초록 아이콘을 표시한다', async () => {
    const CollaborationBadge = await importComponent()
    render(<CollaborationBadge convId="conv-1" />)

    const indicator = screen.getByTestId('collab-indicator')
    expect(indicator).toBeDefined()
    expect(indicator.className).toContain('connected')
  })

  it('연결 시 "동기화 중" 텍스트를 표시한다', async () => {
    const CollaborationBadge = await importComponent()
    render(<CollaborationBadge convId="conv-1" />)

    expect(screen.getByText('collab.syncing')).toBeDefined()
  })

  it('close 후 "연결 끊김" 텍스트를 표시한다', async () => {
    mockCreateCollabSession.mockImplementationOnce((convId: string) => {
      mockOnUpdateCallback = null
      mockSession = {
        convId,
        tabId: 'mock-tab-id-2',
        sendUpdate: vi.fn(),
        onUpdate: vi.fn(),
        close: vi.fn(),
        isConnected: vi.fn().mockReturnValue(false),
      }
      return mockSession
    })

    const CollaborationBadge = await importComponent()
    render(<CollaborationBadge convId="conv-1" />)

    expect(screen.getByText('collab.disconnected')).toBeDefined()
  })

  it('onSyncMessage 콜백을 호출한다', async () => {
    const CollaborationBadge = await importComponent()
    const onSyncMessage = vi.fn()

    render(<CollaborationBadge convId="conv-1" onSyncMessage={onSyncMessage} />)

    const syncMsg: SyncMessage = {
      type: 'message_added',
      convId: 'conv-1',
      tabId: 'other-tab',
      timestamp: Date.now(),
      payload: { text: 'hello' },
    }

    act(() => {
      if (mockOnUpdateCallback) {
        mockOnUpdateCallback(syncMsg)
      }
    })

    expect(onSyncMessage).toHaveBeenCalledWith(syncMsg)
  })

  it('언마운트 시 close를 호출한다', async () => {
    const CollaborationBadge = await importComponent()
    const { unmount } = render(<CollaborationBadge convId="conv-1" />)

    const session = mockSession
    unmount()

    expect(session.close).toHaveBeenCalled()
  })

  it('convId 변경 시 세션을 재생성한다', async () => {
    const CollaborationBadge = await importComponent()
    const { rerender } = render(<CollaborationBadge convId="conv-1" />)

    const firstSession = mockSession

    rerender(<CollaborationBadge convId="conv-2" />)

    expect(firstSession.close).toHaveBeenCalled()
    expect(mockCreateCollabSession).toHaveBeenCalledWith('conv-2')
  })

  it('활성 세션 수를 표시한다', async () => {
    mockGetActiveSessions.mockReturnValue(['conv-1', 'conv-2', 'conv-3'])
    const CollaborationBadge = await importComponent()

    render(<CollaborationBadge convId="conv-1" />)

    expect(screen.getByText('3')).toBeDefined()
    expect(screen.getByText('collab.tabs')).toBeDefined()
  })
})
