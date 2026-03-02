import { useState } from 'react'
import { extractPdfText, formatFileSize } from '../../lib/pdfParser'
import type { ToolPanelProps } from './types'

type Props = Pick<ToolPanelProps, 'loading' | 'setLoading' | 'setResult' | 'runStream' | 't'>

export default function PdfTool({ loading, setLoading, setResult, runStream, t }: Props) {
  const [pdfText, setPdfText] = useState('')
  const [pdfFileName, setPdfFileName] = useState('')
  const [pdfQuestion, setPdfQuestion] = useState('')

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setPdfText('')
    setPdfFileName(file.name)
    setResult('')
    setLoading(true)
    try {
      const text = await extractPdfText(file)
      setPdfText(text)
      setResult(t('tools.pdfLoaded', { size: formatFileSize(file.size), chars: text.length.toLocaleString() }))
    } catch (err) {
      setResult('❌ ' + String(err))
    } finally {
      setLoading(false)
    }
  }

  const handlePdfChat = async () => {
    if (!pdfText || !pdfQuestion.trim()) return
    await runStream(t('aiPrompts.pdfChat', { pdfContent: pdfText.slice(0, 12000), question: pdfQuestion.trim() }) + ' ' + t('aiPrompts.respondInLang'))
    setPdfQuestion('')
  }

  return (
    <div className="gap-2">
      <p style={{ fontSize: 12, color: 'var(--text2)' }}>{t('tools.pdfDesc')}</p>
      <label className="btn btn-secondary" style={{ cursor: 'pointer', justifyContent: 'center' }}>
        {t('tools.pdfUpload')}
        <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={handlePdfUpload} />
      </label>
      {pdfFileName && (
        <div style={{ fontSize: 11, color: 'var(--text2)', padding: '4px 0' }}>
          {t('common.file')}: {pdfFileName}
        </div>
      )}
      {pdfText && (
        <div className="field">
          <label className="field-label">{t('tools.pdfQuestionLabel')}</label>
          <textarea
            className="textarea"
            rows={3}
            value={pdfQuestion}
            onChange={(e) => setPdfQuestion(e.target.value)}
            placeholder={t('tools.pdfQuestionPlaceholder')}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePdfChat() } }}
          />
          <button
            className="btn btn-primary"
            style={{ marginTop: 8 }}
            onClick={handlePdfChat}
            disabled={loading || !pdfQuestion.trim()}
          >
            {loading ? <><span className="spinner" /> {t('tools.answering')}</> : t('tools.askQuestion')}
          </button>
        </div>
      )}
    </div>
  )
}
