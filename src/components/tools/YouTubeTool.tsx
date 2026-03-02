import { getCurrentPageContent, getYouTubeTranscript } from '../../lib/pageReader'
import type { ToolPanelProps } from './types'

type Props = Pick<ToolPanelProps, 'loading' | 'setLoading' | 'setResult' | 'runStream' | 't'>

export default function YouTubeTool({ loading, setLoading, setResult, runStream, t }: Props) {
  const handleYouTube = async () => {
    setLoading(true)
    setResult('')
    try {
      const page = await getCurrentPageContent()
      if (!page.isYouTube) { setResult(t('tools.notYouTube')); setLoading(false); return }
      const transcript = await getYouTubeTranscript(page.youtubeId!)
      if (!transcript) { setResult(t('tools.noSubtitles')); setLoading(false); return }
      await runStream(`${t('aiPrompts.summarizeYoutube')}\n\n제목: ${page.title}\n\n자막:\n${transcript}`)
    } catch (err) {
      setResult('❌ ' + String(err))
      setLoading(false)
    }
  }

  return (
    <div className="gap-2">
      <p style={{ fontSize: 12, color: 'var(--text2)' }}>{t('tools.youtubeDesc')}</p>
      <button className="btn btn-primary" onClick={handleYouTube} disabled={loading}>
        {loading ? <><span className="spinner" /> {t('tools.analyzing')}</> : t('tools.youtubeAction')}
      </button>
    </div>
  )
}
