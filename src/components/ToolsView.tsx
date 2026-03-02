import { useState, useRef } from 'react'
import { useProvider } from '../hooks/useProvider'
import { getCurrentPageContent, getYouTubeTranscript, fileToBase64, truncate } from '../lib/pageReader'
import { WRITING_ACTIONS, buildWritingPrompt, type WritingAction } from '../lib/writingTools'
import { extractComments, buildCommentAnalysisPrompt } from '../lib/commentAnalyzer'
import { extractPdfText, formatFileSize } from '../lib/pdfParser'
import { generateInsightReport, type ReportProgress } from '../lib/insightReport'
import { Usage } from '../lib/usage'
import type { Config } from '../hooks/useConfig'

type ToolId = 'summarize' | 'translate' | 'write' | 'youtube' | 'ocr' | 'grammar' | 'comments' | 'pdf' | 'insight'

interface ToolDef { id: ToolId; icon: string; title: string; desc: string }

const TOOLS: ToolDef[] = [
  { id: 'summarize', icon: '📄', title: '페이지 요약', desc: '현재 페이지를 즉시 요약합니다' },
  { id: 'youtube', icon: '▶️', title: 'YouTube 요약', desc: '유튜브 영상 내용을 핵심만 추출합니다' },
  { id: 'comments', icon: '💬', title: '댓글 분석', desc: 'YouTube 댓글 감정·토픽·인사이트 분석' },
  { id: 'insight', icon: '📊', title: '인사이트 리포트', desc: 'YouTube 자막+댓글 종합 분석 리포트' },
  { id: 'pdf', icon: '📑', title: 'PDF 채팅', desc: 'PDF 업로드 후 내용에 대해 질문합니다' },
  { id: 'translate', icon: '🌐', title: '텍스트 번역', desc: '50개 이상의 언어로 번역합니다' },
  { id: 'write', icon: '✏️', title: '글쓰기 도구', desc: '교정·다듬기·재구성·톤 변경' },
  { id: 'grammar', icon: '✅', title: '문법 교정', desc: '맞춤법·문법·어색한 표현 수정' },
  { id: 'ocr', icon: '🔍', title: '이미지 OCR', desc: '이미지에서 텍스트를 추출합니다' },
]

const LANGS = ['한국어', '영어', '일본어', '중국어(간체)', '스페인어', '프랑스어', '독일어', '포르투갈어', '러시아어', '아랍어']

interface Props { config: Config }

export function ToolsView({ config }: Props) {
  const { getProvider, hasAnyKey } = useProvider(config)
  const [activeTool, setActiveTool] = useState<ToolId | null>(null)
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [inputText, setInputText] = useState('')
  const [selectedLang, setSelectedLang] = useState('한국어')
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
      if (!hasAnyKey) { setResult('❌ API 키를 먼저 설정해주세요 (설정 탭)'); return }
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
    if (!provider?.isConfigured()) { setResult('❌ AWS Bedrock 키를 설정해주세요'); return }
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
      if (!page.text) { setResult('❌ 페이지 내용을 가져올 수 없습니다'); setLoading(false); return }
      await runStream(`다음 웹페이지 내용을 핵심 위주로 5-7개 항목으로 정리하여 요약해줘. 마지막에 1~2줄의 핵심 결론도 추가해줘.\n\n제목: ${page.title}\nURL: ${page.url}\n\n내용:\n${truncate(page.text)}`)
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
      if (!page.isYouTube) { setResult('❌ 현재 탭이 YouTube 동영상이 아닙니다'); setLoading(false); return }
      const transcript = await getYouTubeTranscript(page.youtubeId!)
      if (!transcript) { setResult('❌ 자막을 찾을 수 없습니다. 자막이 있는 영상에서 시도해주세요'); setLoading(false); return }
      await runStream(`다음은 YouTube 영상의 자막입니다. 핵심 내용을 구조적으로 요약해줘:\n\n제목: ${page.title}\n\n자막:\n${transcript}`)
    } catch (err) {
      setResult('❌ ' + String(err))
      setLoading(false)
    }
  }

  const handleTranslate = async () => {
    if (!inputText.trim()) { setResult('❌ 번역할 텍스트를 입력해주세요'); return }
    await runStream(`다음 텍스트를 자연스럽고 정확하게 ${selectedLang}로 번역해줘:\n\n${inputText}`)
  }

  const handleWrite = async () => {
    if (!inputText.trim()) { setResult('❌ 텍스트를 입력해주세요'); return }
    await runStream(buildWritingPrompt(selectedAction, inputText))
  }

  const handleGrammar = async () => {
    if (!inputText.trim()) { setResult('❌ 교정할 텍스트를 입력해주세요'); return }
    await runStream(`다음 텍스트의 맞춤법, 문법, 어색한 표현을 교정하고, 교정한 내용과 이유를 함께 설명해줘:\n\n${inputText}`)
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
    await runVisionStream(imgBase64, '이 이미지에서 모든 텍스트를 추출해줘. 원본 형식과 구조를 최대한 유지해줘.')
  }

  const handleComments = async () => {
    setLoading(true)
    setResult('')
    try {
      const page = await getCurrentPageContent()
      if (!page.isYouTube) { setResult('❌ 현재 탭이 YouTube 동영상이 아닙니다'); setLoading(false); return }
      const comments = await extractComments(200)
      if (comments.length === 0) {
        setResult('❌ 댓글을 찾을 수 없습니다. 페이지를 스크롤하여 댓글을 로드한 후 다시 시도해주세요.')
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
      setResult(`PDF 로드 완료 (${formatFileSize(file.size)}, ${text.length.toLocaleString()}자 추출)\n\n아래에 질문을 입력하세요.`)
    } catch (err) {
      setResult('❌ ' + String(err))
    } finally {
      setLoading(false)
    }
  }

  const handlePdfChat = async () => {
    if (!pdfText || !pdfQuestion.trim()) return
    await runStream(`다음은 PDF 문서의 내용입니다:\n\n${pdfText.slice(0, 12000)}\n\n---\n질문: ${pdfQuestion.trim()}\n\n위 문서 내용을 기반으로 정확하게 답변해줘. 한국어로 답변하세요.`)
    setPdfQuestion('')
  }

  const handleInsightReport = async () => {
    setLoading(true)
    setResult('')
    setReportProgress({ stage: '시작 중...', percent: 0 })
    abortRef.current = new AbortController()
    try {
      const provider = getProvider(activeModel)
      if (!provider?.isConfigured()) {
        setResult('❌ API 키를 먼저 설정해주세요')
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
          도구 선택
        </div>
        <div className="tools-grid">
          {TOOLS.map((t) => (
            <button key={t.id} className="tool-card" onClick={() => { setActiveTool(t.id); setResult('') }}>
              <span className="t-icon">{t.icon}</span>
              <span className="t-title">{t.title}</span>
              <span className="t-desc">{t.desc}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const tool = TOOLS.find((t) => t.id === activeTool)!

  return (
    <div className="tool-view">
      <div className="tool-view-header">
        <button className="btn btn-ghost btn-xs" onClick={() => { setActiveTool(null); setResult('') }}>← 뒤로</button>
        <span className="tool-view-title">{tool.icon} {tool.title}</span>
      </div>

      {/* Tool-specific UI */}
      {activeTool === 'summarize' && (
        <div className="gap-2">
          <p style={{ fontSize: 12, color: 'var(--text2)' }}>현재 열린 탭의 페이지 내용을 요약합니다.</p>
          <button className="btn btn-primary" onClick={handleSummarize} disabled={loading}>
            {loading ? <><span className="spinner" /> 요약 중...</> : '현재 페이지 요약 시작'}
          </button>
        </div>
      )}

      {activeTool === 'youtube' && (
        <div className="gap-2">
          <p style={{ fontSize: 12, color: 'var(--text2)' }}>YouTube 탭에서 실행하면 영상 자막을 분석합니다.</p>
          <button className="btn btn-primary" onClick={handleYouTube} disabled={loading}>
            {loading ? <><span className="spinner" /> 분석 중...</> : '▶ YouTube 영상 요약'}
          </button>
        </div>
      )}

      {activeTool === 'translate' && (
        <div className="gap-2">
          <div className="field">
            <label className="field-label">번역 대상 언어</label>
            <select className="select" value={selectedLang} onChange={(e) => setSelectedLang(e.target.value)}>
              {LANGS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">원문 텍스트</label>
            <textarea className="textarea" rows={5} value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="번역할 텍스트를 입력하세요..." />
          </div>
          <button className="btn btn-primary" onClick={handleTranslate} disabled={loading}>
            {loading ? <><span className="spinner" /> 번역 중...</> : `${selectedLang}로 번역`}
          </button>
        </div>
      )}

      {activeTool === 'write' && (
        <div className="gap-2">
          <div className="field">
            <label className="field-label">작업 선택</label>
            <div className="writing-actions">
              {WRITING_ACTIONS.map((a) => (
                <button
                  key={a.id}
                  className={`writing-action-btn ${selectedAction === a.id ? 'active' : ''}`}
                  onClick={() => setSelectedAction(a.id)}
                >
                  <span>{a.emoji}</span>
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label className="field-label">텍스트 입력</label>
            <textarea className="textarea" rows={5} value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="작업할 텍스트를 입력하세요..." />
          </div>
          <button className="btn btn-primary" onClick={handleWrite} disabled={loading}>
            {loading ? <><span className="spinner" /> 처리 중...</> : `${WRITING_ACTIONS.find((a) => a.id === selectedAction)?.label ?? ''} 실행`}
          </button>
        </div>
      )}

      {activeTool === 'grammar' && (
        <div className="gap-2">
          <div className="field">
            <label className="field-label">교정할 텍스트</label>
            <textarea className="textarea" rows={6} value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="교정할 텍스트를 입력하세요..." />
          </div>
          <button className="btn btn-primary" onClick={handleGrammar} disabled={loading}>
            {loading ? <><span className="spinner" /> 교정 중...</> : '문법 교정 실행'}
          </button>
        </div>
      )}

      {activeTool === 'comments' && (
        <div className="gap-2">
          <p style={{ fontSize: 12, color: 'var(--text2)' }}>
            YouTube 탭에서 실행하세요. 댓글을 로드하려면 먼저 페이지를 스크롤해주세요.
          </p>
          <button className="btn btn-primary" onClick={handleComments} disabled={loading}>
            {loading ? <><span className="spinner" /> 댓글 분석 중...</> : '💬 댓글 분석 시작'}
          </button>
        </div>
      )}

      {activeTool === 'insight' && (
        <div className="gap-2">
          <p style={{ fontSize: 12, color: 'var(--text2)' }}>
            YouTube 영상의 자막과 댓글을 종합 분석하여 Markdown 리포트를 생성합니다.
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
              {loading ? <><span className="spinner" /> 리포트 생성 중...</> : '📊 인사이트 리포트 생성'}
            </button>
            {loading && (
              <button className="btn btn-secondary" onClick={handleInsightStop}>중단</button>
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
                showToast('다운로드 완료!')
              }}
            >
              Markdown 다운로드
            </button>
          )}
        </div>
      )}

      {activeTool === 'pdf' && (
        <div className="gap-2">
          <p style={{ fontSize: 12, color: 'var(--text2)' }}>
            PDF 파일을 업로드하면 내용을 추출하고, 질문에 답변합니다.
          </p>
          <label className="btn btn-secondary" style={{ cursor: 'pointer', justifyContent: 'center' }}>
            📎 PDF 업로드
            <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={handlePdfUpload} />
          </label>
          {pdfFileName && (
            <div style={{ fontSize: 11, color: 'var(--text2)', padding: '4px 0' }}>
              파일: {pdfFileName}
            </div>
          )}
          {pdfText && (
            <div className="field">
              <label className="field-label">질문 입력</label>
              <textarea
                className="textarea"
                rows={3}
                value={pdfQuestion}
                onChange={(e) => setPdfQuestion(e.target.value)}
                placeholder="PDF 내용에 대해 질문하세요..."
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePdfChat() } }}
              />
              <button
                className="btn btn-primary"
                style={{ marginTop: 8 }}
                onClick={handlePdfChat}
                disabled={loading || !pdfQuestion.trim()}
              >
                {loading ? <><span className="spinner" /> 답변 중...</> : '질문하기'}
              </button>
            </div>
          )}
        </div>
      )}

      {activeTool === 'ocr' && (
        <div className="gap-2">
          <p style={{ fontSize: 12, color: 'var(--text2)' }}>이미지에서 텍스트를 추출합니다. Vision 지원 API 키가 필요합니다.</p>
          <label className="btn btn-secondary" style={{ cursor: 'pointer', justifyContent: 'center' }}>
            📎 이미지 업로드
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleOCR} />
          </label>
          {imgBase64 && (
            <>
              <img src={imgBase64} style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 8, border: '1px solid var(--border2)' }} alt="" />
              <button className="btn btn-primary" onClick={handleOCRRun} disabled={loading}>
                {loading ? <><span className="spinner" /> 추출 중...</> : '텍스트 추출'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="result-box">
          <div className="result-header">
            <span>결과</span>
            <button className="btn btn-ghost btn-xs" onClick={() => { navigator.clipboard.writeText(result); showToast('복사됨!') }}>복사</button>
          </div>
          <div className="result-content">{result}</div>
        </div>
      )}

      {toast && <div className="copy-toast">{toast}</div>}
    </div>
  )
}
