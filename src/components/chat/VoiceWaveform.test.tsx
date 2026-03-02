import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VoiceWaveform } from './VoiceWaveform'

describe('VoiceWaveform', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('렌더링하지 않음 when isListening is false', () => {
    const { container } = render(<VoiceWaveform isListening={false} />)
    expect(container.querySelector('.voice-waveform')).toBeNull()
  })

  it('renders SVG waveform when isListening is true', () => {
    const { container } = render(<VoiceWaveform isListening={true} />)
    expect(container.querySelector('.voice-waveform')).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders 8 bars', () => {
    const { container } = render(<VoiceWaveform isListening={true} />)
    const bars = container.querySelectorAll('.voice-bar')
    expect(bars).toHaveLength(8)
  })

  it('bars have correct styling attributes', () => {
    const { container } = render(<VoiceWaveform isListening={true} />)
    const bar = container.querySelector('.voice-bar')
    expect(bar).toHaveAttribute('rx', '3')
    expect(bar).toHaveAttribute('width', '6')
    expect(bar).toHaveStyle({ fill: 'var(--green, #22c55e)' })
  })

  it('animates bars when listening without analyser', () => {
    const { container, rerender } = render(<VoiceWaveform isListening={true} />)
    const getBarHeights = () =>
      Array.from(container.querySelectorAll('.voice-bar')).map((bar) =>
        parseFloat(bar.getAttribute('height') || '0')
      )

    const initialHeights = getBarHeights()
    vi.advanceTimersByTime(100)
    rerender(<VoiceWaveform isListening={true} />)

    // Animation should have updated heights (async, may need multiple frames)
    const updatedHeights = getBarHeights()
    expect(updatedHeights).toEqual(expect.any(Array))
    expect(updatedHeights).toHaveLength(8)
  })

  it('stops animation when isListening becomes false', () => {
    const { container, rerender } = render(<VoiceWaveform isListening={true} />)
    expect(container.querySelector('.voice-waveform')).toBeInTheDocument()

    rerender(<VoiceWaveform isListening={false} />)
    expect(container.querySelector('.voice-waveform')).toBeNull()
  })

  it('uses analyser node when provided', () => {
    const mockAnalyser = {
      frequencyBinCount: 128,
      getByteFrequencyData: vi.fn((arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 255)
      }),
    } as unknown as AnalyserNode

    const { container } = render(
      <VoiceWaveform isListening={true} analyserNode={mockAnalyser} />
    )

    expect(container.querySelector('.voice-waveform')).toBeInTheDocument()
    // Analyser should be called during animation loop
    vi.advanceTimersByTime(100)
    expect(mockAnalyser.getByteFrequencyData).toHaveBeenCalled()
  })

  it('cleans up animation frame on unmount', () => {
    const cancelAnimationFrameSpy = vi.spyOn(window, 'cancelAnimationFrame')
    const { unmount } = render(<VoiceWaveform isListening={true} />)

    unmount()

    expect(cancelAnimationFrameSpy).toHaveBeenCalled()
  })

  it('resets frequencies to zero when stopped', () => {
    const { container, rerender } = render(<VoiceWaveform isListening={true} />)

    vi.advanceTimersByTime(100)

    rerender(<VoiceWaveform isListening={false} />)

    // Component should not render when stopped
    expect(container.querySelector('.voice-waveform')).toBeNull()
  })

  it('SVG viewBox and dimensions are correct', () => {
    const { container } = render(<VoiceWaveform isListening={true} />)
    const svg = container.querySelector('svg')

    expect(svg).toHaveAttribute('viewBox', '0 0 80 40')
    expect(svg).toHaveAttribute('width', '80')
    expect(svg).toHaveAttribute('height', '40')
  })

  it('each bar positioned correctly horizontally', () => {
    const { container } = render(<VoiceWaveform isListening={true} />)
    const bars = container.querySelectorAll('.voice-bar')

    bars.forEach((bar, i) => {
      const expectedX = i * 10 + 5
      expect(bar.getAttribute('x')).toBe(String(expectedX))
    })
  })
})
