import { getCurrentPageContent, truncate } from '../../lib/pageReader'
import type { ToolPanelProps } from './types'

type Props = Pick<ToolPanelProps, 'loading' | 'setLoading' | 'setResult' | 'runStream' | 't'>

export default function SummarizeTool({ loading, setLoading, setResult, runStream, t }: Props) {
  const handleSummarize = async () => {
    setLoading(true)
    try {
      const page = await getCurrentPageContent()
      if (!page.text) { setResult(t('tools.noPageContent')); setLoading(false); return }
      await runStream(`${t('aiPrompts.summarizePage')}\n\n제목: ${page.title}\nURL: ${page.url}\n\n내용:\n${truncate(page.text)}`)
    } catch (err) {
      setResult('❌ ' + String(err))
      setLoading(false)
    }
  }

  return (
    <div className="gap-2">
      <p style={{ fontSize: 12, color: 'var(--text2)' }}>{t('tools.summarizeDesc')}</p>
      <button className="btn btn-primary" onClick={handleSummarize} disabled={loading}>
        {loading ? <><span className="spinner" /> {t('tools.summarizing')}</> : t('tools.summarizeAction')}
      </button>
    </div>
  )
}
