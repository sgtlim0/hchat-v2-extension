import { useState, useCallback } from 'react'
import { detectPII, getGuardrailConfig, type PIIDetection } from '../lib/guardrail'

export function usePIIGuardrail(sendMessage: (text: string) => Promise<void>) {
  const [piiDetections, setPiiDetections] = useState<PIIDetection[]>([])
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)

  const checkPII = useCallback(async (text: string): Promise<boolean> => {
    const guardrailConfig = await getGuardrailConfig()
    if (guardrailConfig.enabled) {
      const detections = detectPII(text, guardrailConfig)
      if (detections.length > 0) {
        setPiiDetections(detections)
        setPendingMessage(text)
        return true
      }
    }
    return false
  }, [])

  const confirmSendWithPII = useCallback(async (action: 'send' | 'mask' | 'cancel') => {
    if (!pendingMessage) return

    if (action === 'cancel') {
      setPendingMessage(null)
      setPiiDetections([])
      return
    }

    const finalText = action === 'mask'
      ? piiDetections.reduce((text, detection) => {
          return text.slice(0, detection.start) + detection.masked + text.slice(detection.end)
        }, pendingMessage)
      : pendingMessage

    setPendingMessage(null)
    setPiiDetections([])

    await sendMessage(finalText)
  }, [pendingMessage, piiDetections, sendMessage])

  return { piiDetections, pendingMessage, checkPII, confirmSendWithPII }
}
