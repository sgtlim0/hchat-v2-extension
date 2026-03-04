import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isVoiceSupported,
  getDefaultVoicePipelineConfig,
  createVoicePipeline,
  speakText,
  stopSpeaking,
  getAvailableVoices,
} from '../voicePipeline'
import type { VoicePipelineConfig } from '../voicePipeline'

// --- Mocks ---

function createMockRecognition() {
  const instance = {
    lang: '',
    continuous: false,
    interimResults: false,
    onresult: null as ((event: unknown) => void) | null,
    onend: null as (() => void) | null,
    onerror: null as ((event: unknown) => void) | null,
    start: vi.fn(),
    stop: vi.fn(() => {
      setTimeout(() => instance.onend?.(), 0)
    }),
    abort: vi.fn(),
  }
  return instance
}

let mockRecognitionInstance: ReturnType<typeof createMockRecognition>

function createMockSpeechSynthesis() {
  return {
    speak: vi.fn(function (utterance: { onend?: () => void }) {
      setTimeout(() => utterance.onend?.(), 0)
    }),
    cancel: vi.fn(),
    getVoices: vi.fn(() => [
      { name: 'Korean Voice', lang: 'ko-KR', default: true, localService: true, voiceURI: '' },
      { name: 'English Voice', lang: 'en-US', default: false, localService: true, voiceURI: '' },
      { name: 'Japanese Voice', lang: 'ja-JP', default: false, localService: true, voiceURI: '' },
    ] as unknown as SpeechSynthesisVoice[]),
  }
}

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
  ;(globalThis as any).speechSynthesis = createMockSpeechSynthesis()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).SpeechSynthesisUtterance = vi.fn(function (this: any, text: string) {
    this.text = text
    this.lang = ''
    this.rate = 1
    this.voice = null
    this.onend = null
    this.onerror = null
  })
})

afterEach(() => {
  vi.useRealTimers()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).webkitSpeechRecognition
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).SpeechRecognition
})

// --- Tests ---

describe('isVoiceSupported', () => {
  it('returns true when both APIs exist', () => {
    expect(isVoiceSupported()).toBe(true)
  })

  it('returns false when SpeechRecognition is missing', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).webkitSpeechRecognition
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).SpeechRecognition
    expect(isVoiceSupported()).toBe(false)
  })
})

describe('getDefaultVoicePipelineConfig', () => {
  it('returns correct defaults', () => {
    const config = getDefaultVoicePipelineConfig()

    expect(config.language).toBe('ko-KR')
    expect(config.autoListen).toBe(true)
    expect(config.ttsRate).toBe(1.0)
    expect(config.silenceTimeout).toBe(2000)
    expect(config.maxListenDuration).toBe(30000)
  })
})

describe('createVoicePipeline', () => {
  it('returns session object with all methods', () => {
    const session = createVoicePipeline(makeConfig())

    expect(typeof session.start).toBe('function')
    expect(typeof session.stop).toBe('function')
    expect(typeof session.pause).toBe('function')
    expect(typeof session.resume).toBe('function')
    expect(typeof session.getState).toBe('function')
    expect(typeof session.getTranscript).toBe('function')
    expect(typeof session.isSupported).toBe('function')
  })
})

describe('state transitions', () => {
  it('start transitions from idle to listening', () => {
    const session = createVoicePipeline(makeConfig())

    expect(session.getState()).toBe('idle')
    session.start()
    expect(session.getState()).toBe('listening')
  })

  it('stop transitions to idle from any state', () => {
    const session = createVoicePipeline(makeConfig())
    session.start()
    expect(session.getState()).toBe('listening')

    session.stop()
    expect(session.getState()).toBe('idle')
  })

  it('pause transitions from listening to idle', () => {
    const session = createVoicePipeline(makeConfig())
    session.start()
    expect(session.getState()).toBe('listening')

    session.pause()
    expect(session.getState()).toBe('idle')
  })

  it('resume transitions from idle to listening', () => {
    const session = createVoicePipeline(makeConfig())
    session.start()
    session.pause()
    expect(session.getState()).toBe('idle')

    session.resume()
    expect(session.getState()).toBe('listening')
  })
})

describe('onStateChange callback', () => {
  it('fires when state changes', () => {
    const onStateChange = vi.fn()
    const session = createVoicePipeline(makeConfig({ onStateChange }))

    session.start()
    expect(onStateChange).toHaveBeenCalledWith('listening')
  })

  it('fires on stop', () => {
    const onStateChange = vi.fn()
    const session = createVoicePipeline(makeConfig({ onStateChange }))

    session.start()
    onStateChange.mockClear()

    session.stop()
    expect(onStateChange).toHaveBeenCalledWith('idle')
  })
})

describe('onTranscript callback', () => {
  it('fires with interim results', () => {
    const onTranscript = vi.fn()
    const session = createVoicePipeline(makeConfig({ onTranscript }))
    session.start()

    const event = {
      results: [
        { 0: { transcript: '안녕하' }, isFinal: false, length: 1 },
      ],
      length: 1,
    }
    mockRecognitionInstance.onresult?.(event)

    expect(onTranscript).toHaveBeenCalledWith('안녕하', false)
  })

  it('fires with final results and updates transcript', () => {
    const onTranscript = vi.fn()
    const session = createVoicePipeline(makeConfig({ onTranscript }))
    session.start()

    const event = {
      results: [
        { 0: { transcript: '안녕하세요' }, isFinal: true, length: 1 },
      ],
      length: 1,
    }
    mockRecognitionInstance.onresult?.(event)

    expect(onTranscript).toHaveBeenCalledWith('안녕하세요', true)
    expect(session.getTranscript()).toBe('안녕하세요')
  })
})

describe('silenceTimeout', () => {
  it('auto-stops listening after silence timeout', () => {
    const session = createVoicePipeline(makeConfig({ silenceTimeout: 1000 }))
    session.start()
    expect(session.getState()).toBe('listening')

    vi.advanceTimersByTime(1000)

    expect(mockRecognitionInstance.stop).toHaveBeenCalled()
  })
})

describe('speakText', () => {
  it('creates utterance with correct language and rate', async () => {
    const promise = speakText('Hello', { language: 'en-US', ttsRate: 1.5 })

    // Flush the setTimeout in mock speak
    vi.advanceTimersByTime(1)
    await promise

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor = (globalThis as any).SpeechSynthesisUtterance
    expect(Ctor).toHaveBeenCalledWith('Hello')
    expect(speechSynthesis.speak).toHaveBeenCalled()
  })

  it('resolves immediately for empty text', async () => {
    const promise = speakText('  ', { language: 'ko-KR', ttsRate: 1.0 })
    await promise

    expect(speechSynthesis.speak).not.toHaveBeenCalled()
  })
})

describe('stopSpeaking', () => {
  it('calls speechSynthesis.cancel()', () => {
    stopSpeaking()
    expect(speechSynthesis.cancel).toHaveBeenCalled()
  })
})

describe('getAvailableVoices', () => {
  it('returns all voices when no language specified', () => {
    const voices = getAvailableVoices()
    expect(voices).toHaveLength(3)
  })

  it('filters voices by language prefix', () => {
    const koVoices = getAvailableVoices('ko-KR')
    expect(koVoices).toHaveLength(1)
    expect(koVoices[0].name).toBe('Korean Voice')

    const enVoices = getAvailableVoices('en-US')
    expect(enVoices).toHaveLength(1)
    expect(enVoices[0].name).toBe('English Voice')
  })
})

describe('session.isSupported', () => {
  it('reflects browser capability', () => {
    const session = createVoicePipeline(makeConfig())
    expect(session.isSupported()).toBe(true)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).webkitSpeechRecognition
    expect(session.isSupported()).toBe(false)
  })
})

describe('error handling', () => {
  it('reports microphone permission denied', () => {
    const onError = vi.fn()
    const session = createVoicePipeline(makeConfig({ onError }))
    session.start()

    mockRecognitionInstance.onerror?.({ error: 'not-allowed' })

    expect(onError).toHaveBeenCalledWith('Microphone permission denied')
    expect(session.getState()).toBe('idle')
  })
})
