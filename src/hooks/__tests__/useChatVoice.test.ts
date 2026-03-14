import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../lib/tts', () => ({
  TTS: {
    speak: vi.fn(),
    stop: vi.fn(),
    isPlaying: vi.fn(() => false),
    onStateChange: vi.fn(),
    onEnd: vi.fn(),
    getState: vi.fn(),
  },
}))

vi.mock('../../lib/stt', () => ({
  STT: {
    start: vi.fn(),
    stop: vi.fn(),
    getState: vi.fn(() => 'idle' as const),
    onStateChange: vi.fn(),
  },
}))

import { useChatVoice } from '../useChatVoice'
import { TTS } from '../../lib/tts'
import { STT } from '../../lib/stt'

const mockTTS = vi.mocked(TTS)
const mockSTT = vi.mocked(STT)

function makeArgs(overrides: Partial<{
  sendMessage: (text: string) => Promise<void>
  isLoading: boolean
  messages: { id: string; role: string; content: string }[]
  setInput: React.Dispatch<React.SetStateAction<string>>
  input: string
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}> = {}) {
  return {
    sendMessage: overrides.sendMessage ?? vi.fn(() => Promise.resolve()),
    isLoading: overrides.isLoading ?? false,
    messages: overrides.messages ?? [],
    setInput: overrides.setInput ?? vi.fn(),
    input: overrides.input ?? '',
    textareaRef: overrides.textareaRef ?? { current: null },
  }
}

describe('useChatVoice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSTT.getState.mockReturnValue('idle')
    mockTTS.isPlaying.mockReturnValue(false)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initializes with voiceMode off', () => {
    const args = makeArgs()
    const { result } = renderHook(() =>
      useChatVoice(args.sendMessage, args.isLoading, args.messages, args.setInput, args.input, args.textareaRef),
    )

    expect(result.current.voiceMode).toBe(false)
  })

  it('registers TTS state change callback on mount', () => {
    const args = makeArgs()
    renderHook(() =>
      useChatVoice(args.sendMessage, args.isLoading, args.messages, args.setInput, args.input, args.textareaRef),
    )

    expect(mockTTS.onStateChange).toHaveBeenCalled()
  })

  it('registers STT state change callback on mount', () => {
    const args = makeArgs()
    renderHook(() =>
      useChatVoice(args.sendMessage, args.isLoading, args.messages, args.setInput, args.input, args.textareaRef),
    )

    expect(mockSTT.onStateChange).toHaveBeenCalled()
  })

  it('toggleVoiceMode enables voice mode and starts STT', () => {
    const args = makeArgs()
    const { result } = renderHook(() =>
      useChatVoice(args.sendMessage, args.isLoading, args.messages, args.setInput, args.input, args.textareaRef),
    )

    act(() => {
      result.current.toggleVoiceMode()
    })

    expect(result.current.voiceMode).toBe(true)
    expect(mockSTT.start).toHaveBeenCalled()
  })

  it('toggleVoiceMode disables voice mode and stops STT/TTS', () => {
    const args = makeArgs()
    const { result } = renderHook(() =>
      useChatVoice(args.sendMessage, args.isLoading, args.messages, args.setInput, args.input, args.textareaRef),
    )

    // Enable first
    act(() => {
      result.current.toggleVoiceMode()
    })
    expect(result.current.voiceMode).toBe(true)

    // Disable
    act(() => {
      result.current.toggleVoiceMode()
    })
    expect(result.current.voiceMode).toBe(false)
    expect(mockSTT.stop).toHaveBeenCalled()
    expect(mockTTS.stop).toHaveBeenCalled()
  })

  it('handleTTS plays TTS for a message', () => {
    const args = makeArgs()
    const { result } = renderHook(() =>
      useChatVoice(args.sendMessage, args.isLoading, args.messages, args.setInput, args.input, args.textareaRef),
    )

    act(() => {
      result.current.handleTTS('msg-1', 'Hello world')
    })

    expect(mockTTS.speak).toHaveBeenCalledWith('Hello world', 'msg-1')
  })

  it('handleTTS stops TTS if already playing for same message', () => {
    mockTTS.isPlaying.mockReturnValue(true)
    const args = makeArgs()
    const { result } = renderHook(() =>
      useChatVoice(args.sendMessage, args.isLoading, args.messages, args.setInput, args.input, args.textareaRef),
    )

    act(() => {
      result.current.handleTTS('msg-1', 'Hello world')
    })

    expect(mockTTS.stop).toHaveBeenCalled()
    expect(mockTTS.speak).not.toHaveBeenCalled()
  })

  it('handleSTT starts listening when idle', () => {
    mockSTT.getState.mockReturnValue('idle')
    const args = makeArgs()
    const { result } = renderHook(() =>
      useChatVoice(args.sendMessage, args.isLoading, args.messages, args.setInput, args.input, args.textareaRef),
    )

    act(() => {
      result.current.handleSTT()
    })

    expect(mockSTT.start).toHaveBeenCalled()
  })

  it('handleSTT stops listening when already listening', () => {
    mockSTT.getState.mockReturnValue('listening')
    const args = makeArgs()
    const { result } = renderHook(() =>
      useChatVoice(args.sendMessage, args.isLoading, args.messages, args.setInput, args.input, args.textareaRef),
    )

    act(() => {
      result.current.handleSTT()
    })

    expect(mockSTT.stop).toHaveBeenCalled()
  })

  it('auto-TTS on response complete in voice mode', () => {
    const messages = [{ id: 'msg-1', role: 'assistant', content: 'Response text' }]
    const args = makeArgs({ isLoading: true, messages })

    const { result, rerender } = renderHook(
      ({ isLoading, messages: msgs }) =>
        useChatVoice(args.sendMessage, isLoading, msgs, args.setInput, args.input, args.textareaRef),
      { initialProps: { isLoading: true, messages } },
    )

    // Enable voice mode
    act(() => {
      result.current.toggleVoiceMode()
    })

    // Simulate loading -> not loading transition
    rerender({ isLoading: false, messages })

    expect(mockTTS.speak).toHaveBeenCalledWith('Response text', 'msg-1')
    expect(mockTTS.onEnd).toHaveBeenCalled()
  })

  it('does NOT auto-TTS when voice mode is off', () => {
    const messages = [{ id: 'msg-1', role: 'assistant', content: 'Response text' }]

    const { rerender } = renderHook(
      ({ isLoading, messages: msgs }) =>
        useChatVoice(vi.fn(), isLoading, msgs, vi.fn(), '', { current: null }),
      { initialProps: { isLoading: true, messages } },
    )

    // Do NOT enable voice mode
    rerender({ isLoading: false, messages })

    expect(mockTTS.speak).not.toHaveBeenCalled()
  })

  it('cleans up TTS and STT on unmount', () => {
    const args = makeArgs()
    const { unmount } = renderHook(() =>
      useChatVoice(args.sendMessage, args.isLoading, args.messages, args.setInput, args.input, args.textareaRef),
    )

    unmount()

    expect(mockTTS.stop).toHaveBeenCalled()
    expect(mockSTT.stop).toHaveBeenCalled()
  })
})
