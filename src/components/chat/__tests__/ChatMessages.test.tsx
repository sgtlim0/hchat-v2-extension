import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('react-window', () => ({
  List: vi.fn(({ rowCount, rowComponent: Row, rowProps }: {
    rowCount: number
    rowComponent: React.ComponentType<{ index: number }>
    rowProps: Record<string, unknown>
  }) => (
    <div data-testid="virtual-list">
      {Array.from({ length: Math.min(rowCount, 5) }, (_, i) => (
        <Row key={i} index={i} {...rowProps} />
      ))}
    </div>
  )),
  useDynamicRowHeight: vi.fn(() => vi.fn(() => 150)),
}))

vi.mock('../MsgBubble', () => ({
  MsgBubble: vi.fn(({ msg, ...rest }: { msg: { id: string; content: string; role: string } }) => (
    <div data-testid={`msg-${msg.id}`} data-role={msg.role}>
      {msg.content}
    </div>
  )),
}))

import { ChatMessages } from '../ChatMessages'
import type { ChatMessage } from '../../../lib/chatHistory'

// jsdom doesn't support scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

function makeMsg(id: string, role: 'user' | 'assistant' = 'user', content = `Message ${id}`): ChatMessage {
  return { id, role, content, ts: Date.now() }
}

function makeSuggestions() {
  return [
    { icon: '💡', text: '코드 작성' },
    { icon: '📝', text: '문서 요약' },
  ]
}

function makeProps(overrides: Partial<React.ComponentProps<typeof ChatMessages>> = {}) {
  return {
    messages: [] as ChatMessage[],
    isSearching: false,
    error: '',
    isLoading: false,
    onCopy: vi.fn(),
    onTTS: vi.fn(),
    onEdit: vi.fn(),
    onRegenerate: vi.fn(),
    onFork: vi.fn(),
    onPin: vi.fn(),
    onSuggestionClick: vi.fn(),
    suggestions: makeSuggestions(),
    t: (key: string) => {
      const map: Record<string, string> = {
        'welcome.title': '환영합니다',
        'welcome.chatSubtitle': '무엇을 도와드릴까요?',
        'chat.searchingWeb': '웹 검색 중...',
      }
      return map[key] ?? key
    },
    ...overrides,
  }
}

describe('ChatMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty state with suggestions when no messages', () => {
    render(<ChatMessages {...makeProps()} />)

    expect(screen.getByText('환영합니다')).toBeTruthy()
    expect(screen.getByText('무엇을 도와드릴까요?')).toBeTruthy()
    expect(screen.getByText('코드 작성')).toBeTruthy()
    expect(screen.getByText('문서 요약')).toBeTruthy()
  })

  it('renders H logo in empty state', () => {
    const { container } = render(<ChatMessages {...makeProps()} />)
    expect(container.querySelector('.chat-empty-logo')?.textContent).toBe('H')
  })

  it('calls onSuggestionClick when suggestion is clicked', () => {
    const onSuggestionClick = vi.fn()
    render(<ChatMessages {...makeProps({ onSuggestionClick })} />)

    fireEvent.click(screen.getByText('코드 작성'))
    expect(onSuggestionClick).toHaveBeenCalledWith('코드 작성')
  })

  it('renders message list for fewer than 50 messages', () => {
    const messages = [makeMsg('1'), makeMsg('2', 'assistant'), makeMsg('3')]
    render(<ChatMessages {...makeProps({ messages })} />)

    expect(screen.getByTestId('msg-1')).toBeTruthy()
    expect(screen.getByTestId('msg-2')).toBeTruthy()
    expect(screen.getByTestId('msg-3')).toBeTruthy()
  })

  it('does not show suggestions when messages exist', () => {
    const messages = [makeMsg('1')]
    render(<ChatMessages {...makeProps({ messages })} />)

    expect(screen.queryByText('환영합니다')).toBeNull()
  })

  it('uses virtual scroll for more than 50 messages', () => {
    const messages = Array.from({ length: 51 }, (_, i) => makeMsg(`${i}`))
    render(<ChatMessages {...makeProps({ messages })} />)

    expect(screen.getByTestId('virtual-list')).toBeTruthy()
  })

  it('does not use virtual scroll for exactly 50 messages', () => {
    const messages = Array.from({ length: 50 }, (_, i) => makeMsg(`${i}`))
    render(<ChatMessages {...makeProps({ messages })} />)

    expect(screen.queryByTestId('virtual-list')).toBeNull()
  })

  it('shows search indicator when isSearching is true', () => {
    render(<ChatMessages {...makeProps({ isSearching: true })} />)

    expect(screen.getByText('웹 검색 중...')).toBeTruthy()
  })

  it('hides search indicator when isSearching is false', () => {
    render(<ChatMessages {...makeProps({ isSearching: false })} />)

    expect(screen.queryByText('웹 검색 중...')).toBeNull()
  })

  it('shows error message when error is set and not loading', () => {
    render(<ChatMessages {...makeProps({ error: 'API connection failed', isLoading: false })} />)

    expect(screen.getByText(/API connection failed/)).toBeTruthy()
  })

  it('hides error message when isLoading is true', () => {
    render(<ChatMessages {...makeProps({ error: 'API connection failed', isLoading: true })} />)

    expect(screen.queryByText(/API connection failed/)).toBeNull()
  })

  it('has correct ARIA attributes for accessibility', () => {
    const { container } = render(<ChatMessages {...makeProps()} />)
    const messagesDiv = container.querySelector('.messages')

    expect(messagesDiv?.getAttribute('role')).toBe('log')
    expect(messagesDiv?.getAttribute('aria-live')).toBe('polite')
    expect(messagesDiv?.getAttribute('aria-relevant')).toBe('additions')
  })
})
