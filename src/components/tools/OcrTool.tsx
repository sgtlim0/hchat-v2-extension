import { useState } from 'react'
import { fileToBase64 } from '../../lib/pageReader'
import type { ToolPanelProps } from './types'

type Props = Pick<ToolPanelProps, 'loading' | 't'> & {
  runVisionStream: (imageBase64: string, prompt: string) => Promise<void>
}

export default function OcrTool({ loading, t, runVisionStream }: Props) {
  const [imgBase64, setImgBase64] = useState('')

  const handleOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const b64 = await fileToBase64(file)
    setImgBase64(b64)
    e.target.value = ''
  }

  const handleOCRRun = async () => {
    if (!imgBase64) return
    await runVisionStream(imgBase64, t('aiPrompts.ocrExtract'))
  }

  return (
    <div className="gap-2">
      <p style={{ fontSize: 12, color: 'var(--text2)' }}>{t('tools.ocrDesc')}</p>
      <label className="btn btn-secondary" style={{ cursor: 'pointer', justifyContent: 'center' }}>
        {t('tools.imageUpload')}
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleOCR} />
      </label>
      {imgBase64 && (
        <>
          <img src={imgBase64} style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 8, border: '1px solid var(--border2)' }} alt="" />
          <button className="btn btn-primary" onClick={handleOCRRun} disabled={loading}>
            {loading ? <><span className="spinner" /> {t('tools.extracting')}</> : t('tools.extractText')}
          </button>
        </>
      )}
    </div>
  )
}
