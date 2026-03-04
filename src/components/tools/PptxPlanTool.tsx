import { useState } from 'react'
import {
  generateOutline,
  generateSlideContent,
  generatePptx,
  type SlideContent,
  type PptxPlanConfig,
} from '../../lib/pptxGenerator'
import { downloadBlob } from '../../lib/exportChat'
import type { ToolPanelProps } from './types'

type Props = Pick<
  ToolPanelProps,
  'loading' | 'setLoading' | 'setResult' | 'showToast' | 't' | 'locale'
> & {
  runStreamDirect: (prompt: string, model?: string) => Promise<string>
  getProvider: (model: string) => {
    stream: (params: {
      model: string
      messages: { role: 'user' | 'assistant'; content: string }[]
    }) => AsyncGenerator<string, string>
    isConfigured: () => boolean
  }
  activeModel: string
}

type Step = 'input' | 'outline' | 'generating' | 'preview' | 'done'

export default function PptxPlanTool({
  loading,
  setLoading,
  setResult,
  showToast,
  t,
  locale,
  getProvider,
  activeModel,
}: Props) {
  const [step, setStep] = useState<Step>('input')
  const [topic, setTopic] = useState('')
  const [slideCount, setSlideCount] = useState(8)
  const [style, setStyle] = useState<'business' | 'academic' | 'casual'>('business')
  const [outline, setOutline] = useState<string[]>([])
  const [slides, setSlides] = useState<SlideContent[]>([])
  const [progress, setProgress] = useState({ current: 0, total: 0 })


  const handleGenerateOutline = async () => {
    if (!topic.trim()) {
      setResult(t('tools.pptxPlan.noTopic'))
      return
    }
    setLoading(true)
    setResult('')
    try {
      const provider = getProvider(activeModel)
      if (!provider.isConfigured()) {
        setResult(t('common.setApiKeyFirst'))
        return
      }

      const config: PptxPlanConfig = { topic, slideCount, style, locale }
      const result = await generateOutline(provider, activeModel, config)
      setOutline(result)
      setStep('outline')
    } catch (err) {
      setResult('Error: ' + String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateContent = async () => {
    if (outline.length === 0) {
      setResult(t('tools.pptxPlan.noOutline'))
      return
    }
    setLoading(true)
    setResult('')
    setProgress({ current: 0, total: outline.length })
    setStep('generating')

    try {
      const provider = getProvider(activeModel)
      if (!provider.isConfigured()) {
        setResult(t('common.setApiKeyFirst'))
        return
      }

      const config: PptxPlanConfig = { topic, slideCount, style, locale }
      const generatedSlides: SlideContent[] = []

      for (let i = 0; i < outline.length; i++) {
        setProgress({ current: i + 1, total: outline.length })
        const content = await generateSlideContent(
          provider,
          activeModel,
          outline[i],
          config,
          i,
          outline.length,
        )
        generatedSlides.push(content)
      }

      setSlides(generatedSlides)
      setStep('preview')
    } catch (err) {
      setResult('Error: ' + String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    if (slides.length === 0) return
    try {
      const pptxBlob = await generatePptx(slides)
      downloadBlob(pptxBlob, `${topic}.pptx`)
      showToast(t('common.downloadComplete'))
      setStep('done')
    } catch (err) {
      showToast('Error: ' + String(err))
    }
  }

  const handleAddSlide = () => {
    setOutline((prev) => [...prev, ''])
  }

  const handleRemoveSlide = (index: number) => {
    setOutline((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpdateSlide = (index: number, value: string) => {
    setOutline((prev) => prev.map((item, i) => (i === index ? value : item)))
  }

  const handleMoveSlide = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= outline.length) return
    setOutline((prev) => {
      const next = [...prev]
      const temp = next[index]
      next[index] = next[target]
      next[target] = temp
      return next
    })
  }

  const handleBack = () => {
    if (step === 'outline') setStep('input')
    else if (step === 'preview') setStep('outline')
    else if (step === 'done') setStep('preview')
  }

  return (
    <div className="gap-2">
      {step !== 'input' && (
        <button className="btn btn-ghost btn-xs" onClick={handleBack}>
          {t('common.back')}
        </button>
      )}

      {step === 'input' && (
        <>
          <div className="field">
            <label className="field-label">{t('tools.pptxPlan.topic')}</label>
            <textarea
              className="textarea"
              rows={3}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t('tools.pptxPlan.topicPlaceholder')}
            />
          </div>
          <div className="field">
            <label className="field-label">{t('tools.pptxPlan.slideCount')}</label>
            <input
              type="number"
              className="input"
              value={slideCount}
              onChange={(e) =>
                setSlideCount(Math.max(5, Math.min(15, parseInt(e.target.value) || 5)))
              }
              min={5}
              max={15}
            />
          </div>
          <div className="field">
            <label className="field-label">{t('tools.pptxPlan.style')}</label>
            <select
              className="select"
              value={style}
              onChange={(e) =>
                setStyle(e.target.value as 'business' | 'academic' | 'casual')
              }
            >
              <option value="business">{t('tools.pptxPlan.styleBusiness')}</option>
              <option value="academic">{t('tools.pptxPlan.styleAcademic')}</option>
              <option value="casual">{t('tools.pptxPlan.styleCasual')}</option>
            </select>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleGenerateOutline}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" /> {t('tools.pptxPlan.generatingOutline')}
              </>
            ) : (
              t('tools.pptxPlan.generateOutline')
            )}
          </button>
        </>
      )}

      {step === 'outline' && (
        <>
          <div className="field">
            <label className="field-label">{t('tools.pptxPlan.editOutline')}</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {outline.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span
                    style={{ fontSize: 11, color: 'var(--text3)', minWidth: 18 }}
                  >
                    {i + 1}.
                  </span>
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    value={item}
                    onChange={(e) => handleUpdateSlide(i, e.target.value)}
                  />
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => handleMoveSlide(i, -1)}
                    disabled={i === 0}
                  >
                    ↑
                  </button>
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => handleMoveSlide(i, 1)}
                    disabled={i === outline.length - 1}
                  >
                    ↓
                  </button>
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => handleRemoveSlide(i)}
                    style={{ color: 'var(--danger)' }}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              ))}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleAddSlide}>
            {t('common.add')}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleGenerateContent}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" />{' '}
                {t('tools.pptxPlan.generating', {
                  current: progress.current,
                  total: progress.total,
                })}
              </>
            ) : (
              t('tools.pptxPlan.generateContent')
            )}
          </button>
          {loading && progress.total > 0 && (
            <div
              style={{
                width: '100%',
                height: 4,
                background: 'var(--bg3)',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${(progress.current / progress.total) * 100}%`,
                  height: '100%',
                  background: 'var(--accent)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          )}
        </>
      )}

      {(step === 'preview' || step === 'done') && (
        <>
          <button className="btn btn-primary btn-sm" onClick={handleDownload}>
            {t('tools.pptxPlan.download')}
          </button>
          <div className="field">
            <label className="field-label">{t('tools.pptxPlan.preview')}</label>
            <div
              style={{
                maxHeight: 400,
                overflow: 'auto',
                background: 'var(--bg2)',
                padding: 12,
                borderRadius: 8,
                border: '1px solid var(--border)',
              }}
            >
              {slides.map((slide, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: 20,
                    paddingBottom: 16,
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      marginBottom: 8,
                      color: 'var(--text1)',
                    }}
                  >
                    {i + 1}. {slide.title}
                  </div>
                  <ul style={{ paddingLeft: 20, margin: 0, listStyle: 'disc' }}>
                    {slide.bullets.map((bullet, j) => (
                      <li key={j} style={{ fontSize: 13, marginBottom: 4 }}>
                        {bullet}
                      </li>
                    ))}
                  </ul>
                  {slide.notes && (
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text3)',
                        marginTop: 8,
                        fontStyle: 'italic',
                      }}
                    >
                      📝 {slide.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
