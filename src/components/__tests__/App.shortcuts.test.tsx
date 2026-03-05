import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import { App } from '../../sidepanel/App'

// Mock all lazy-loaded components
vi.mock('../ToolsView', () => ({ default: () => <div>ToolsView</div> }))
vi.mock('../PromptLibraryView', () => ({ default: () => <div>PromptLibraryView</div> }))
vi.mock('../HistoryView', () => ({ default: () => <div>HistoryView</div> }))
vi.mock('../SettingsView', () => ({ default: () => <div>SettingsView</div> }))
vi.mock('../BookmarksView', () => ({ default: () => <div>BookmarksView</div> }))
vi.mock('../DebateView', () => ({ default: () => <div>DebateView</div> }))
vi.mock('../ChatView', () => ({
  ChatView: (props: { onRegisterActions: (a: Record<string, () => void>) => void }) => {
    props.onRegisterActions({
      startNew: vi.fn(),
      stop: vi.fn(),
      focusInput: vi.fn(),
    })
    return <div>ChatView</div>
  },
}))
vi.mock('../GroupChatView', () => ({ GroupChatView: () => <div>GroupChatView</div> }))
vi.mock('../MessageSearchModal', () => ({
  MessageSearchModal: ({ open }: { open: boolean }) => open ? <div data-testid="search-modal">SearchModal</div> : null,
}))
vi.mock('../OfflineBanner', () => ({ OfflineBanner: () => null }))
vi.mock('../ErrorBoundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock useConfig to return a valid config with API key
vi.mock('../../hooks/useConfig', () => ({
  useConfig: () => ({
    config: {
      aws: { accessKeyId: 'test', secretAccessKey: 'test', region: 'us-east-1' },
      openai: { apiKey: '' },
      gemini: { apiKey: '' },
      defaultModel: 'test',
      autoRouting: false,
      enableContentScript: false,
      enableSearchEnhance: false,
      enableWebSearch: false,
      language: 'ko',
      theme: 'dark',
      budget: { monthly: 0, warnThreshold: 70, critThreshold: 90, webhookUrl: '', webhookEnabled: false },
      googleSearchApiKey: '',
      googleSearchEngineId: '',
    },
    update: vi.fn(),
    loaded: true,
  }),
}))

// Mock useShortcuts — track the actions passed
let capturedActions: Partial<Record<string, () => void>> = {}
vi.mock('../../hooks/useShortcuts', () => ({
  useShortcuts: (actions: Partial<Record<string, () => void>>) => {
    capturedActions = actions
    return []
  },
}))

// Mock i18n
vi.mock('../../i18n', () => ({
  useLocale: () => ({
    t: (key: string) => key,
    locale: 'ko',
  }),
}))

// Mock matchMedia
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

describe('App keyboard shortcuts', () => {
  beforeEach(() => {
    capturedActions = {}
  })

  it('shortcutActions에 모든 기본 액션 등록', () => {
    render(<App />)
    expect(capturedActions['new-chat']).toBeDefined()
    expect(capturedActions['focus-input']).toBeDefined()
    expect(capturedActions['stop-generation']).toBeDefined()
    expect(capturedActions['search-history']).toBeDefined()
    expect(capturedActions['toggle-context']).toBeDefined()
    expect(capturedActions['next-tab']).toBeDefined()
    expect(capturedActions['prev-tab']).toBeDefined()
  })

  it('search-history 액션으로 검색 모달 열기', async () => {
    const { queryByTestId } = render(<App />)
    expect(queryByTestId('search-modal')).toBeNull()
    capturedActions['search-history']?.()
    await waitFor(() => {
      expect(queryByTestId('search-modal')).not.toBeNull()
    })
  })

  it('next-tab 액션으로 다음 탭 전환', async () => {
    const { container } = render(<App />)
    // Initially on chat tab
    const getActiveTab = () => container.querySelector('.tab-btn.active span:last-child')?.textContent
    expect(getActiveTab()).toBe('tabs.chat')
    capturedActions['next-tab']?.()
    await waitFor(() => {
      expect(getActiveTab()).toBe('tabs.group')
    })
  })

  it('prev-tab 액션으로 이전 탭 전환', async () => {
    const { container } = render(<App />)
    capturedActions['prev-tab']?.()
    await waitFor(() => {
      const activeTab = container.querySelector('.tab-btn.active span:last-child')?.textContent
      expect(activeTab).toBe('tabs.settings')
    })
  })

  it('toggle-context 액션으로 컨텍스트 토글', () => {
    render(<App />)
    // Should not throw
    expect(() => capturedActions['toggle-context']?.()).not.toThrow()
  })

  it('new-chat 액션으로 chat 탭 전환', async () => {
    const { container } = render(<App />)
    // Move to another tab first
    capturedActions['next-tab']?.()
    await waitFor(() => {
      const activeTab = container.querySelector('.tab-btn.active span:last-child')?.textContent
      expect(activeTab).toBe('tabs.group')
    })
    capturedActions['new-chat']?.()
    await waitFor(() => {
      const activeTab = container.querySelector('.tab-btn.active span:last-child')?.textContent
      expect(activeTab).toBe('tabs.chat')
    })
  })

  it('focus-input 액션으로 chat 탭 전환', async () => {
    const { container } = render(<App />)
    capturedActions['next-tab']?.()
    await waitFor(() => {
      const activeTab = container.querySelector('.tab-btn.active span:last-child')?.textContent
      expect(activeTab).toBe('tabs.group')
    })
    capturedActions['focus-input']?.()
    await waitFor(() => {
      const activeTab = container.querySelector('.tab-btn.active span:last-child')?.textContent
      expect(activeTab).toBe('tabs.chat')
    })
  })

  it('stop-generation 액션 호출 가능', () => {
    render(<App />)
    expect(() => capturedActions['stop-generation']?.()).not.toThrow()
  })
})
