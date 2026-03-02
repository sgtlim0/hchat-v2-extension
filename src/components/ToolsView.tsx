import { useState } from 'react'
import { useProvider } from '../hooks/useProvider'
import { Usage } from '../lib/usage'
import type { Config } from '../hooks/useConfig'
import { useLocale } from '../i18n'
import ko from '../i18n/ko'
import en from '../i18n/en'

import SummarizeTool from './tools/SummarizeTool'
import MultiTabTool from './tools/MultiTabTool'
import YouTubeTool from './tools/YouTubeTool'
import CommentsTool from './tools/CommentsTool'
import InsightTool from './tools/InsightTool'
import PdfTool from './tools/PdfTool'
import TranslateTool from './tools/TranslateTool'
import WriteTool from './tools/WriteTool'
import GrammarTool from './tools/GrammarTool'
import OcrTool from './tools/OcrTool'
import DataAnalysisTool from './tools/DataAnalysisTool'

type ToolId = 'summarize' | 'multitab' | 'translate' | 'write' | 'youtube' | 'ocr' | 'grammar' | 'comments' | 'pdf' | 'insight' | 'dataAnalysis'

interface Props { config: Config }

export default function ToolsView({ config }: Props) {
  const { t, locale } = useLocale()
  const { getProvider, hasAnyKey } = useProvider(config)

  const TOOLS: { id: ToolId; icon: string }[] = [
    { id: 'summarize', icon: '📄' },
    { id: 'multitab', icon: '📑' },
    { id: 'youtube', icon: '▶️' },
    { id: 'comments', icon: '💬' },
    { id: 'insight', icon: '📊' },
    { id: 'pdf', icon: '📑' },
    { id: 'translate', icon: '🌐' },
    { id: 'write', icon: '✏️' },
    { id: 'grammar', icon: '✅' },
    { id: 'ocr', icon: '🔍' },
    { id: 'dataAnalysis', icon: '📊' },
  ]

  const LANGS = locale === 'en' ? en.tools.langs : ko.tools.langs
  const [activeTool, setActiveTool] = useState<ToolId | null>(null)
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')

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

  // --- Tool Grid (no active tool) ---
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

  // --- Active Tool View ---
  const tool = TOOLS.find((t) => t.id === activeTool)!
  const commonProps = { loading, setLoading, setResult, runStream, showToast, t, locale }

  const renderToolPanel = () => {
    switch (activeTool) {
      case 'summarize': return <SummarizeTool {...commonProps} />
      case 'multitab': return <MultiTabTool {...commonProps} />
      case 'youtube': return <YouTubeTool {...commonProps} />
      case 'comments': return <CommentsTool {...commonProps} />
      case 'insight': return <InsightTool {...commonProps} result={result} getProvider={getProvider} activeModel={activeModel} />
      case 'pdf': return <PdfTool {...commonProps} />
      case 'translate': return <TranslateTool {...commonProps} langs={LANGS} />
      case 'write': return <WriteTool {...commonProps} />
      case 'grammar': return <GrammarTool {...commonProps} />
      case 'ocr': return <OcrTool {...commonProps} runVisionStream={runVisionStream} />
      case 'dataAnalysis': return <DataAnalysisTool {...commonProps} />
    }
  }

  return (
    <div className="tool-view">
      <div className="tool-view-header">
        <button className="btn btn-ghost btn-xs" onClick={() => { setActiveTool(null); setResult('') }}>{t('common.back')}</button>
        <span className="tool-view-title">{tool.icon} {t(`tools.${tool.id}.title`)}</span>
      </div>

      {renderToolPanel()}

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
