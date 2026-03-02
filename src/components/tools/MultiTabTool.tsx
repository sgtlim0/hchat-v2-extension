import { getAllTabsContent, truncate } from '../../lib/pageReader'
import type { ToolPanelProps } from './types'

type Props = Pick<ToolPanelProps, 'loading' | 'setLoading' | 'setResult' | 'runStream' | 't'>

export default function MultiTabTool({ loading, setLoading, setResult, runStream, t }: Props) {
  const handleMultiTab = async () => {
    setLoading(true)
    setResult('')
    try {
      const tabs = await getAllTabsContent(10)
      if (tabs.length === 0) { setResult(t('tools.noTabs')); setLoading(false); return }
      const tabSummaries = tabs.map((tab, i) =>
        `--- ${t('tools.tabLabel')} ${i + 1}: ${tab.title} ---\nURL: ${tab.url}\n${truncate(tab.text, 2000)}`
      ).join('\n\n')
      await runStream(`${t('aiPrompts.multiTabSummarize', { count: tabs.length })}\n\n${tabSummaries}`)
    } catch (err) {
      setResult('❌ ' + String(err))
      setLoading(false)
    }
  }

  return (
    <div className="gap-2">
      <p style={{ fontSize: 12, color: 'var(--text2)' }}>{t('tools.multitabDesc')}</p>
      <button className="btn btn-primary" onClick={handleMultiTab} disabled={loading}>
        {loading ? <><span className="spinner" /> {t('tools.summarizing')}</> : t('tools.multitabAction')}
      </button>
    </div>
  )
}
