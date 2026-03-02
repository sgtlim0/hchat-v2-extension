import { useState, useCallback } from 'react'
import {
  generateImage,
  downloadImageAsBlob,
  estimateImageCost,
  type ImageSize,
  type ImageQuality,
  type ImageStyle,
  type ImageGenResult,
} from '../../lib/imageGenerator'
import type { ToolPanelProps } from './types'
import type { Config } from '../../hooks/useConfig'

type Props = Pick<ToolPanelProps, 'loading' | 'setLoading' | 'setResult' | 'showToast' | 't'> & {
  config: Config
}

const SIZE_OPTIONS: ImageSize[] = ['1024x1024', '1792x1024', '1024x1792']
const MAX_HISTORY = 5

export default function ImageGenTool({ loading, setLoading, setResult, showToast, t, config }: Props) {
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState<ImageSize>('1024x1024')
  const [quality, setQuality] = useState<ImageQuality>('standard')
  const [style, setStyle] = useState<ImageStyle>('vivid')
  const [currentResult, setCurrentResult] = useState<ImageGenResult | null>(null)
  const [history, setHistory] = useState<ImageGenResult[]>([])
  const [selectedHistoryIdx, setSelectedHistoryIdx] = useState<number | null>(null)

  const cost = estimateImageCost(quality, size)
  const apiKey = config.openai?.apiKey ?? ''

  const sizeKey = (s: ImageSize): string => {
    const map: Record<ImageSize, string> = {
      '1024x1024': 'sizeSquare',
      '1792x1024': 'sizeLandscape',
      '1024x1792': 'sizePortrait',
    }
    return map[s]
  }

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      showToast(t('tools.imageGen.noPrompt'))
      return
    }
    if (!apiKey) {
      showToast(t('tools.imageGen.needApiKey'))
      return
    }

    setLoading(true)
    setResult('')
    setCurrentResult(null)
    setSelectedHistoryIdx(null)

    try {
      const result = await generateImage({ prompt, size, quality, style }, apiKey)
      setCurrentResult(result)
      setHistory((prev) => [result, ...prev].slice(0, MAX_HISTORY))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setResult(t('tools.imageGen.failed', { error: msg }))
    } finally {
      setLoading(false)
    }
  }, [prompt, size, quality, style, apiKey, setLoading, setResult, showToast, t])

  const handleDownload = useCallback(async (url: string) => {
    try {
      const blob = await downloadImageAsBlob(url)
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `dalle3-${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(blobUrl)
      showToast(t('tools.imageGen.download'))
    } catch (err) {
      showToast(String(err))
    }
  }, [showToast, t])

  const handleHistoryClick = useCallback((idx: number) => {
    setSelectedHistoryIdx(idx)
    setCurrentResult(history[idx])
  }, [history])

  const displayResult = currentResult

  return (
    <div className="gap-2">
      {/* Prompt */}
      <label style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>
        {t('tools.imageGen.promptLabel')}
      </label>
      <textarea
        className="tool-textarea"
        rows={3}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={t('tools.imageGen.promptPlaceholder')}
        disabled={loading}
      />

      {/* Size */}
      <label style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500, marginTop: 4 }}>
        {t('tools.imageGen.sizeLabel')}
      </label>
      <div className="image-gen-options">
        {SIZE_OPTIONS.map((s) => (
          <button
            key={s}
            className={`image-gen-option${size === s ? ' active' : ''}`}
            onClick={() => setSize(s)}
            disabled={loading}
          >
            {t(`tools.imageGen.${sizeKey(s)}`)}
          </button>
        ))}
      </div>

      {/* Quality & Style */}
      <div style={{ display: 'flex', gap: 16 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>
            {t('tools.imageGen.qualityLabel')}
          </label>
          <div className="image-gen-options">
            {(['standard', 'hd'] as ImageQuality[]).map((q) => (
              <button
                key={q}
                className={`image-gen-option${quality === q ? ' active' : ''}`}
                onClick={() => setQuality(q)}
                disabled={loading}
              >
                {t(`tools.imageGen.quality${q === 'standard' ? 'Standard' : 'Hd'}`)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>
            {t('tools.imageGen.styleLabel')}
          </label>
          <div className="image-gen-options">
            {(['vivid', 'natural'] as ImageStyle[]).map((s) => (
              <button
                key={s}
                className={`image-gen-option${style === s ? ' active' : ''}`}
                onClick={() => setStyle(s)}
                disabled={loading}
              >
                {t(`tools.imageGen.style${s === 'vivid' ? 'Vivid' : 'Natural'}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cost + Generate */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
          {t('tools.imageGen.cost', { cost: cost.toFixed(3) })}
        </span>
        <button className="btn btn-primary" onClick={handleGenerate} disabled={loading || !prompt.trim()}>
          {loading
            ? <><span className="spinner" /> {t('tools.imageGen.generating')}</>
            : t('tools.imageGen.generate')}
        </button>
      </div>

      {/* Result */}
      {displayResult && (
        <div style={{ marginTop: 8 }}>
          <img
            src={displayResult.url}
            alt={displayResult.revisedPrompt}
            className="image-gen-preview"
          />
          <div style={{ fontSize: 11, color: 'var(--text2)', margin: '6px 0' }}>
            <strong>{t('tools.imageGen.revisedPrompt')}:</strong>{' '}
            {displayResult.revisedPrompt}
          </div>
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => handleDownload(displayResult.url)}
          >
            {t('tools.imageGen.download')}
          </button>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>
            {t('tools.imageGen.history')}
          </label>
          <div className="image-gen-history">
            {history.map((item, idx) => (
              <img
                key={`${item.url}-${idx}`}
                src={item.url}
                alt={item.revisedPrompt}
                className={`image-gen-thumb${selectedHistoryIdx === idx ? ' active' : ''}`}
                onClick={() => handleHistoryClick(idx)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
