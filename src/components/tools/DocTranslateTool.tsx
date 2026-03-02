import { useState, useRef, useCallback } from 'react'
import {
  detectFormat,
  extractTexts,
  translateChunks,
  buildOutput,
  estimateCost,
  DocTranslateError,
  type SupportedFormat,
  type TranslationProgress,
  type TranslationResult,
} from '../../lib/docTranslator'
import { downloadBlob } from '../../lib/exportChat'
import type { ToolPanelProps } from './types'

type Props = Pick<ToolPanelProps, 'loading' | 'setLoading' | 'setResult' | 'showToast' | 't' | 'locale'> & {
  runStreamDirect: (prompt: string, model?: string) => Promise<string>
}

const LANGUAGES = [
  'Korean', 'English', 'Japanese', 'Chinese', 'Spanish',
  'French', 'German', 'Portuguese', 'Russian', 'Arabic',
]

const LANG_KEYS: Record<string, string> = {
  Korean: 'ko', English: 'en', Japanese: 'ja', Chinese: 'zh', Spanish: 'es',
  French: 'fr', German: 'de', Portuguese: 'pt', Russian: 'ru', Arabic: 'ar',
}

export default function DocTranslateTool({
  loading, setLoading, setResult, showToast, t, runStreamDirect,
}: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<SupportedFormat | null>(null)
  const [sourceLang, setSourceLang] = useState('auto')
  const [targetLang, setTargetLang] = useState(LANGUAGES[1])
  const [chunks, setChunks] = useState<string[]>([])
  const [progress, setProgress] = useState<TranslationProgress | null>(null)
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  const costInfo = chunks.length > 0 ? estimateCost(chunks) : null

  const handleFile = useCallback(async (f: File) => {
    setResult('')
    setTranslationResult(null)
    setProgress(null)
    setChunks([])

    try {
      const fmt = detectFormat(f)
      setFormat(fmt)
      setFile(f)

      const extracted = await extractTexts(f, fmt)
      setChunks(extracted)
    } catch (err) {
      if (err instanceof DocTranslateError) {
        setResult(`❌ ${err.message}`)
      } else {
        setResult(`❌ ${String(err)}`)
      }
    }
  }, [setResult])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
    e.target.value = ''
  }, [handleFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const translateFn = useCallback(async (prompt: string): Promise<string> => {
    return runStreamDirect(prompt)
  }, [runStreamDirect])

  const handleTranslate = useCallback(async () => {
    if (!file || !format || chunks.length === 0) {
      setResult(t('tools.docTranslate.noFile'))
      return
    }

    // Cost warning for large files
    if (costInfo && costInfo.estimatedCost > 1) {
      const ok = confirm(
        t('tools.docTranslate.costWarning', { cost: `$${costInfo.estimatedCost.toFixed(2)}` }),
      )
      if (!ok) return
    }

    setLoading(true)
    setResult('')
    setTranslationResult(null)

    try {
      const srcLang = sourceLang === 'auto'
        ? 'auto'
        : (LANG_KEYS[sourceLang] ?? sourceLang)
      const tgtLang = LANG_KEYS[targetLang] ?? targetLang

      setProgress({ current: 0, total: chunks.length, status: 'parsing' })

      const translated = await translateChunks(
        chunks,
        srcLang,
        tgtLang,
        translateFn,
        setProgress,
      )

      setProgress({ current: chunks.length, total: chunks.length, status: 'building' })

      const result = await buildOutput(translated, file, format)
      setTranslationResult(result)
      setProgress({ current: chunks.length, total: chunks.length, status: 'done' })
      setResult(t('tools.docTranslate.complete'))
    } catch (err) {
      setProgress((prev) =>
        prev ? { ...prev, status: 'error' } : { current: 0, total: 0, status: 'error' },
      )
      if (err instanceof DocTranslateError) {
        setResult(`❌ ${err.message}`)
      } else {
        setResult(`❌ ${String(err)}`)
      }
    } finally {
      setLoading(false)
    }
  }, [file, format, chunks, sourceLang, targetLang, costInfo, setLoading, setResult, translateFn, t])

  const handleDownload = useCallback(() => {
    if (!translationResult) return
    downloadBlob(translationResult.blob, translationResult.filename)
    showToast(t('common.downloadComplete'))
  }, [translationResult, showToast, t])

  const progressPercent = progress
    ? Math.round((progress.current / Math.max(progress.total, 1)) * 100)
    : 0

  return (
    <div className="gap-2">
      <p style={{ fontSize: 12, color: 'var(--text2)' }}>
        {t('tools.docTranslate.desc')}
      </p>

      {/* Drop zone */}
      <div
        ref={dropZoneRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: '2px dashed var(--border)',
          borderRadius: 8,
          padding: '20px 16px',
          textAlign: 'center',
          cursor: 'pointer',
          fontSize: 12,
          color: 'var(--text2)',
          transition: 'border-color 0.2s',
        }}
      >
        {file
          ? `${file.name} (${(file.size / 1024).toFixed(1)}KB)`
          : t('tools.docTranslate.uploadZone')
        }
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.csv,.xlsx,.xls"
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />
      </div>

      {/* Language selectors */}
      {file && (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="field" style={{ flex: 1 }}>
              <label className="field-label">{t('tools.docTranslate.sourceLang')}</label>
              <select
                className="select"
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
              >
                <option value="auto">{t('tools.docTranslate.autoDetect')}</option>
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <span style={{ fontSize: 16, marginTop: 18 }}>→</span>
            <div className="field" style={{ flex: 1 }}>
              <label className="field-label">{t('tools.docTranslate.targetLang')}</label>
              <select
                className="select"
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
              >
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Cost estimate */}
          {costInfo && (
            <div style={{ fontSize: 11, color: 'var(--text2)', padding: '4px 0' }}>
              {t('tools.docTranslate.estimate', {
                tokens: costInfo.estimatedTokens.toLocaleString(),
                cost: costInfo.estimatedCost.toFixed(3),
              })}
              {' '}({chunks.length} chunks)
            </div>
          )}

          {/* Translate button */}
          <button
            className="btn btn-primary"
            onClick={handleTranslate}
            disabled={loading}
          >
            {loading
              ? <><span className="spinner" /> {t('tools.docTranslate.translating')}</>
              : t('tools.docTranslate.startTranslate')
            }
          </button>

          {/* Progress bar */}
          {progress && progress.status === 'translating' && (
            <div>
              <div style={{
                fontSize: 11,
                color: 'var(--text2)',
                marginBottom: 4,
              }}>
                {t('tools.docTranslate.progress', {
                  current: progress.current,
                  total: progress.total,
                })}
              </div>
              <div style={{
                height: 6,
                background: 'var(--bg3, #222)',
                borderRadius: 3,
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${progressPercent}%`,
                  background: 'var(--accent, #10a37f)',
                  borderRadius: 3,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          )}

          {/* Download button */}
          {translationResult && (
            <button
              className="btn btn-secondary"
              onClick={handleDownload}
              style={{ justifyContent: 'center' }}
            >
              {t('tools.docTranslate.downloadResult')} ({translationResult.filename})
            </button>
          )}
        </>
      )}
    </div>
  )
}
