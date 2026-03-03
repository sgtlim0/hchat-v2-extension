import { useState, useRef, useCallback, useEffect } from 'react'
import {
  parseDocxTemplate,
  TemplateParseError,
  type ParsedTemplate,
} from '../../lib/docTemplateParser'
import {
  generateFieldSuggestions,
  generateFullTemplateDoc,
  type GeneratedTemplateDoc,
} from '../../lib/docTemplateGenerator'
import { markdownToDocx } from '../../lib/docGenerator'
import { DocProjects } from '../../lib/docProjects'
import { downloadBlob } from '../../lib/exportChat'
import { DocTemplateStore, base64ToFile, type SavedTemplate } from '../../lib/docTemplateStore'
import type { ToolPanelProps } from './types'

type Props = Pick<ToolPanelProps, 'loading' | 'setLoading' | 'setResult' | 'showToast' | 't' | 'locale'> & {
  runStreamDirect: (prompt: string, model?: string) => Promise<string>
}

type Step = 'upload' | 'fields' | 'generating' | 'result'

export default function DocTemplateTool({
  loading, setLoading, setResult, showToast, t, runStreamDirect,
}: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [template, setTemplate] = useState<ParsedTemplate | null>(null)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [generatedDoc, setGeneratedDoc] = useState<GeneratedTemplateDoc | null>(null)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [suggesting, setSuggesting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const originalFileRef = useRef<File | null>(null)
  const [activeTab, setActiveTab] = useState<'gallery' | 'upload'>('upload')
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([])
  const [templateName, setTemplateName] = useState('')

  const handleFile = useCallback(async (file: File) => {
    originalFileRef.current = file
    setResult('')
    setTemplate(null)
    setFieldValues({})
    setGeneratedDoc(null)

    try {
      setLoading(true)
      const parsed = await parseDocxTemplate(file)
      setTemplate(parsed)

      if (parsed.fields.length === 0) {
        setResult(t('tools.docTemplate.noFields'))
        setStep('upload')
        return
      }

      // Initialize field values
      const initial: Record<string, string> = {}
      for (const field of parsed.fields) {
        initial[field.name] = field.defaultValue ?? ''
      }
      setFieldValues(initial)
      setStep('fields')
    } catch (err) {
      if (err instanceof TemplateParseError) {
        setResult(`Error: ${err.message}`)
      } else {
        setResult(t('tools.docTemplate.parseError'))
      }
    } finally {
      setLoading(false)
    }
  }, [setResult, setLoading, t])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
    e.target.value = ''
  }, [handleFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleFieldChange = useCallback((name: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [name]: value }))
  }, [])

  const handleSuggestAll = useCallback(async () => {
    if (!template) return
    setSuggesting(true)
    try {
      const suggestions = await generateFieldSuggestions(
        template.fields,
        template.rawMarkdown,
        runStreamDirect,
      )
      setFieldValues((prev) => {
        const updated = { ...prev }
        for (const [key, value] of Object.entries(suggestions)) {
          if (!updated[key] || updated[key].trim() === '') {
            updated[key] = value
          }
        }
        return updated
      })
    } catch (err) {
      showToast('Error: ' + String(err))
    } finally {
      setSuggesting(false)
    }
  }, [template, runStreamDirect, showToast])

  const handleGenerate = useCallback(async () => {
    if (!template) return
    setLoading(true)
    setResult('')
    setStep('generating')
    setProgress({ current: 0, total: template.sections.length })

    try {
      const doc = await generateFullTemplateDoc(
        template,
        fieldValues,
        runStreamDirect,
        (current, total) => setProgress({ current, total }),
      )
      setGeneratedDoc(doc)
      setResult(doc.markdown)
      setStep('result')
    } catch (err) {
      setResult('Error: ' + String(err))
      setStep('fields')
    } finally {
      setLoading(false)
    }
  }, [template, fieldValues, runStreamDirect, setLoading, setResult])

  const handleDownloadMd = useCallback(() => {
    if (!generatedDoc) return
    const blob = new Blob([generatedDoc.markdown], { type: 'text/markdown;charset=utf-8' })
    downloadBlob(blob, `${generatedDoc.title}.md`)
    showToast(t('common.downloadComplete'))
  }, [generatedDoc, showToast, t])

  const handleDownloadDocx = useCallback(async () => {
    if (!generatedDoc) return
    try {
      const blob = await markdownToDocx(generatedDoc.markdown, generatedDoc.title)
      downloadBlob(blob, `${generatedDoc.title}.docx`)
      showToast(t('common.downloadComplete'))
    } catch (err) {
      showToast('Error: ' + String(err))
    }
  }, [generatedDoc, showToast, t])

  const handleSaveAsProject = useCallback(async () => {
    if (!generatedDoc || !template) return
    try {
      await DocProjects.create({
        title: generatedDoc.title,
        type: 'report',
        topic: template.title,
        context: JSON.stringify(fieldValues),
        outline: generatedDoc.sections.map((s) => s.heading),
        sections: generatedDoc.sections.map((s) => ({ title: s.heading, content: s.content })),
        markdown: generatedDoc.markdown,
      })
      showToast(t('tools.docTemplate.savedAsProject'))
    } catch (err) {
      showToast('Error: ' + String(err))
    }
  }, [generatedDoc, template, fieldValues, showToast, t])

  const handleBack = useCallback(() => {
    if (step === 'fields' || step === 'generating') setStep('upload')
    else if (step === 'result') setStep('fields')
  }, [step])

  const loadGallery = useCallback(async () => {
    const list = await DocTemplateStore.list()
    setSavedTemplates(list)
  }, [])

  useEffect(() => {
    loadGallery()
  }, [loadGallery])

  const handleGallerySelect = useCallback(async (saved: SavedTemplate) => {
    const file = base64ToFile(saved.docxBase64, `${saved.name}.docx`)
    await DocTemplateStore.incrementUsage(saved.id)
    await handleFile(file)
  }, [handleFile])

  const handleSaveToGallery = useCallback(async () => {
    if (!template || !originalFileRef.current) return
    const name = templateName.trim() || template.title || 'Untitled Template'
    try {
      await DocTemplateStore.save(name, originalFileRef.current, template.fields.length, 'general')
      showToast(t('tools.docTemplate.templateSaved'))
      setTemplateName('')
      loadGallery()
    } catch (err) {
      showToast('Error: ' + String(err))
    }
  }, [template, templateName, showToast, t, loadGallery])

  return (
    <div className="gap-2">
      <p style={{ fontSize: 12, color: 'var(--text2)' }}>
        {t('tools.docTemplate.desc')}
      </p>

      {step !== 'upload' && (
        <button className="btn btn-ghost btn-xs" onClick={handleBack} style={{ alignSelf: 'flex-start' }}>
          {t('common.back')}
        </button>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <>
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
            <button
              className={`btn btn-xs ${activeTab === 'gallery' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('gallery')}
            >
              {t('tools.docTemplate.gallery')} ({savedTemplates.length})
            </button>
            <button
              className={`btn btn-xs ${activeTab === 'upload' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('upload')}
            >
              {t('tools.docTemplate.uploadZone').split('(')[0].trim()}
            </button>
          </div>

          {activeTab === 'upload' && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--border)',
                borderRadius: 8,
                padding: '20px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                fontSize: 12,
                color: 'var(--text2)',
                transition: 'border-color 0.2s',
              }}
            >
              {t('tools.docTemplate.uploadZone')}
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx"
                style={{ display: 'none' }}
                onChange={handleFileInput}
              />
            </div>
          )}

          {activeTab === 'gallery' && (
            <>
              {savedTemplates.length === 0 && (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text3)', fontSize: 12 }}>
                  {t('tools.docTemplate.noSavedTemplates')}
                </div>
              )}
              {savedTemplates.map((st) => (
                <div
                  key={st.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onClick={() => handleGallerySelect(st)}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg2)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {st.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {st.fieldCount} fields · {t('assistant.usageCount', { n: st.usageCount })}
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      DocTemplateStore.delete(st.id).then(() => loadGallery())
                    }}
                    style={{ color: 'var(--danger)', flexShrink: 0 }}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {/* Step 2: Fields */}
      {step === 'fields' && template && (
        <>
          <div className="field">
            <label className="field-label">
              {t('tools.docTemplate.fieldsTitle')} ({template.fields.length})
            </label>
            <p style={{ fontSize: 11, color: 'var(--text3)', margin: '0 0 8px' }}>
              {t('tools.docTemplate.fieldsDesc')}
            </p>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleSuggestAll}
            disabled={suggesting}
          >
            {suggesting
              ? <><span className="spinner" /> {t('tools.docTemplate.suggesting')}</>
              : t('tools.docTemplate.suggestAll')
            }
          </button>

          {originalFileRef.current && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                className="input"
                placeholder={t('tools.docTemplate.templateName')}
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                style={{ flex: 1, fontSize: 12 }}
              />
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleSaveToGallery}
                style={{ flexShrink: 0 }}
              >
                {t('tools.docTemplate.saveTemplate')}
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {template.fields.map((field) => (
              <div key={field.id} className="field">
                <label className="field-label" style={{ fontSize: 12 }}>
                  {`{{${field.name}}}`}
                </label>
                <input
                  className="input"
                  value={fieldValues[field.name] ?? ''}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  placeholder={field.label}
                />
              </div>
            ))}
          </div>

          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={loading}
          >
            {t('tools.docTemplate.generateFromTemplate')}
          </button>
        </>
      )}

      {/* Step 3: Generating */}
      {step === 'generating' && (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <span className="spinner" />
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>
            {t('tools.docTemplate.generating')} ({progress.current}/{progress.total})
          </div>
          {progress.total > 0 && (
            <div style={{ width: '100%', height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden', marginTop: 8 }}>
              <div style={{
                width: `${(progress.current / progress.total) * 100}%`,
                height: '100%',
                background: 'var(--accent)',
                transition: 'width 0.3s ease',
              }} />
            </div>
          )}
        </div>
      )}

      {/* Step 4: Result */}
      {step === 'result' && generatedDoc && (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleDownloadMd}>
              {t('tools.docTemplate.downloadMd')}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleDownloadDocx}>
              {t('tools.docTemplate.downloadDocx')}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleSaveAsProject}>
              {t('tools.docTemplate.saveAsProject')}
            </button>
          </div>

          <div className="field">
            <label className="field-label">{t('tools.docTemplate.preview')}</label>
            <pre style={{
              fontSize: 12,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              background: 'var(--bg2)',
              padding: 12,
              borderRadius: 8,
              border: '1px solid var(--border)',
              maxHeight: 400,
              overflow: 'auto',
            }}>
              {generatedDoc.markdown}
            </pre>
          </div>
        </>
      )}
    </div>
  )
}
