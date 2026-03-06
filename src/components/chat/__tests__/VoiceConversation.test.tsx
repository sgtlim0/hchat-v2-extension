import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { VoiceConversation } from '../VoiceConversation'
import { setupI18nMock } from '../../../test/mocks/i18n'
import type { VoicePipelineOptions, VoiceState } from '../../../lib/voicePipeline'

// Mock voicePipeline module
const mockPipeline = {
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  getState: vi.fn().mockReturnValue('idle' as VoiceState),
}

let mockCallbacks: VoicePipelineOptions | null = null

vi.mock('../../../lib/voicePipeline', () => ({
  createVoicePipeline: vi.fn((opts: VoicePipelineOptions) => {
    mockCallbacks = opts
    return mockPipeline
  }),
}))

// Mock VoiceWaveform component
vi.mock('../VoiceWaveform', () => ({
  VoiceWaveform: vi.fn(({ isActive }) => (
    <div data-testid="voice-waveform" data-active={isActive}>
      Voice Waveform
    </div>
  )),
}))

describe('VoiceConversation', () => {
  const mockOnClose = vi.fn()
  const mockSendMessage = vi.fn().mockResolvedValue('AI response')

  beforeEach(() => {
    setupI18nMock()
    vi.clearAllMocks()
    mockCallbacks = null
    mockPipeline.getState.mockReturnValue('idle')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('초기 렌더링 시 음성 대화 UI를 표시한다', () => {
    render(
      <VoiceConversation
        onClose={mockOnClose}
        sendMessage={mockSendMessage}
      />
    )

    expect(screen.getByText('음성 대화')).toBeInTheDocument()
    expect(screen.getByTestId('voice-waveform')).toBeInTheDocument()
  })

  it('컴포넌트 마운트 시 voicePipeline.start()를 호출한다', () => {
    render(
      <VoiceConversation
        onClose={mockOnClose}
        sendMessage={mockSendMessage}
      />
    )

    expect(mockPipeline.start).toHaveBeenCalled()
  })

  it('listening 상태일 때 "듣는 중" 텍스트를 표시한다', async () => {
    mockPipeline.getState.mockReturnValue('listening')

    render(
      <VoiceConversation
        onClose={mockOnClose}
        sendMessage={mockSendMessage}
      />
    )

    // Trigger state change callback
    if (mockCallbacks) {
      mockCallbacks.onStateChange('listening')
    }

    await waitFor(() => {
      expect(screen.getByText('듣는 중...')).toBeInTheDocument()
    })
  })

  it('thinking 상태일 때 "생각 중" 텍스트를 표시한다', async () => {
    mockPipeline.getState.mockReturnValue('thinking')

    render(
      <VoiceConversation
        onClose={mockOnClose}
        sendMessage={mockSendMessage}
      />
    )

    if (mockCallbacks) {
      mockCallbacks.onStateChange('thinking')
    }

    await waitFor(() => {
      expect(screen.getByText('생각 중...')).toBeInTheDocument()
    })
  })

  it('speaking 상태일 때 "말하는 중" 텍스트를 표시한다', async () => {
    mockPipeline.getState.mockReturnValue('speaking')

    render(
      <VoiceConversation
        onClose={mockOnClose}
        sendMessage={mockSendMessage}
      />
    )

    if (mockCallbacks) {
      mockCallbacks.onStateChange('speaking')
    }

    await waitFor(() => {
      expect(screen.getByText('말하는 중...')).toBeInTheDocument()
    })
  })

  it('일시정지 버튼 클릭 시 pipeline.pause()를 호출한다', async () => {
    mockPipeline.getState.mockReturnValue('listening')

    render(
      <VoiceConversation
        onClose={mockOnClose}
        sendMessage={mockSendMessage}
      />
    )

    if (mockCallbacks) {
      mockCallbacks.onStateChange('listening')
    }

    await waitFor(() => {
      expect(screen.getByText('일시정지')).toBeInTheDocument()
    })

    const pauseButton = screen.getByText('일시정지')
    fireEvent.click(pauseButton)

    expect(mockPipeline.pause).toHaveBeenCalled()
  })

  it('계속 버튼 클릭 시 pipeline.resume()을 호출한다', async () => {
    mockPipeline.getState.mockReturnValue('paused')

    render(
      <VoiceConversation
        onClose={mockOnClose}
        sendMessage={mockSendMessage}
      />
    )

    if (mockCallbacks) {
      mockCallbacks.onStateChange('paused')
    }

    await waitFor(() => {
      const resumeButton = screen.getByText('계속')
      fireEvent.click(resumeButton)
    })

    expect(mockPipeline.resume).toHaveBeenCalled()
  })

  it('종료 버튼 클릭 시 pipeline.stop()과 onClose 콜백을 호출한다', () => {
    render(
      <VoiceConversation
        onClose={mockOnClose}
        sendMessage={mockSendMessage}
      />
    )

    const endButton = screen.getByText('대화 종료')
    fireEvent.click(endButton)

    expect(mockPipeline.stop).toHaveBeenCalled()
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('대화 로그에 사용자 발화를 표시한다', async () => {
    render(
      <VoiceConversation
        onClose={mockOnClose}
        sendMessage={mockSendMessage}
      />
    )

    const userText = 'Hello, how are you?'

    if (mockCallbacks) {
      mockCallbacks.onTranscript(userText)
    }

    await waitFor(() => {
      const logItems = screen.getAllByTestId('conversation-log-item')
      expect(logItems[0]).toHaveTextContent(userText)
      expect(logItems[0]).toHaveAttribute('data-role', 'user')
    })
  })

  it('대화 로그에 AI 응답을 표시한다', async () => {
    render(
      <VoiceConversation
        onClose={mockOnClose}
        sendMessage={mockSendMessage}
      />
    )

    const aiResponse = 'I am doing well, thank you!'

    if (mockCallbacks) {
      mockCallbacks.onAIResponse(aiResponse)
    }

    await waitFor(() => {
      const logItems = screen.getAllByTestId('conversation-log-item')
      const aiItem = Array.from(logItems).find(
        item => item.getAttribute('data-role') === 'assistant'
      )
      expect(aiItem).toHaveTextContent(aiResponse)
    })
  })

  it('에러 발생 시 에러 메시지를 표시한다', async () => {
    render(
      <VoiceConversation
        onClose={mockOnClose}
        sendMessage={mockSendMessage}
      />
    )

    const errorMessage = 'Microphone access denied'

    if (mockCallbacks) {
      mockCallbacks.onError(errorMessage)
    }

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
      expect(screen.getByText(errorMessage).closest('.error')).toBeInTheDocument()
    })
  })

  it('언마운트 시 pipeline.stop()을 호출한다', () => {
    const { unmount } = render(
      <VoiceConversation
        onClose={mockOnClose}
        sendMessage={mockSendMessage}
      />
    )

    unmount()

    expect(mockPipeline.stop).toHaveBeenCalled()
  })
})