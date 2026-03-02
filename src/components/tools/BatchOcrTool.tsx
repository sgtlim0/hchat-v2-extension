import { useState, useRef } from 'react'
import { fileToBase64 } from '../../lib/pageReader'
import { processBatchOcr, exportOcrResults, type OcrResult, type OcrMode } from '../../lib/batchOcr'
import type { ToolPanelProps } from './types'

type Props = Pick<ToolPanelProps, 'loading' | 'setLoading' | 't'> & {
  runVisionDirect: (imageBase64: string, prompt: string) => Promise<string>
}

interface ImageItem {
  id: string
  fileName: string
  base64: string
}

const MAX_IMAGES = 10
const MODES: OcrMode[] = ['general', 'businessCard', 'receipt', 'screenshot']

export default function BatchOcrTool({ loading, setLoading, t, runVisionDirect }: Props) {
  const [images, setImages] = useState<ImageItem[]>([])
  const [mode, setMode] = useState<OcrMode>('general')
  const [results, setResults] = useState<OcrResult[]>([])
  const [doneCount, setDoneCount] = useState(0)
  const [toast, setToast] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 1800)
  }

  const addFiles = async (files: FileList | File[]) => {
    const fileArr = Array.from(files).filter(f => f.type.startsWith('image/'))
    const remaining = MAX_IMAGES - images.length
    if (remaining <= 0) return
    const toAdd = fileArr.slice(0, remaining)

    const newItems: ImageItem[] = await Promise.all(
      toAdd.map(async (f) => ({
        id: crypto.randomUUID(),
        fileName: f.name,
        base64: await fileToBase64(f),
      }))
    )
    setImages(prev => [...prev, ...newItems])
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) await addFiles(files)
    e.target.value = ''
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dropRef.current?.classList.remove('batch-ocr-drop-active')
    if (e.dataTransfer.files.length) {
      await addFiles(e.dataTransfer.files)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dropRef.current?.classList.add('batch-ocr-drop-active')
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dropRef.current?.classList.remove('batch-ocr-drop-active')
  }

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id))
  }

  const handleStart = async () => {
    if (images.length === 0) return
    setLoading(true)
    setResults([])
    setDoneCount(0)

    try {
      const ocrResults = await processBatchOcr(
        images,
        mode,
        runVisionDirect,
        (result) => {
          setResults(prev => {
            const idx = prev.findIndex(r => r.id === result.id)
            return idx >= 0
              ? prev.map((r, i) => i === idx ? result : r)
              : [...prev, result]
          })
          if (result.status === 'done' || result.status === 'error') {
            setDoneCount(prev => prev + 1)
          }
        },
      )
      setResults(ocrResults)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = (format: 'txt' | 'json') => {
    const content = exportOcrResults(results, format)
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ocr-results.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text)
    showToast(t('common.copied') + '!')
  }

  const doneResults = results.filter(r => r.status === 'done')
  const hasResults = doneResults.length > 0

  return (
    <div className="gap-2">
      <p style={{ fontSize: 12, color: 'var(--text2)' }}>{t('tools.batchOcr.desc')}</p>

      {/* Mode selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{t('tools.batchOcr.mode')}</label>
        <select className="select" value={mode} onChange={e => setMode(e.target.value as OcrMode)} style={{ flex: 1 }}>
          {MODES.map(m => (
            <option key={m} value={m}>{t(`tools.batchOcr.mode${m.charAt(0).toUpperCase() + m.slice(1)}`)}</option>
          ))}
        </select>
      </div>

      {/* Drop zone */}
      <div
        ref={dropRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileRef.current?.click()}
        style={{
          border: '2px dashed var(--border2)',
          borderRadius: 8,
          padding: '20px 12px',
          textAlign: 'center',
          cursor: 'pointer',
          fontSize: 13,
          color: 'var(--text2)',
          transition: 'border-color 0.2s',
        }}
      >
        {t('tools.batchOcr.dropZone')}
        <input ref={fileRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
      </div>

      {images.length > MAX_IMAGES && (
        <p style={{ fontSize: 11, color: 'var(--error, #e53e3e)' }}>{t('tools.batchOcr.maxImages')}</p>
      )}

      {/* Image preview list */}
      {images.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {images.map(img => (
            <div key={img.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
              <img src={img.base64} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border2)' }} />
              <span style={{ flex: 1, fontSize: 12, color: 'var(--text0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.fileName}</span>
              <button className="btn btn-ghost btn-xs" onClick={() => removeImage(img.id)}>{t('tools.batchOcr.removeImage')}</button>
            </div>
          ))}
        </div>
      )}

      {/* Start button */}
      <button
        className="btn btn-primary"
        onClick={handleStart}
        disabled={loading || images.length === 0}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        {loading
          ? <><span className="spinner" /> {t('tools.batchOcr.progress', { done: String(doneCount), total: String(images.length) })}</>
          : images.length === 0 ? t('tools.batchOcr.noImages') : t('tools.batchOcr.startOcr')
        }
      </button>

      {/* Results */}
      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {results.map(r => (
            <div key={r.id} style={{ background: 'var(--bg2)', borderRadius: 8, padding: 10, border: '1px solid var(--border2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <img src={r.imageBase64} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4 }} />
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text0)' }}>{r.fileName}</span>
                {r.status === 'processing' && <span className="spinner" />}
                {r.status === 'done' && (
                  <button className="btn btn-ghost btn-xs" onClick={() => handleCopyText(r.text)}>{t('tools.batchOcr.copyText')}</button>
                )}
              </div>
              {r.status === 'error' && (
                <p style={{ fontSize: 12, color: 'var(--error, #e53e3e)' }}>{r.error}</p>
              )}
              {r.status === 'done' && (
                <>
                  <pre style={{ fontSize: 12, color: 'var(--text0)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, maxHeight: 200, overflow: 'auto' }}>{r.text}</pre>
                  {r.structured && (
                    <details style={{ marginTop: 6 }}>
                      <summary style={{ fontSize: 11, color: 'var(--accent)', cursor: 'pointer' }}>{t('tools.batchOcr.structured')}</summary>
                      <table style={{ width: '100%', fontSize: 11, marginTop: 4, borderCollapse: 'collapse' }}>
                        <tbody>
                          {Object.entries(r.structured).map(([k, v]) => (
                            <tr key={k}>
                              <td style={{ padding: '2px 6px', fontWeight: 600, color: 'var(--text2)', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{k}</td>
                              <td style={{ padding: '2px 6px', color: 'var(--text0)', wordBreak: 'break-word' }}>
                                {typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Export buttons */}
      {hasResults && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => handleExport('txt')} style={{ flex: 1 }}>{t('tools.batchOcr.exportTxt')}</button>
          <button className="btn btn-secondary btn-sm" onClick={() => handleExport('json')} style={{ flex: 1 }}>{t('tools.batchOcr.exportJson')}</button>
        </div>
      )}

      {toast && <div className="copy-toast">{toast}</div>}
    </div>
  )
}
