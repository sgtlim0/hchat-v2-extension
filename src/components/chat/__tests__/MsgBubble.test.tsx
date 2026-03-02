import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../../../i18n', () => ({
  useLocale: vi.fn(() => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'common.me': '나',
        'chat.copyBtn': '복사',
        'chat.editBtn': '편집',
        'chat.readAloud': '읽기',
        'chat.stopReading': '중지',
        'chat.regenerate': '재생성',
        'chat.pinMessage': '고정',
        'chat.unpinMessage': '고정 해제',
        'chat.forkConv': '분기',
        'chat.saveResend': '저장 후 재전송',
        'common.cancel': '취소',
      }
      return map[key] ?? key
    },
    locale: 'ko' as const,
    setLocale: vi.fn(),
  })),
}))

vi.mock('../../../lib/tts', () => ({
  TTS: {
    isPlaying: vi.fn(() => false),
    speak: vi.fn(),
    stop: vi.fn(),
  },
}))

import { MsgBubble } from '../MsgBubble'
import type { ChatMessage } from '../../../lib/chatHistory'

function makeMsg(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    role: 'user',
    content: 'Hello world',
    ts: Date.now(),
    ...overrides,
  }
}

describe('MsgBubble', () => {
  const defaultProps = {
    onCopy: vi.fn(),
    onTTS: vi.fn(),
    onEdit: vi.fn(),
    onRegenerate: vi.fn(),
    onFork: vi.fn(),
    onPin: vi.fn(),
  }

  it('renders user message', () => {
    render(<MsgBubble msg={makeMsg()} {...defaultProps} />)
    expect(screen.getByText('Hello world')).toBeTruthy()
    expect(screen.getByText('나')).toBeTruthy() // avatar
  })

  it('renders assistant message with markdown', () => {
    render(<MsgBubble msg={makeMsg({ role: 'assistant', content: 'AI response' })} {...defaultProps} />)
    expect(screen.getByText('H')).toBeTruthy() // AI avatar
  })

  it('shows copy button and calls onCopy', () => {
    render(<MsgBubble msg={makeMsg()} {...defaultProps} />)
    const copyBtn = screen.getByTitle('복사')
    fireEvent.click(copyBtn)
    expect(defaultProps.onCopy).toHaveBeenCalledWith('Hello world')
  })

  it('shows edit button for user messages', () => {
    render(<MsgBubble msg={makeMsg()} {...defaultProps} />)
    expect(screen.getByTitle('편집')).toBeTruthy()
  })

  it('does not show edit button for assistant messages', () => {
    render(<MsgBubble msg={makeMsg({ role: 'assistant' })} {...defaultProps} />)
    expect(screen.queryByTitle('편집')).toBeNull()
  })

  it('enters edit mode on edit click', () => {
    render(<MsgBubble msg={makeMsg()} {...defaultProps} />)
    fireEvent.click(screen.getByTitle('편집'))
    expect(screen.getByText('저장 후 재전송')).toBeTruthy()
    expect(screen.getByText('취소')).toBeTruthy()
  })

  it('shows streaming cursor', () => {
    const { container } = render(<MsgBubble msg={makeMsg({ streaming: true })} {...defaultProps} />)
    expect(container.querySelector('.cursor')).toBeTruthy()
  })

  it('hides actions during streaming', () => {
    render(<MsgBubble msg={makeMsg({ streaming: true })} {...defaultProps} />)
    expect(screen.queryByTitle('복사')).toBeNull()
  })

  it('shows pin badge for pinned messages', () => {
    const { container } = render(<MsgBubble msg={makeMsg({ pinned: true })} {...defaultProps} />)
    expect(container.querySelector('.msg-pin-badge')).toBeTruthy()
  })

  it('shows error styling', () => {
    const { container } = render(<MsgBubble msg={makeMsg({ error: true, role: 'assistant' })} {...defaultProps} />)
    expect(container.querySelector('.error')).toBeTruthy()
  })

  it('shows model tag', () => {
    render(<MsgBubble msg={makeMsg({ model: 'claude-sonnet-4-6' })} {...defaultProps} />)
    expect(screen.getByText('sonnet')).toBeTruthy()
  })

  it('shows image attachment', () => {
    const { container } = render(<MsgBubble msg={makeMsg({ imageUrl: 'data:image/png;base64,abc' })} {...defaultProps} />)
    const img = container.querySelector('.msg-img')
    expect(img).toBeTruthy()
  })

  it('calls onFork when fork button clicked', () => {
    render(<MsgBubble msg={makeMsg()} {...defaultProps} />)
    fireEvent.click(screen.getByTitle('분기'))
    expect(defaultProps.onFork).toHaveBeenCalledWith('msg-1')
  })

  it('calls onPin when pin button clicked', () => {
    render(<MsgBubble msg={makeMsg()} {...defaultProps} />)
    fireEvent.click(screen.getByTitle('고정'))
    expect(defaultProps.onPin).toHaveBeenCalledWith('msg-1')
  })
})
