import { useState } from 'react'
import { parseDataFile, dataToMarkdownTable, generateAnalysisPrompt, type ParsedData, type AnalysisType, DataAnalysisError } from '../../lib/dataAnalysis'
import type { ToolPanelProps } from './types'

type Props = Pick<ToolPanelProps, 'loading' | 'setResult' | 'runStream' | 't' | 'locale'>

export default function DataAnalysisTool({ loading, setResult, runStream, t, locale }: Props) {
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [analysisType, setAnalysisType] = useState<AnalysisType>('summary')

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
