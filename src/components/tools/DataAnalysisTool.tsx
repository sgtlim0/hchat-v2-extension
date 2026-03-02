import { useState, useMemo } from 'react'
import { parseDataFile, dataToMarkdownTable, generateAnalysisPrompt, type ParsedData, type AnalysisType, DataAnalysisError } from '../../lib/dataAnalysis'
import { extractChartData } from '../../lib/chartDataExtractor'
import { DataChart } from '../DataChart'
import type { ToolPanelProps } from './types'

type Props = Pick<ToolPanelProps, 'loading' | 'setResult' | 'runStream' | 't' | 'locale'>

export default function DataAnalysisTool({ loading, setResult, runStream, t, locale }: Props) {
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [analysisType, setAnalysisType] = useState<AnalysisType>('summary')
  const [showCharts, setShowCharts] = useState(true)

  const charts = useMemo(() => {
    if (!parsedData) return []
    return extractChartData(parsedData)
  }, [parsedData])

  const handleDataFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setResult('')
    setParsedData(null)
    try {
      const data = await parseDataFile(file)
      setParsedData(data)
    } catch (err) {
      if (err instanceof DataAnalysisError) setResult('❌ ' + err.message)
      else setResult('❌ ' + String(err))
    }
  }

  const handleDataAnalysis = async () => {
    if (!parsedData) return
    const prompt = generateAnalysisPrompt(parsedData, analysisType, locale)
    await runStream(prompt)
  }

  return (
    <div className="gap-2">
      <p style={{ fontSize: 12, color: 'var(--text2)' }}>{t('tools.dataAnalysis.desc')}</p>
      <label className="btn btn-secondary" style={{ cursor: 'pointer', justifyContent: 'center' }}>
        {t('tools.dataAnalysis.upload')}
        <input type="file" accept=".csv,.tsv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleDataFileUpload} />
      </label>
      {parsedData && (
        <>
          <div style={{ fontSize: 11, color: 'var(--text2)', padding: '4px 0' }}>
            {t('common.file')}: {parsedData.fileName} ({parsedData.rowCount}{t('tools.dataAnalysis.rows')}, {parsedData.headers.length}{t('tools.dataAnalysis.cols')})
          </div>
          <div className="result-box" style={{ maxHeight: 160, overflow: 'auto' }}>
            <div className="result-content" style={{ fontSize: 11, whiteSpace: 'pre-wrap', fontFamily: 'var(--mono)' }}>
              {dataToMarkdownTable(parsedData, 5)}
            </div>
          </div>

          {/* Charts */}
          {charts.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>
                  {t('tools.dataAnalysis.chartTitle')}
                </span>
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => setShowCharts((v) => !v)}
                  style={{ fontSize: 10 }}
                >
                  {showCharts ? t('tools.dataAnalysis.hideChart') : t('tools.dataAnalysis.showChart')}
                </button>
              </div>
              {showCharts && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: '8px 4px',
                  background: 'var(--bg2, #1a1f2e)',
                  borderRadius: 8,
                  border: '1px solid var(--border, #333)',
                }}>
                  {charts.map((chart, i) => (
                    <DataChart key={`${chart.title}-${i}`} chart={chart} width={300} />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="field">
            <label className="field-label">{t('tools.dataAnalysis.typeLabel')}</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['summary', 'trend', 'outlier'] as AnalysisType[]).map((at) => (
                <button
                  key={at}
                  className={`btn btn-sm ${analysisType === at ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setAnalysisType(at)}
                >
                  {t(`tools.dataAnalysis.type_${at}`)}
                </button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleDataAnalysis} disabled={loading}>
            {loading ? <><span className="spinner" /> {t('tools.analyzing')}</> : t('tools.dataAnalysis.startAnalysis')}
          </button>
        </>
      )}
    </div>
  )
}
