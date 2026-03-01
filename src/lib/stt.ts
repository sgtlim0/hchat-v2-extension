/** Speech-to-Text using Web Speech Recognition API */

type STTCallback = (text: string, isFinal: boolean) => void
type STTStateCallback = (state: STTState) => void

export type STTState = 'idle' | 'listening' | 'error'

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent {
  error: string
  message: string
}

let recognition: SpeechRecognition | null = null
let currentState: STTState = 'idle'
let stateCallback: STTStateCallback = () => {}

function getRecognition(): SpeechRecognition | null {
  if (recognition) return recognition
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognition) return null
  recognition = new SpeechRecognition()
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = 'ko-KR'
  return recognition
}

function setState(state: STTState) {
  currentState = state
  stateCallback(state)
}

export const STT = {
  isSupported(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  },

  start(onResult: STTCallback): void {
    const rec = getRecognition()
    if (!rec) {
      setState('error')
      return
    }

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = ''
      let final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript
        if (e.results[i].isFinal) {
          final += transcript
        } else {
          interim += transcript
        }
      }
      if (final) onResult(final, true)
      else if (interim) onResult(interim, false)
    }

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'aborted' || e.error === 'no-speech') return
      setState('error')
    }

    rec.onend = () => {
      setState('idle')
    }

    try {
      rec.start()
      setState('listening')
    } catch {
      setState('error')
    }
  },

  stop(): void {
    const rec = getRecognition()
    if (!rec) return
    try {
      rec.stop()
    } catch {
      // ignore
    }
    setState('idle')
  },

  getState(): STTState {
    return currentState
  },

  onStateChange(cb: STTStateCallback): void {
    stateCallback = cb
  },

  setLanguage(lang: string): void {
    const rec = getRecognition()
    if (rec) rec.lang = lang
  },
}

/** Extend Window interface for webkit prefix */
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}
