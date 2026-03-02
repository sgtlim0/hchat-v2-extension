import { useState, useCallback } from 'react'
import {
  generateOutline,
  generateFullDoc,
  exportAsMarkdown,
  markdownToDocx,
  type DocType,
  type GeneratedDoc,
} from '../../lib/docGenerator'
import { DocProjects, type DocProject } from '../../lib/docProjects'
import { downloadBlob } from '../../lib/exportChat'
import DocProjectList from './DocProjectList'
import DocProjectDetail from './DocProjectDetail'
import type { ToolPanelProps } from './types'

type Props = Pick<ToolPanelProps, 'loading' | 'setLoading' | 'setResult' | 'showToast' | 't' | 'locale'> & {
  runStreamDirect: (prompt: string, model?: string) => Promise<string>
}

type Step = 'input' | 'outline' | 'result'
type View = 'editor' | 'projectList' | 'projectDetail'

const DOC_TYPES: DocType[] = ['report', 'email', 'proposal', 'meeting', 'memo']

export default function DocWriteTool({
  loading, setLoading, setResult, showToast, t, locale: _locale, runStreamDirect,
}: Props) {
  const [view, setView] = useState<View>('editor')
  const [step, setStep] = useState<Step>('input')
  const [docType, setDocType] = useState<DocType>('report')
  const [topic, setTopic] = useState('')
  const [context, setContext] = useState('')
  const [outline, setOutline] = useState<string[]>([])
  const [generatedDoc, setGeneratedDoc] = useState<GeneratedDoc | null>(null)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  const handleGenerateOutline = async () => {
    if (!topic.trim()) { setResult(t('tools.docWrite.noTopic')); return }
    setLoading(true)
    setResult('')
    try {
      const result = await generateOutline(topic, docType, context, runStreamDirect)
      setOutline(result)
      setStep('outline')
    } catch (err) {
      setResult('Error: ' + String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateDoc = async () => {
    if (outline.length === 0) { setResult(t('tools.docWrite.noOutline')); return }
    setLoading(true)
    setResult('')
    setProgress({ current: 0, total: outline.length })
    try {
      const doc = await generateFullDoc(
        topic, docType, context, outline, runStreamDirect,
        (current, total) => setProgress({ current, total }),
      )
      setGeneratedDoc(doc)
      setResult(doc.markdown)
      setStep('result')
    } catch (err) {
      setResult('Error: ' + String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleAddSection = () => {
    setOutline((prev) => [...prev, ''])
  }

  const handleRemoveSection = (index: number) => {
    setOutline((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpdateSection = (index: number, value: string) => {
    setOutline((prev) => prev.map((item, i) => (i === index ? value : item)))
  }

  const handleMoveSection = (index: number, direction: -1 | 1) => {
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

  const handleDownloadMd = () => {
    if (!generatedDoc) return
    const blob = exportAsMarkdown(generatedDoc)
    downloadBlob(blob, `${generatedDoc.title}.md`)
    showToast(t('common.downloadComplete'))
  }

  const handleDownloadDocx = async () => {
    if (!generatedDoc) return
    try {
      const blob = await markdownToDocx(generatedDoc.markdown, generatedDoc.title)
      downloadBlob(blob, `${generatedDoc.title}.docx`)
      showToast(t('common.downloadComplete'))
    } catch (err) {
      showToast('Error: ' + String(err))
    }
  }

  const handleSaveProject = useCallback(async () => {
    if (!generatedDoc) return
    try {
      await DocProjects.create({
        title: generatedDoc.title,
        type: generatedDoc.type,
        topic,
        context,
        outline,
        sections: generatedDoc.sections,
        markdown: generatedDoc.markdown,
      })
      showToast(t('tools.docWrite.projectSaved'))
    } catch (err) {
      showToast('Error: ' + String(err))
    }
  }, [generatedDoc, topic, context, outline, showToast, t])

  const handleProjectSelect = useCallback((id: string) => {
    setSelectedProjectId(id)
    setView('projectDetail')
  }, [])

  const handleEditProject = useCallback((project: DocProject) => {
    setDocType(project.type)
    setTopic(project.topic)
    setContext(project.context)
    setOutline(project.outline)
    setGeneratedDoc({
      title: project.title,
      type: project.type,
      sections: project.sections,
      markdown: project.markdown,
      createdAt: project.createdAt,
    })
    setStep('result')
    setView('editor')
    setResult(project.markdown)
  }, [setResult])

  const handleBack = () => {
    if (step === 'outline') setStep('input')
    else if (step === 'result') setStep('outline')
  }

  // --- Project views ---
  if (view === 'projectList') {
    return (
      <DocProjectList
        t={t}
        onSelect={handleProjectSelect}
        onBack={() => setView('editor')}
        showToast={showToast}
      />
    )
  }

  if (view === 'projectDetail' && selectedProjectId) {
    return (
      <DocProjectDetail
        t={t}
        projectId={selectedProjectId}
        onBack={() => setView('projectList')}
        onEdit={handleEditProject}
        showToast={showToast}
      />
    )
  }

  // --- Editor view ---
  return (
    <div className="gap-2">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {step !== 'input' ? (
          <button className="btn btn-ghost btn-xs" onClick={handleBack}>
            {t('common.back')}
          </button>
        ) : <span />}
        <button
          className="btn btn-ghost btn-xs"
          onClick={() => setView('projectList')}
        >
          {t('tools.docWrite.openProjects')}
        </button>
      </div>

      {step === 'input' && (
        <>
          <div className="field">
            <label className="field-label">{t('tools.docWrite.docType')}</label>
            <select
              className="select"
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocType)}
            >
              {DOC_TYPES.map((dt) => (
                <option key={dt} value={dt}>{t(`tools.docWrite.type_${dt}`)}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label">{t('tools.docWrite.topicLabel')}</label>
            <textarea
              className="textarea"
              rows={3}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t('tools.docWrite.topicPlaceholder')}
            />
          </div>
          <div className="field">
            <label className="field-label">{t('tools.docWrite.contextLabel')}</label>
            <textarea
              className="textarea"
              rows={3}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder={t('tools.docWrite.contextPlaceholder')}
            />
          </div>
          <button className="btn btn-primary" onClick={handleGenerateOutline} disabled={loading}>
            {loading
              ? <><span className="spinner" /> {t('tools.docWrite.generatingOutline')}</>
              : t('tools.docWrite.generateOutline')}
          </button>
        </>
      )}

      {step === 'outline' && (
        <>
          <div className="field">
            <label className="field-label">{t('tools.docWrite.outlineTitle')}</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {outline.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text3)', minWidth: 18 }}>{i + 1}.</span>
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    value={item}
                    onChange={(e) => handleUpdateSection(i, e.target.value)}
                  />
                  <button className="btn btn-ghost btn-xs" onClick={() => handleMoveSection(i, -1)} disabled={i === 0}>↑</button>
                  <button className="btn btn-ghost btn-xs" onClick={() => handleMoveSection(i, 1)} disabled={i === outline.length - 1}>↓</button>
                  <button className="btn btn-ghost btn-xs" onClick={() => handleRemoveSection(i)} style={{ color: 'var(--danger)' }}>
                    {t('tools.docWrite.removeSection')}
                  </button>
                </div>
              ))}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleAddSection}>
            {t('tools.docWrite.addSection')}
          </button>
          <button className="btn btn-primary" onClick={handleGenerateDoc} disabled={loading}>
            {loading
              ? <><span className="spinner" /> {t('tools.docWrite.generatingDoc', { current: progress.current, total: progress.total })}</>
              : t('tools.docWrite.generateDoc')}
          </button>
          {loading && progress.total > 0 && (
            <div style={{ width: '100%', height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                width: `${(progress.current / progress.total) * 100}%`,
                height: '100%',
                background: 'var(--accent)',
                transition: 'width 0.3s ease',
              }} />
            </div>
          )}
        </>
      )}

      {step === 'result' && generatedDoc && (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleDownloadMd}>
              {t('tools.docWrite.downloadMd')}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleDownloadDocx}>
              {t('tools.docWrite.downloadDocx')}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleSaveProject}>
              {t('tools.docWrite.saveProject')}
            </button>
          </div>
          <div className="field">
            <label className="field-label">{t('tools.docWrite.preview')}</label>
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
