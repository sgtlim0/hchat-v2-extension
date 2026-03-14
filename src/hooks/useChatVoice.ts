import { useState, useCallback, useRef, useEffect } from 'react'
import { TTS } from '../lib/tts'
import { STT } from '../lib/stt'

export function useChatVoice(
  sendMessage: (text: string) => Promise<void>,
  isLoading: boolean,
  messages: { id: string; role: string; content: string }[],
  setInput: React.Dispatch<React.SetStateAction<string>>,
  input: string,
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
) {
  const [, setTTSRefresh] = useState(0)
  const [, setSTTRefresh] = useState(0)
  const [voiceMode, setVoiceMode] = useState(false)
  const voiceModeRef = useRef(false)
  const prevLoadingRef = useRef(false)

  useEffect(() => {
    TTS.onStateChange(() => setTTSRefresh((n) => n + 1))
    return () => { TTS.stop(); TTS.onStateChange(() => {}) }
  }, [])

  useEffect(() => {
    STT.onStateChange(() => setSTTRefresh((n) => n + 1))
    return () => { STT.stop(); STT.onStateChange(() => {}) }
  }, [])

  const handleTTS = useCallback((msgId: string, text: string) => {
    if (TTS.isPlaying(msgId)) TTS.stop()
    else TTS.speak(text, msgId)
  }, [])

  const handleSTT = useCallback(() => {
    if (STT.getState() === 'listening') {
      STT.stop()
    } else {
      STT.start((text, isFinal) => {
        if (isFinal) setInput((prev) => prev + (prev ? ' ' : '') + text)
      })
    }
  }, [setInput])

  const startVoiceSTT = useCallback(() => {
    STT.start((text, isFinal) => {
      if (isFinal && text.trim()) {
        setInput(text.trim())
      }
    })
  }, [setInput])

  const toggleVoiceMode = useCallback(() => {
    setVoiceMode((prev) => {
      const next = !prev
      voiceModeRef.current = next
      if (next) {
        startVoiceSTT()
      } else {
        STT.stop()
        TTS.stop()
      }
      return next
    })
  }, [startVoiceSTT])

  // Voice mode: auto-TTS last assistant message when response completes
  useEffect(() => {
    const wasLoading = prevLoadingRef.current
    prevLoadingRef.current = isLoading
    if (wasLoading && !isLoading && voiceModeRef.current && messages.length > 0) {
      const lastMsg = messages[messages.length - 1]
      if (lastMsg.role === 'assistant' && lastMsg.content) {
        TTS.onEnd(() => {
          if (voiceModeRef.current) startVoiceSTT()
        })
        TTS.speak(lastMsg.content, lastMsg.id)
      }
    }
  }, [isLoading, messages, startVoiceSTT])

  // Voice mode: auto-send when input is set by STT
  useEffect(() => {
    if (!voiceModeRef.current || !input.trim() || isLoading) return
    if (STT.getState() === 'listening') return
    const text = input.trim()
    const timer = setTimeout(() => {
      if (voiceModeRef.current && text) {
        setInput('')
        if (textareaRef.current) textareaRef.current.style.height = 'auto'
        sendMessage(text)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [input, isLoading, sendMessage, setInput, textareaRef])

  return { voiceMode, toggleVoiceMode, handleTTS, handleSTT }
}
