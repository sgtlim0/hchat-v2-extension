// lib/tts.ts — Text-to-Speech using Web Speech API

export interface TTSState {
  speaking: boolean
  paused: boolean
  msgId: string | null
}

let currentUtterance: SpeechSynthesisUtterance | null = null
let currentMsgId: string | null = null
let onStateChange: ((state: TTSState) => void) | null = null

function getState(): TTSState {
  return {
    speaking: speechSynthesis.speaking,
    paused: speechSynthesis.paused,
    msgId: currentMsgId,
  }
}

function notify(): void {
  onStateChange?.(getState())
}

export const TTS = {
  speak(text: string, msgId: string, lang = 'ko-KR'): void {
    this.stop()

    // Strip markdown-like syntax for cleaner speech
    const clean = text
      .replace(/```[\s\S]*?```/g, '코드 블록')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/^#+\s/gm, '')
      .replace(/^[-*]\s/gm, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ')
      .trim()

    if (!clean) return

    currentMsgId = msgId
    currentUtterance = new SpeechSynthesisUtterance(clean)
    currentUtterance.lang = lang
    currentUtterance.rate = 1.0
    currentUtterance.pitch = 1.0

    // Try to find a Korean voice
    const voices = speechSynthesis.getVoices()
    const koVoice = voices.find((v) => v.lang.startsWith('ko'))
    if (koVoice) currentUtterance.voice = koVoice

    currentUtterance.onend = () => {
      currentMsgId = null
      currentUtterance = null
      notify()
    }
    currentUtterance.onerror = () => {
      currentMsgId = null
      currentUtterance = null
      notify()
    }

    speechSynthesis.speak(currentUtterance)
    notify()
  },

  pause(): void {
    if (speechSynthesis.speaking && !speechSynthesis.paused) {
      speechSynthesis.pause()
      notify()
    }
  },

  resume(): void {
    if (speechSynthesis.paused) {
      speechSynthesis.resume()
      notify()
    }
  },

  stop(): void {
    speechSynthesis.cancel()
    currentMsgId = null
    currentUtterance = null
    notify()
  },

  isPlaying(msgId: string): boolean {
    return currentMsgId === msgId && speechSynthesis.speaking
  },

  isPaused(msgId: string): boolean {
    return currentMsgId === msgId && speechSynthesis.paused
  },

  onStateChange(cb: (state: TTSState) => void): void {
    onStateChange = cb
  },

  getState,
}
