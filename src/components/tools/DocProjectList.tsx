import { useState, useEffect, useCallback } from 'react'
import { DocProjects, type DocProjectIndex } from '../../lib/docProjects'
import type { TFunction } from '../../i18n'

interface Props {
  t: TFunction
  onSelect: (id: string) => void
  onBack: () => void
  showToast: (msg: string) => void
}

export default function DocProjectList({ t, onSelect, onBack, showToast }: Props) {
  const [projects, setProjects] = useState<DocProjectIndex[]>([])
  const [loading, setLoading] = useState(true)

  const loadProjects = useCallback(async () => {
    setLoading(true)
    try {
      const list = await DocProjects.list()
      setProjects(list)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadProjects() }, [loadProjects])

  const handleDelete = useCallback(async (id: string, title: string) => {
    const ok = confirm(t('tools.docWrite.deleteConfirm', { title }))
    if (!ok) return

    await DocProjects.delete(id)
    showToast(t('tools.docWrite.projectDeleted'))
    loadProjects()
  }, [t, showToast, loadProjects])

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  const typeLabel = (type: string) => {
    return t(`tools.docWrite.type_${type}`) || type
  }

  return (
    <div className="gap-2">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-ghost btn-xs" onClick={onBack}>
          {t('common.back')}
        </button>
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          {t('tools.docWrite.projects')}
        </span>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text3)' }}>
          <span className="spinner" />
        </div>
      )}

      {!loading && projects.length === 0 && (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text3)', fontSize: 12 }}>
          {t('tools.docWrite.noProjects')}
        </div>
      )}

      {!loading && projects.map((p) => (
        <div
          key={p.id}
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
          onClick={() => onSelect(p.id)}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg2)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.title}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
              {typeLabel(p.type)} · {formatDate(p.updatedAt)}
            </div>
          </div>
          <button
            className="btn btn-ghost btn-xs"
            onClick={(e) => { e.stopPropagation(); handleDelete(p.id, p.title) }}
            style={{ color: 'var(--danger)', flexShrink: 0 }}
          >
            {t('tools.docWrite.deleteProject')}
          </button>
        </div>
      ))}
    </div>
  )
}
