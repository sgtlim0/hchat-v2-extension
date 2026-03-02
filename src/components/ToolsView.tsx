import { useState, useRef } from 'react'
import { useProvider } from '../hooks/useProvider'
import { getCurrentPageContent, getYouTubeTranscript, fileToBase64, truncate } from '../lib/pageReader'
import { WRITING_ACTIONS, buildWritingPrompt, type WritingAction } from '../lib/writingTools'
import { extractComments, buildCommentAnalysisPrompt } from '../lib/commentAnalyzer'
import { extractPdfText, formatFileSize } from '../lib/pdfParser'
import { generateInsightReport, type ReportProgress } from '../lib/insightReport'
import { Usage } from '../lib/usage'
import type { Config } from '../hooks/useConfig'
import { useLocale } from '../i18n'
import ko from '../i18n/ko'
import en from '../i18n/en'

type ToolId = 'summarize' | 'translate' | 'write' | 'youtube' | 'ocr' | 'grammar' | 'comments' | 'pdf' | 'insight'

interface Props { config: Config }

export default function ToolsView({ config }: Props) {
  const { t, locale } = useLocale()
  const { getProvider, hasAnyKey } = useProvider(config)

  const TOOLS: { id: ToolId; icon: string }[] = [
    { id: 'summarize', icon: '📄' },
    { id: 'youtube', icon: '▶️' },
    { id: 'comments', icon: '💬' },
    { id: 'insight', icon: '📊' },
    { id: 'pdf', icon: '📑' },
    { id: 'translate', icon: '🌐' },
    { id: 'write', icon: '✏️' },
    { id: 'grammar', icon: '✅' },
    { id: 'ocr', icon: '🔍' },
  ]

  const LANGS = locale === 'en' ? en.tools.langs : ko.tools.langs
  const [activeTool, setActiveTool] = useState<ToolId | null>(null)
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [inputText, setInputText] = useState('')
  const [selectedLang, setSelectedLang] = useState(LANGS[0])
  const [selectedAction, setSelectedAction] = useState<WritingAction>('paraphrase')
  const [imgBase64, setImgBase64] = useState('')
  const [toast, setToast] = useState('')
  const [pdfText, setPdfText] = useState('')
  const [pdfFileName, setPdfFileName] = useState('')
  const [pdfQuestion, setPdfQuestion] = useState('')
  const [reportProgress, setReportProgress] = useState<ReportProgress | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const activeModel = config.defaultModel

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 1800) }

  const runStream = async (prompt: string, model?: string) => {
    const m = model ?? activeModel
    const provider = getProvider(m)
    if (!provider?.isConfigured()) {
      if (!hasAnyKey) { setResult(t('common.setApiKeyFirst')); return }
    }
    setResult('')
    setLoading(true)
    try {
      if (provider?.isConfigured()) {
        let fullText = ''
        const gen = provider.stream({
          model: m,
          messages: [{ role: 'user', content: prompt }],
        })
        for await (const chunk of gen) {
          fullText += chunk
          setResult((r) => r + chunk)
        }
        Usage.track(m, provider.type, prompt, fullText, 'tool').catch(() => {})
      }
    } catch (err) {
      setResult('❌ ' + String(err))
    } finally {
      setLoading(false)
    }
  }

  const runVisionStream = async (imageBase64: string, prompt: string) => {
    // Prefer vision-capable model
    const visionModel = 'us.anthropic.claude-sonnet-4-6'
    const provider = getProvider(visionModel)
    if (!provider?.isConfigured()) { setResult(t('tools.bedrockKeyRequired')); return }
    setResult('')
    setLoading(true)
    try {
      let fullText = ''
      const gen = provider.stream({
        model: visionModel,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageBase64 } },
            { type: 'text', text: prompt },
          ],
        }],
      })
      for await (const chunk of gen) {
        fullText += chunk
        setResult((r) => r + chunk)
      }
      Usage.track(visionModel, 'bedrock', prompt, fullText, 'tool').catch(() => {})
    } catch (err) {
      setResult('❌ ' + String(err))
    } finally {
      setLoading(false)
    }
  }

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

  const handleTranslate = async () => {
    if (!inputText.trim()) { setResult(t('tools.noText')); return }
    await runStream(t('aiPrompts.translateTo', { lang: selectedLang }) + `\n\n${inputText}`)
  }

  const handleWrite = async () => {
    if (!inputText.trim()) { setResult(t('tools.noInputText')); return }
    await runStream(buildWritingPrompt(selectedAction, inputText))
  }

  const handleGrammar = async () => {
    if (!inputText.trim()) { setResult(t('tools.noGrammarText')); return }
    await runStream(t('aiPrompts.grammarCheck') + `\n\n${inputText}`)
  }

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
        (chunk) => setResult((r) => r + chunk),
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

  if (!activeTool) {
    return (
      <div>
        <div style={{ padding: '12px 14px 0', fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {t('tools.selectTitle')}
        </div>
        <div className="tools-grid">
          {TOOLS.map((tool) => (
            <button key={tool.id} className="tool-card" onClick={() => { setActiveTool(tool.id); setResult('') }}>
              <span className="t-icon">{tool.icon}</span>
              <span className="t-title">{t(`tools.${tool.id}.title`)}</span>
              <span className="t-desc">{t(`tools.${tool.id}.desc`)}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const tool = TOOLS.find((tool) => tool.id === activeTool)!

  return (
    <div className="tool-view">
      <div className="tool-view-header">
        <button className="btn btn-ghost btn-xs" onClick={() => { setActiveTool(null); setResult('') }}>{t('common.back')}</button>
        <span className="tool-view-title">{tool.icon} {t(`tools.${tool.id}.title`)}</span>
      </div>

      {/* Tool-specific UI */}
      {activeTool === 'summarize' && (
        <div className="gap-2">
          <p style={{ fontSize: 12, color: 'var(--text2)' }}>{t('tools.summarizeDesc')}</p>
          <button className="btn btn-primary" onClick={handleSummarize} disabled={loading}>
            {loading ? <><span className="spinner" /> {t('tools.summarizing')}</> : t('tools.summarizeAction')}
          </button>
        </div>
      )}

      {activeTool === 'youtube' && (
        <div className="gap-2">
          <p style={{ fontSize: 12, color: 'var(--text2)' }}>{t('tools.youtubeDesc')}</p>
          <button className="btn btn-primary" onClick={handleYouTube} disabled={loading}>
            {loading ? <><span className="spinner" /> {t('tools.analyzing')}</> : t('tools.youtubeAction')}
          </button>
        </div>
      )}

      {activeTool === 'translate' && (
        <div className="gap-2">
          <div className="field">
            <label className="field-label">{t('tools.translateTo')}</label>
            <select className="select" value={selectedLang} onChange={(e) => setSelectedLang(e.target.value)}>
              {LANGS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">{t('tools.sourceText')}</label>
            <textarea className="textarea" rows={5} value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder={t('tools.translatePlaceholder')} />
          </div>
          <button className="btn btn-primary" onClick={handleTranslate} disabled={loading}>
            {loading ? <><span className="spinner" /> {t('tools.translating')}</> : t('tools.translateAction', { lang: selectedLang })}
          </button>
        </div>
      )}

      {activeTool === 'write' && (
        <div className="gap-2">
          <div className="field">
            <label className="field-label">{t('tools.selectAction')}</label>
            <div className="writing-actions">
              {WRITING_ACTIONS.map((a) => (
                <button
                  key={a.id}
                  className={`writing-action-btn ${selectedAction === a.id ? 'active' : ''}`}
                  onClick={() => setSelectedAction(a.id)}
                >
                  <span>{a.emoji}</span>
                  <span>{t(`writing.${a.id}`)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label className="field-label">{t('tools.textInput')}</label>
            <textarea className="textarea" rows={5} value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder={t('tools.textPlaceholder')} />
          </div>
          <button className="btn btn-primary" onClick={handleWrite} disabled={loading}>
            {loading ? <><span className="spinner" /> {t('common.processing')}</> : t('tools.executeAction', { action: t(`writing.${selectedAction}`) })}
          </button>
        </div>
      )}

      {activeTool === 'grammar' && (
        <div className="gap-2">
          <div className="field">
            <label className="field-label">{t('tools.grammarText')}</label>
            <textarea className="textarea" rows={6} value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder={t('tools.grammarPlaceholder')} />
          </div>
          <button className="btn btn-primary" onClick={handleGrammar} disabled={loading}>
            {loading ? <><span className="spinner" /> {t('tools.correcting')}</> : t('tools.grammarAction')}
          </button>
        </div>
      )}

      {activeTool === 'comments' && (
        <div className="gap-2">
          <p style={{ fontSize: 12, color: 'var(--text2)' }}>
            {t('tools.commentsDesc')}
          </p>
          <button className="btn btn-primary" onClick={handleComments} disabled={loading}>
            {loading ? <><span className="spinner" /> {t('tools.analyzingComments')}</> : t('tools.commentsAction')}
          </button>
        </div>
      )}

      {activeTool === 'insight' && (
        <div className="gap-2">
          <p style={{ fontSize: 12, color: 'var(--text2)' }}>
            {t('tools.insightDesc')}
          </p>
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
      )}

      {activeTool === 'pdf' && (
        <div className="gap-2">
          <p style={{ fontSize: 12, color: 'var(--text2)' }}>
            {t('tools.pdfDesc')}
          </p>
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
      )}

      {activeTool === 'ocr' && (
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
      )}

      {/* Result */}
      {result && (
        <div className="result-box">
          <div className="result-header">
            <span>{t('common.result')}</span>
            <button className="btn btn-ghost btn-xs" onClick={() => { navigator.clipboard.writeText(result); showToast(t('common.copied') + '!') }}>{t('common.copy')}</button>
          </div>
          <div className="result-content">{result}</div>
        </div>
      )}

      {toast && <div className="copy-toast">{toast}</div>}
    </div>
  )
}
