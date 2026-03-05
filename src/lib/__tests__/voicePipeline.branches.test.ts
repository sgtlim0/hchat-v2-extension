import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createVoicePipeline,
  speakText,
  getAvailableVoices,
  isVoiceSupported,
  stopSpeaking,
} from '../voicePipeline'
import type { VoicePipelineConfig } from '../voicePipeline'

function createMockRecognition() {
  const instance = {
    lang: '',
    continuous: false,
    interimResults: false,
    onresult: null as ((event: unknown) => void) | null,
    onend: null as (() => void) | null,
    onerror: null as ((event: unknown) => void) | null,
    start: vi.fn(),
    stop: vi.fn(() => { setTimeout(() => instance.onend?.(), 0) }),
    abort: vi.fn(),
  }
  return instance
}

let mockRecognitionInstance: ReturnType<typeof createMockRecognition>

function makeConfig(overrides?: Partial<VoicePipelineConfig>): VoicePipelineConfig {
  return {
    language: 'ko-KR',
    autoListen: false,
    ttsRate: 1.0,
    silenceTimeout: 2000,
    maxListenDuration: 30000,
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  mockRecognitionInstance = createMockRecognition()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).webkitSpeechRecognition = vi.fn(function () { return mockRecognitionInstance })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).speechSynthesis = {
    speak: vi.fn((u: { onend?: () => void }) => { setTimeout(() => u.onend?.(), 0) }),
    cancel: vi.fn(),
    getVoices: vi.fn(() => [
      { name: 'Korean', lang: 'ko-KR', default: true, localService: true, voiceURI: '' },
      { name: 'English', lang: 'en-US', default: false, localService: true, voiceURI: '' },
    ] as unknown as SpeechSynthesisVoice[]),
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).SpeechSynthesisUtterance = vi.fn(function (this: any, text: string) {
    this.text = text; this.lang = ''; this.rate = 1; this.voice = null; this.onend = null; this.onerror = null
  })
})

afterEach(() => {
  vi.useRealTimers()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).webkitSpeechRecognition
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).SpeechRecognition
})

describe('voicePipeline branch coverage', () => {
  describe('start ignores if not idle', () => {
    it('does nothing when already listening', () => {
      const session = createVoicePipeline(makeConfig())
      session.start()
      expect(session.getState()).toBe('listening')
      session.start() // second call should be ignored
      expect(session.getState()).toBe('listening')
    })
  })

  describe('pause ignores if not listening', () => {
    it('does nothing when idle', () => {
      const session = createVoicePipeline(makeConfig())
      session.pause()
      expect(session.getState()).toBe('idle')
    })
  })

  describe('resume ignores if not idle', () => {
    it('does nothing when listening', () => {
      const session = createVoicePipeline(makeConfig())
      session.start()
      session.resume() // already listening
      expect(session.getState()).toBe('listening')
    })
  })

  describe('recognition error handling', () => {
    it('handles aborted error', () => {
      const onError = vi.fn()
      const session = createVoicePipeline(makeConfig({ onError }))
      session.start()

      mockRecognitionInstance.onerror?.({ error: 'aborted' })
      expect(session.getState()).toBe('idle')
      expect(onError).not.toHaveBeenCalled()
    })

    it('handles no-speech error', () => {
      const onError = vi.fn()
      const session = createVoicePipeline(makeConfig({ onError }))
      session.start()

      mockRecognitionInstance.onerror?.({ error: 'no-speech' })
      expect(session.getState()).toBe('idle')
      expect(onError).not.toHaveBeenCalled()
    })

    it('handles generic speech error', () => {
      const onError = vi.fn()
      const session = createVoicePipeline(makeConfig({ onError }))
      session.start()

      mockRecognitionInstance.onerror?.({ error: 'audio-capture' })
      expect(session.getState()).toBe('idle')
      expect(onError).toHaveBeenCalledWith('Speech recognition error: audio-capture')
    })
  })

  describe('onend transitions to processing', () => {
    it('transitions to processing when onend fires while listening', () => {
      const onStateChange = vi.fn()
      const session = createVoicePipeline(makeConfig({ onStateChange }))
      session.start()
      expect(session.getState()).toBe('listening')

      mockRecognitionInstance.onend?.()
      expect(session.getState()).toBe('processing')
    })
  })

  describe('maxListenDuration timeout', () => {
    it('stops recognition after maxListenDuration', () => {
      const session = createVoicePipeline(makeConfig({ maxListenDuration: 5000 }))
      session.start()

      vi.advanceTimersByTime(5000)
      expect(mockRecognitionInstance.stop).toHaveBeenCalled()
    })
  })

  describe('recognition start failure', () => {
    it('handles start() throwing', () => {
      mockRecognitionInstance.start.mockImplementation(function () { throw new Error('Already started') })
      const onError = vi.fn()
      const session = createVoicePipeline(makeConfig({ onError }))
      session.start()

      expect(onError).toHaveBeenCalledWith('Already started')
      expect(session.getState()).toBe('idle')
    })

    it('handles non-Error throw', () => {
      mockRecognitionInstance.start.mockImplementation(function () { throw 'string error' })
      const onError = vi.fn()
      const session = createVoicePipeline(makeConfig({ onError }))
      session.start()

      expect(onError).toHaveBeenCalledWith('Failed to start recognition')
      expect(session.getState()).toBe('idle')
    })
  })

  describe('recognition not supported', () => {
    it('reports error when no SpeechRecognition constructor', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).webkitSpeechRecognition
      const onError = vi.fn()
      const session = createVoicePipeline(makeConfig({ onError }))
      session.start()

      expect(onError).toHaveBeenCalledWith('Speech recognition is not supported')
      expect(session.getState()).toBe('idle')
    })
  })

  describe('speakText edge cases', () => {
    it('clamps rate to min 0.5', async () => {
      const promise = speakText('Hello', { language: 'ko-KR', ttsRate: 0.1 })
      vi.advanceTimersByTime(1)
      await promise

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const instance = (globalThis as any).SpeechSynthesisUtterance.mock.results[0].value
      expect(instance.rate).toBe(0.5)
    })

    it('clamps rate to max 2.0', async () => {
      const promise = speakText('Hello', { language: 'ko-KR', ttsRate: 5.0 })
      vi.advanceTimersByTime(1)
      await promise

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const instance = (globalThis as any).SpeechSynthesisUtterance.mock.results[0].value
      expect(instance.rate).toBe(2.0)
    })

    it('matches voice by name', async () => {
      const promise = speakText('Hello', { language: 'ko-KR', ttsRate: 1.0, ttsVoice: 'Korean' })
      vi.advanceTimersByTime(1)
      await promise

      expect(speechSynthesis.speak).toHaveBeenCalled()
    })

    it('ignores non-matching voice name', async () => {
      const promise = speakText('Hello', { language: 'ko-KR', ttsRate: 1.0, ttsVoice: 'NonExistent' })
      vi.advanceTimersByTime(1)
      await promise

      expect(speechSynthesis.speak).toHaveBeenCalled()
    })

    it('rejects on TTS error', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(globalThis as any).speechSynthesis.speak = vi.fn((u: any) => {
        setTimeout(() => u.onerror?.({ error: 'synthesis-unavailable' }), 0)
      })

      const promise = speakText('Hello', { language: 'ko-KR', ttsRate: 1.0 })
      vi.advanceTimersByTime(1)
      await expect(promise).rejects.toThrow('TTS error: synthesis-unavailable')
    })

    it('resolves on canceled/interrupted TTS error', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(globalThis as any).speechSynthesis.speak = vi.fn((u: any) => {
        setTimeout(() => u.onerror?.({ error: 'canceled' }), 0)
      })

      const promise = speakText('Hello', { language: 'ko-KR', ttsRate: 1.0 })
      vi.advanceTimersByTime(1)
      await promise // should not reject
    })

    it('rejects when speechSynthesis not supported', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).speechSynthesis
      await expect(speakText('Hello', { language: 'ko-KR', ttsRate: 1.0 })).rejects.toThrow('Speech synthesis is not supported')
    })
  })

  describe('getAvailableVoices edge cases', () => {
    it('returns empty when speechSynthesis not available', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).speechSynthesis
      expect(getAvailableVoices()).toEqual([])
    })
  })

  describe('stopSpeaking edge case', () => {
    it('does nothing when speechSynthesis not available', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).speechSynthesis
      expect(() => stopSpeaking()).not.toThrow()
    })
  })

  describe('isVoiceSupported without speechSynthesis', () => {
    it('returns false when speechSynthesis missing', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).speechSynthesis
      expect(isVoiceSupported()).toBe(false)
    })
  })

  describe('silence timer reset on result', () => {
    it('resets silence timer when speech result received', () => {
      const session = createVoicePipeline(makeConfig({ silenceTimeout: 1000 }))
      session.start()

      // Advance 800ms
      vi.advanceTimersByTime(800)

      // Fire a result event (resets timer)
      mockRecognitionInstance.onresult?.({
        results: [{ 0: { transcript: 'test' }, isFinal: false, length: 1 }],
        length: 1,
      })

      // Advance another 800ms (total 1600ms, but timer was reset at 800ms)
      vi.advanceTimersByTime(800)
      expect(mockRecognitionInstance.stop).not.toHaveBeenCalled()

      // Advance to exceed new timeout
      vi.advanceTimersByTime(200)
      expect(mockRecognitionInstance.stop).toHaveBeenCalled()
    })
  })

  describe('stop clears transcript', () => {
    it('clears transcript on stop', () => {
      const session = createVoicePipeline(makeConfig())
      session.start()

      mockRecognitionInstance.onresult?.({
        results: [{ 0: { transcript: 'hello' }, isFinal: true, length: 1 }],
        length: 1,
      })
      expect(session.getTranscript()).toBe('hello')

      session.stop()
      expect(session.getTranscript()).toBe('')
    })
  })
})
