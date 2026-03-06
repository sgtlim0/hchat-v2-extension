import { useEffect, useRef, useState, useCallback } from 'react'
import { createVoicePipeline, type VoiceState } from '../../lib/voicePipeline'
import { VoiceWaveform } from './VoiceWaveform'
import { useLocale } from '../../i18n'

interface VoiceConversationProps {
  onClose: () => void
  sendMessage: (text: string) => Promise<string>
}

interface ConversationLogItem {
  id: string
  role: 'user' | 'assistant'
  text: string
  timestamp: number
}

export function VoiceConversation({ onClose, sendMessage }: VoiceConversationProps) {
  const { t } = useLocale()
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [conversationLog, setConversationLog] = useState<ConversationLogItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [silenceCountdown, setSilenceCountdown] = useState<number | null>(null)
  const pipelineRef = useRef<ReturnType<typeof createVoicePipeline> | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize voice pipeline on mount
  useEffect(() => {
    const pipeline = createVoicePipeline({
      onTranscript: (text: string) => {
        setConversationLog(prev => [
          ...prev,
          {
            id: `user-${Date.now()}`,
            role: 'user',
            text,
            timestamp: Date.now(),
          }
        ])
        setError(null)
      },
      onAIResponse: (text: string) => {
        setConversationLog(prev => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            text,
            timestamp: Date.now(),
          }
        ])
      },
      onStateChange: (state: VoiceState) => {
        setVoiceState(state)

        // Handle silence countdown
        if (state === 'listening') {
          setSilenceCountdown(3)
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current)
          }
          countdownIntervalRef.current = setInterval(() => {
            setSilenceCountdown(prev => {
              if (prev === null || prev <= 0) {
                if (countdownIntervalRef.current) {
                  clearInterval(countdownIntervalRef.current)
                }
                return null
              }
              return prev - 1
            })
          }, 1000)
        } else {
          setSilenceCountdown(null)
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current)
          }
        }
      },
      onError: (errorMessage: string) => {
        setError(errorMessage)
      },
      sendMessage,
      silenceTimeout: 3000,
    })

    pipelineRef.current = pipeline
    pipeline.start()

    // Cleanup on unmount
    return () => {
      pipeline.stop()
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
    }
  }, [sendMessage])

  const handlePause = useCallback(() => {
    pipelineRef.current?.pause()
  }, [])

  const handleResume = useCallback(() => {
    pipelineRef.current?.resume()
  }, [])

  const handleEnd = useCallback(() => {
    pipelineRef.current?.stop()
    onClose()
  }, [onClose])

  const getStateText = () => {
    switch (voiceState) {
      case 'listening':
        return t('voice.listening')
      case 'thinking':
        return t('voice.thinking')
      case 'speaking':
        return t('voice.speaking')
      case 'paused':
        return t('voice.pause')
      default:
        return ''
    }
  }

  return (
    <div className="voice-conversation">
      <div className="voice-header">
        <h2>{t('voice.conversation')}</h2>
        <button
          className="btn-secondary"
          onClick={handleEnd}
        >
          {t('voice.endConversation')}
        </button>
      </div>

      <div className="voice-visualization">
        <VoiceWaveform isActive={voiceState !== 'idle' && voiceState !== 'paused'} />
        <div className="voice-state">
          {getStateText()}
          {silenceCountdown !== null && (
            <span className="silence-countdown"> ({silenceCountdown}s)</span>
          )}
        </div>
      </div>

      <div className="voice-controls">
        {voiceState === 'paused' ? (
          <button
            className="btn-primary"
            onClick={handleResume}
          >
            {t('voice.resume')}
          </button>
        ) : (
          <button
            className="btn-secondary"
            onClick={handlePause}
            disabled={voiceState === 'idle'}
          >
            {t('voice.pause')}
          </button>
        )}
      </div>

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      <div className="conversation-log">
        <h3>{t('voice.conversationLog')}</h3>
        <div className="log-items">
          {conversationLog.map(item => (
            <div
              key={item.id}
              className={`log-item log-item-${item.role}`}
              data-testid="conversation-log-item"
              data-role={item.role}
            >
              <span className="log-role">
                {item.role === 'user' ? t('common.me') : 'AI'}:
              </span>
              <span className="log-text">{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}