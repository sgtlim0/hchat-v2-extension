import { useState, useRef } from 'react'
import { generateInsightReport, type ReportProgress } from '../../lib/insightReport'
import type { AIProvider } from '../../lib/providers/types'
import type { ToolPanelProps } from './types'

type Props = Pick<ToolPanelProps, 'loading' | 'setLoading' | 'setResult' | 'showToast' | 't'> & {
  result: string
  getProvider: (model: string) => AIProvider | undefined
  activeModel: string
}

export default function InsightTool({ loading, setLoading, setResult, showToast, t, result, getProvider, activeModel }: Props) {
  const [reportProgress, setReportProgress] = useState<ReportProgress | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const handleInsightReport = async () => {
    setLoading(true)
    setResult('')
    setReportProgress({ stage: t('tools.starting'), percent: 0 })
    abortRef.current = new AbortController()
    try {
      const provider = getProvider(activeModel)
      if (!provider?.isConfigured()) {
        setResult(t('common.setApiKeyFirst'))
        setLoading(false)
        setReportProgress(null)
        return
      }
      const report = await generateInsightReport(
        provider,
        activeModel,
        (p) => setReportProgress(p),
        (chunk) => setResult((r: string) => r + chunk),
        abortRef.current.signal,
      )
      setResult(report.fullMarkdown)
      setReportProgress(null)
    } catch (err) {
      if (!String(err).includes('abort')) {
        setResult('❌ ' + String(err))
      }
      setReportProgress(null)
    } finally {
      setLoading(false)
    }
  }

  const handleInsightStop = () => {
    abortRef.current?.abort()
    setLoading(false)
    setReportProgress(null)
  }

  return (
    <div className="gap-2">
      <p style={{ fontSize: 12, color: 'var(--text2)' }}>{t('tools.insightDesc')}</p>
      {reportProgress && (
        <div className="insight-progress">
          <div className="insight-progress-bar">
            <div className="insight-progress-fill" style={{ width: `${reportProgress.percent}%` }} />
          </div>
          <span className="insight-progress-label">{reportProgress.stage} ({reportProgress.percent}%)</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={handleInsightReport} disabled={loading}>
          {loading ? <><span className="spinner" /> {t('tools.generatingReport')}</> : t('tools.insightAction')}
        </button>
        {loading && (
          <button className="btn btn-secondary" onClick={handleInsightStop}>{t('common.stop')}</button>
        )}
      </div>
      {result && !loading && (
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            const blob = new Blob([result], { type: 'text/markdown' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `insight-report-${new Date().toISOString().slice(0, 10)}.md`
            a.click()
            URL.revokeObjectURL(url)
            showToast(t('common.downloadComplete'))
          }}
        >
          {t('tools.markdownDownload')}
        </button>
      )}
    </div>
  )
}
