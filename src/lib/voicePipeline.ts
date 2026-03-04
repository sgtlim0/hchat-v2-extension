// voicePipeline.ts — Voice conversation E2E pipeline (STT -> AI -> TTS loop)

export type VoicePipelineState = 'idle' | 'listening' | 'processing' | 'speaking'

export interface VoicePipelineConfig {
  language: string
  autoListen: boolean
  ttsRate: number
  ttsVoice?: string
  silenceTimeout: number
  maxListenDuration: number
  onStateChange?: (state: VoicePipelineState) => void
  onTranscript?: (text: string, isFinal: boolean) => void
  onError?: (error: string) => void
}

export interface VoicePipelineSession {
  start(): void
  stop(): void
  pause(): void
  resume(): void
  getState(): VoicePipelineState
  getTranscript(): string
  isSupported(): boolean
}

const DEFAULT_CONFIG: VoicePipelineConfig = {
  language: 'ko-KR',
  autoListen: true,
  ttsRate: 1.0,
  silenceTimeout: 2000,
  maxListenDuration: 30000,
}

export function getDefaultVoicePipelineConfig(): VoicePipelineConfig {
  return { ...DEFAULT_CONFIG }
}

export function isVoiceSupported(): boolean {
  const hasSpeechRecognition =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  const hasSpeechSynthesis =
    typeof window !== 'undefined' && 'speechSynthesis' in window
  return hasSpeechRecognition && hasSpeechSynthesis
}

export function getAvailableVoices(language?: string): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return []
  }
  const voices = speechSynthesis.getVoices()
  if (!language) {
    return voices
  }
  const langPrefix = language.split('-')[0].toLowerCase()
  return voices.filter((v) => {
    const voiceLangPrefix = v.lang.split('-')[0].toLowerCase()
    return voiceLangPrefix === langPrefix
  })
}

export function speakText(
  text: string,
  config: Pick<VoicePipelineConfig, 'language' | 'ttsRate' | 'ttsVoice'>
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      reject(new Error('Speech synthesis is not supported'))
      return
    }

    if (!text.trim()) {
      resolve()
      return
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = config.language
    utterance.rate = Math.max(0.5, Math.min(2.0, config.ttsRate))

    if (config.ttsVoice) {
      const voices = speechSynthesis.getVoices()
      const match = voices.find((v) => v.name === config.ttsVoice)
      if (match) {
        utterance.voice = match
      }
    }

    utterance.onend = () => resolve()
    utterance.onerror = (event) => {
      if (event.error === 'canceled' || event.error === 'interrupted') {
        resolve()
        return
      }
      reject(new Error(`TTS error: ${event.error}`))
    }

    speechSynthesis.speak(utterance)
  })
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    speechSynthesis.cancel()
  }
}

function getSpeechRecognitionConstructor(): (new () => SpeechRecognition) | null {
  if (typeof window === 'undefined') return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null
}

export function createVoicePipeline(
  config: VoicePipelineConfig
): VoicePipelineSession {
  let state: VoicePipelineState = 'idle'
  let transcript = ''
  let recognition: SpeechRecognition | null = null
  let silenceTimer: ReturnType<typeof setTimeout> | null = null
  let maxDurationTimer: ReturnType<typeof setTimeout> | null = null

  function setState(next: VoicePipelineState): void {
    if (state === next) return
    state = next
    config.onStateChange?.(next)
  }

  function clearTimers(): void {
    if (silenceTimer !== null) {
      clearTimeout(silenceTimer)
      silenceTimer = null
    }
    if (maxDurationTimer !== null) {
      clearTimeout(maxDurationTimer)
      maxDurationTimer = null
    }
  }

  function resetSilenceTimer(): void {
    if (silenceTimer !== null) {
      clearTimeout(silenceTimer)
    }
    silenceTimer = setTimeout(() => {
      if (state === 'listening' && recognition) {
        recognition.stop()
      }
    }, config.silenceTimeout)
  }

  function startRecognition(): void {
    const Ctor = getSpeechRecognitionConstructor()
    if (!Ctor) {
      config.onError?.('Speech recognition is not supported')
      return
    }

    transcript = ''
    recognition = new Ctor()
    recognition.lang = config.language
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      resetSilenceTimer()

      let interim = ''
      let final = ''

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }

      if (final) {
        transcript = final
        config.onTranscript?.(final, true)
      } else if (interim) {
        config.onTranscript?.(interim, false)
      }
    }

    recognition.onend = () => {
      clearTimers()
      if (state === 'listening') {
        setState('processing')
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      clearTimers()

      if (event.error === 'aborted' || event.error === 'no-speech') {
        setState('idle')
        return
      }

      if (event.error === 'not-allowed') {
        config.onError?.('Microphone permission denied')
        setState('idle')
        return
      }

      config.onError?.(`Speech recognition error: ${event.error}`)
      setState('idle')
    }

    try {
      recognition.start()
      setState('listening')

      resetSilenceTimer()

      maxDurationTimer = setTimeout(() => {
        if (state === 'listening' && recognition) {
          recognition.stop()
        }
      }, config.maxListenDuration)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to start recognition'
      config.onError?.(message)
      setState('idle')
    }
  }

  function stopRecognition(): void {
    clearTimers()
    if (recognition) {
      try {
        recognition.stop()
      } catch {
        // Already stopped
      }
      recognition = null
    }
  }

  return {
    start(): void {
      if (state !== 'idle') return
      startRecognition()
    },

    stop(): void {
      stopSpeaking()
      stopRecognition()
      transcript = ''
      setState('idle')
    },

    pause(): void {
      if (state !== 'listening') return
      stopRecognition()
      setState('idle')
    },

    resume(): void {
      if (state !== 'idle') return
      startRecognition()
    },

    getState(): VoicePipelineState {
      return state
    },

    getTranscript(): string {
      return transcript
    },

    isSupported(): boolean {
      return isVoiceSupported()
    },
  }
}
