import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ChatInputArea } from '../ChatInputArea'

vi.mock('../../../lib/intentRouter', () => ({
  detectIntent: vi.fn((text: string) => {
    if (text.includes('번역')) return { type: 'translate', confidence: 0.9, suggestedTool: 'translate', suggestedAssistant: 'ast-translator' }
    if (text.includes('코드')) return { type: 'code', confidence: 0.9, suggestedAssistant: 'ast-code-reviewer' }
    return { type: 'general', confidence: 0.5, suggestedAssistant: 'ast-default' }
  }),
}))

vi.mock('../../../i18n', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}))

vi.mock('../../../lib/stt', () => ({
  STT: { isSupported: () => false, getState: () => 'idle' },
}))

const defaultProps = {
  input: '',
  onInputChange: vi.fn(),
  onKeyDown: vi.fn(),
  onSend: vi.fn(),
  onStop: vi.fn(),
  isLoading: false,
  agentMode: false,
  onToggleAgent: vi.fn(),
  onSTT: vi.fn(),
  attachment: null,
  onRemoveAttachment: vi.fn(),
  onFileSelect: vi.fn(),
  showPrompts: false,
  prompts: [],
  promptIdx: 0,
  onApplyPrompt: vi.fn(),
  textareaRef: { current: null },
  fileRef: { current: null },
}

beforeEach(() => {
  vi.useFakeTimers()
})

describe('ChatInputArea intent chip', () => {
  it('does not show intent chip for empty input', () => {
    render(<ChatInputArea {...defaultProps} input="" />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('does not show intent chip for short input < 5 chars', () => {
    render(<ChatInputArea {...defaultProps} input="번역" />)
    act(() => { vi.advanceTimersByTime(300) })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('does not show intent chip for slash commands', () => {
    render(<ChatInputArea {...defaultProps} input="/번역해줘 이것" />)
    act(() => { vi.advanceTimersByTime(300) })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows intent chip for translate intent', () => {
    render(<ChatInputArea {...defaultProps} input="이 문장을 번역해주세요" />)
    act(() => { vi.advanceTimersByTime(300) })
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText('intent.translate')).toBeTruthy()
  })

  it('shows intent chip for code intent', () => {
    render(<ChatInputArea {...defaultProps} input="이 코드를 리뷰해주세요" />)
    act(() => { vi.advanceTimersByTime(300) })
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText('intent.code')).toBeTruthy()
  })

  it('does not show intent chip for general intent', () => {
    render(<ChatInputArea {...defaultProps} input="안녕하세요 반갑습니다" />)
    act(() => { vi.advanceTimersByTime(300) })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('calls onApplyIntent when chip is clicked', () => {
    const onApplyIntent = vi.fn()
    render(<ChatInputArea {...defaultProps} input="이 문장을 번역해주세요" onApplyIntent={onApplyIntent} />)
    act(() => { vi.advanceTimersByTime(300) })
    screen.getByText('intent.translate').closest('.intent-chip')!.click()
    expect(onApplyIntent).toHaveBeenCalledWith({
      type: 'translate',
      confidence: 0.9,
      suggestedTool: 'translate',
      suggestedAssistant: 'ast-translator',
    })
  })

  it('shows correct icon for translate intent', () => {
    render(<ChatInputArea {...defaultProps} input="이 문장을 번역해주세요" />)
    act(() => { vi.advanceTimersByTime(300) })
    const icon = screen.getByText('intent.translate').parentElement!.querySelector('.intent-chip-icon')
    expect(icon?.textContent).toContain('🌐')
  })

  it('shows correct icon for code intent', () => {
    render(<ChatInputArea {...defaultProps} input="이 코드를 리뷰해주세요" />)
    act(() => { vi.advanceTimersByTime(300) })
    const icon = screen.getByText('intent.code').parentElement!.querySelector('.intent-chip-icon')
    expect(icon?.textContent).toContain('💻')
  })

  it('shows tool suggestion when available', () => {
    render(<ChatInputArea {...defaultProps} input="이 문장을 번역해주세요" />)
    act(() => { vi.advanceTimersByTime(300) })
    expect(screen.getByText('→ translate')).toBeTruthy()
  })

  it('does not show tool suggestion for code intent', () => {
    render(<ChatInputArea {...defaultProps} input="이 코드를 리뷰해주세요" />)
    act(() => { vi.advanceTimersByTime(300) })
    expect(screen.queryByText(/→/)).toBeNull()
  })

  it('shows chip after 300ms debounce delay', () => {
    render(<ChatInputArea {...defaultProps} input="이 문장을 번역해주세요" />)
    // Before debounce fires
    expect(screen.queryByRole('status')).toBeNull()
    // After debounce
    act(() => { vi.advanceTimersByTime(300) })
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('has ARIA label on intent chip bar', () => {
    render(<ChatInputArea {...defaultProps} input="이 문장을 번역해주세요" />)
    act(() => { vi.advanceTimersByTime(300) })
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('intentSuggestion')
  })

  it('removes chip when input is cleared', () => {
    const { rerender } = render(<ChatInputArea {...defaultProps} input="이 문장을 번역해주세요" />)
    act(() => { vi.advanceTimersByTime(300) })
    expect(screen.getByRole('status')).toBeTruthy()

    rerender(<ChatInputArea {...defaultProps} input="" />)
    act(() => { vi.advanceTimersByTime(300) })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('updates chip when input changes', () => {
    const { rerender } = render(<ChatInputArea {...defaultProps} input="이 문장을 번역해주세요" />)
    act(() => { vi.advanceTimersByTime(300) })
    expect(screen.getByText('intent.translate')).toBeTruthy()

    rerender(<ChatInputArea {...defaultProps} input="이 코드를 리뷰해주세요" />)
    act(() => { vi.advanceTimersByTime(300) })
    expect(screen.getByText('intent.code')).toBeTruthy()
  })

  it('works when onApplyIntent prop is not provided', () => {
    render(<ChatInputArea {...defaultProps} input="이 문장을 번역해주세요" />)
    act(() => { vi.advanceTimersByTime(300) })
    const chip = screen.getByText('intent.translate').closest('.intent-chip')!
    // Should not throw
    expect(() => chip.click()).not.toThrow()
  })
})
