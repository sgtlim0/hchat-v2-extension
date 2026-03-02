import { getCurrentPageContent } from '../../lib/pageReader'
import { extractComments, buildCommentAnalysisPrompt } from '../../lib/commentAnalyzer'
import type { ToolPanelProps } from './types'

type Props = Pick<ToolPanelProps, 'loading' | 'setLoading' | 'setResult' | 'runStream' | 't'>

export default function CommentsTool({ loading, setLoading, setResult, runStream, t }: Props) {
  const handleComments = async () => {
    setLoading(true)
    setResult('')
    try {
      const page = await getCurrentPageContent()
      if (!page.isYouTube) { setResult(t('tools.notYouTube')); setLoading(false); return }
      const comments = await extractComments(200)
      if (comments.length === 0) {
        setResult(t('tools.noComments'))
        setLoading(false)
        return
      }
      const prompt = buildCommentAnalysisPrompt(comments, page.title)
      await runStream(prompt)
    } catch (err) {
      setResult('❌ ' + String(err))
      setLoading(false)
    }
  }

  return (
    <div className="gap-2">
      <p style={{ fontSize: 12, color: 'var(--text2)' }}>{t('tools.commentsDesc')}</p>
      <button className="btn btn-primary" onClick={handleComments} disabled={loading}>
        {loading ? <><span className="spinner" /> {t('tools.analyzingComments')}</> : t('tools.commentsAction')}
      </button>
    </div>
  )
}
