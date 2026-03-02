import { useState, useEffect, useCallback } from 'react'
import { DocProjects, type DocProject, type DocProjectVersion } from '../../lib/docProjects'
import { exportAsMarkdown, markdownToDocx } from '../../lib/docGenerator'
import { downloadBlob } from '../../lib/exportChat'
import type { TFunction } from '../../i18n'

interface Props {
  t: TFunction
  projectId: string
  onBack: () => void
  onEdit: (project: DocProject) => void
  showToast: (msg: string) => void
}

export default function DocProjectDetail({ t, projectId, onBack, onEdit, showToast }: Props) {
  const [project, setProject] = useState<DocProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [showVersions, setShowVersions] = useState(false)

  const loadProject = useCallback(async () => {
    setLoading(true)
    try {
      const p = await DocProjects.get(projectId)
      setProject(p)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { loadProject() }, [loadProject])

  const handleSaveVersion = useCallback(async () => {
    if (!project) return
    await DocProjects.saveVersion(project.id)
    showToast(t('tools.docWrite.versionSaved'))
    loadProject()
  }, [project, showToast, t, loadProject])

  const handleRestoreVersion = useCallback(async (version: DocProjectVersion) => {
    if (!project) return
    const ok = confirm(t('tools.docWrite.restoreConfirm'))
    if (!ok) return

    const restored = await DocProjects.restoreVersion(project.id, version.id)
    if (restored) {
      setProject(restored)
      showToast(t('tools.docWrite.versionRestored'))
    }
  }, [project, showToast, t])

  const handleDownloadMd = useCallback(() => {
    if (!project) return
    const blob = exportAsMarkdown({
      title: project.title,
      type: project.type,
      sections: project.sections,
      markdown: project.markdown,
      createdAt: project.createdAt,
    })
    downloadBlob(blob, `${project.title}.md`)
    showToast(t('common.downloadComplete'))
  }, [project, showToast, t])

  const handleDownloadDocx = useCallback(async () => {
    if (!project) return
    try {
      const blob = await markdownToDocx(project.markdown, project.title)
      downloadBlob(blob, `${project.title}.docx`)
      showToast(t('common.downloadComplete'))
    } catch (err) {
      showToast('Error: ' + String(err))
    }
  }, [project, showToast, t])

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 20 }}>
        <span className="spinner" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="gap-2">
        <button className="btn btn-ghost btn-xs" onClick={onBack}>{t('common.back')}</button>
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text3)' }}>
          {t('tools.docWrite.projectNotFound')}
        </div>
      </div>
    )
  }

  return (
    <div className="gap-2">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-ghost btn-xs" onClick={onBack}>{t('common.back')}</button>
        <button className="btn btn-ghost btn-xs" onClick={() => onEdit(project)}>
          {t('tools.docWrite.editProject')}
        </button>
      </div>

      {/* Project header */}
      <div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{project.title}</div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
          {t(`tools.docWrite.type_${project.type}`)} · {t('tools.docWrite.savedAt', { date: formatDate(project.updatedAt) })}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={handleDownloadMd}>
          {t('tools.docWrite.downloadMd')}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={handleDownloadDocx}>
          {t('tools.docWrite.downloadDocx')}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={handleSaveVersion}>
          {t('tools.docWrite.saveVersion')}
        </button>
      </div>

      {/* Preview */}
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
          maxHeight: 300,
          overflow: 'auto',
        }}>
          {project.markdown}
        </pre>
      </div>

      {/* Version history */}
      <div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setShowVersions(!showVersions)}
        >
          {t('tools.docWrite.versions')} ({project.versions.length})
          {showVersions ? ' ▲' : ' ▼'}
        </button>

        {showVersions && project.versions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
            {[...project.versions].reverse().map((v) => (
              <div
                key={v.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  fontSize: 11,
                }}
              >
                <span style={{ color: 'var(--text2)' }}>
                  {formatDate(v.createdAt)}
                  <span style={{ color: 'var(--text3)', marginLeft: 6 }}>
                    ({v.sections.length} {t('tools.docWrite.sections')})
                  </span>
                </span>
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => handleRestoreVersion(v)}
                >
                  {t('tools.docWrite.restoreVersion')}
                </button>
              </div>
            ))}
          </div>
        )}

        {showVersions && project.versions.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--text3)', padding: 8 }}>
            {t('tools.docWrite.noVersions')}
          </div>
        )}
      </div>
    </div>
  )
}
