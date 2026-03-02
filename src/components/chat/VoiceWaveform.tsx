import { useEffect, useRef, useState } from 'react'

interface VoiceWaveformProps {
  isListening: boolean
  analyserNode?: AnalyserNode | null
}

/**
 * VoiceWaveform displays an animated SVG waveform during speech recognition.
 * If Web Audio API analyserNode is provided, renders actual audio frequency data.
 * Otherwise, simulates wave animation with CSS-driven bars.
 */
export function VoiceWaveform({ isListening, analyserNode }: VoiceWaveformProps) {
  const [frequencies, setFrequencies] = useState<number[]>(() => Array(8).fill(0))
  const animRef = useRef<number>()

  useEffect(() => {
    if (!isListening) {
      setFrequencies(Array(8).fill(0))
      if (animRef.current) cancelAnimationFrame(animRef.current)
      return
    }

    if (analyserNode) {
      // Real-time audio frequency visualization
      const bufferLength = analyserNode.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      const barCount = 8

      const animate = () => {
        analyserNode.getByteFrequencyData(dataArray)
        const step = Math.floor(bufferLength / barCount)
        const bars = Array.from({ length: barCount }, (_, i) => {
          const start = i * step
          const end = start + step
          const slice = dataArray.slice(start, end)
          const avg = slice.reduce((a, b) => a + b, 0) / slice.length
          return Math.min(avg / 255, 1)
        })
        setFrequencies(bars)
        animRef.current = requestAnimationFrame(animate)
      }
      animate()
    } else {
      // Simulated wave animation (no Web Audio API)
      let phase = 0
      const animate = () => {
        phase += 0.15
        const bars = Array.from({ length: 8 }, (_, i) => {
          const offset = (i / 8) * Math.PI * 2
          const val = 0.3 + Math.sin(phase + offset) * 0.3 + Math.random() * 0.2
          return Math.max(0.1, Math.min(val, 1))
        })
        setFrequencies(bars)
        animRef.current = requestAnimationFrame(animate)
      }
      animate()
    }

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [isListening, analyserNode])

  if (!isListening) return null

  return (
    <div className="voice-waveform">
      <svg viewBox="0 0 80 40" width="80" height="40">
        {frequencies.map((freq, i) => {
          const x = i * 10 + 5
          const height = Math.max(4, freq * 32)
          const y = 20 - height / 2
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width="6"
              height={height}
              rx="3"
              className="voice-bar"
              style={{ fill: 'var(--green, #22c55e)' }}
            />
          )
        })}
      </svg>
    </div>
  )
}
