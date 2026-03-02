import { useState, useEffect, useRef } from 'react'
import { useLocale } from '../i18n'
import { ChatHistory } from '../lib/chatHistory'
import { Tags, type TagDef } from '../lib/tags'
import { MODELS } from '../lib/models'
import { importFromFile, getSourceLabel } from '../lib/importChat'

interface Props {
  onSelect: (id: string) => void
  activeId?: string
}

type IndexItem = { id: string; title: string; updatedAt: number; pinned?: boolean; model: string; tags?: string[] }

export function HistoryView({ onSelect, activeId }: Props) {
  const { t, locale } = useLocale()
  const [index, setIndex] = useState<IndexItem[]>([])
  const [allTags, setAllTags] = useState<TagDef[]>([])
  const [search, setSearch] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState<{ convId: string; value: string } | null>(null)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportStatus(t('history.importing'))
    const result = await importFromFile(file)
    if (result.success) {
      setImportStatus(t('history.importSuccess', { source: getSourceLabel(result.source), count: result.count }))
      load()
    } else {
      setImportStatus(result.errors[0] || t('history.importFail'))
    }
    setTimeout(() => setImportStatus(null), 3000)
    e.target.value = ''
  }

  const load = () => {
    ChatHistory.listIndex().then(setIndex)
    Tags.list().then(setAllTags)
  }
  useEffect(() => { load() }, [])

  const filtered = index.filter((c) => {
    const matchesSearch = !search || c.title.toLowerCase().includes(search.toLowerCase())
    const matchesTag = !selectedTag || (c.tags ?? []).includes(selectedTag)
    return matchesSearch && matchesTag
  })

  const pinned = filtered.filter((c) => c.pinned)
  const recents = filtered.filter((c) => !c.pinned)

  const rel = (ts: number) => {
    const d = Date.now() - ts
    if (d < 3600000) return t('time.minutesAgo', { n: Math.floor(d / 60000) })
    if (d < 86400000) return t('time.hoursAgo', { n: Math.floor(d / 3600000) })
    if (d < 604800000) return t('time.daysAgo', { n: Math.floor(d / 86400000) })
    return new Date(ts).toLocaleDateString(locale === 'en' ? 'en-US' : 'ko-KR')
  }

  const modelEmoji = (modelId: string) => MODELS.find((m) => m.id === modelId)?.emoji ?? '🤖'

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm(t('history.deleteConfirm'))) return
    await ChatHistory.delete(id)
    load()
  }

  const handlePin = async (e: React.MouseEvent, id: string, pinned: boolean) => {
    e.stopPropagation()
    await ChatHistory.pin(id, !pinned)
    load()
  }

  const handleAddTag = async (convId: string, tagName: string) => {
    const name = tagName.trim()
    if (!name) return
    await Tags.add(name)
    await ChatHistory.addTag(convId, name)
    await Tags.incrementCount(name)
    setTagInput(null)
    load()
  }

  const handleRemoveTag = async (e: React.MouseEvent, convId: string, tag: string) => {
    e.stopPropagation()
    await ChatHistory.removeTag(convId, tag)
    await Tags.decrementCount(tag)
    load()
  }

  const ConvItem = ({ c }: { c: IndexItem }) => (
    <div
      className={`history-item ${c.id === activeId ? 'active' : ''}`}
      onClick={() => onSelect(c.id)}
    >
      <span className="history-icon">{modelEmoji(c.model)}</span>
      <div className="history-info">
        <div className="history-title">{c.title}</div>
        <div className="history-meta-row">
          <span className="history-meta">{rel(c.updatedAt)}</span>
          {(c.tags ?? []).map((tag) => (
            <span key={tag} className="conv-tag" onClick={(e) => { e.stopPropagation(); setSelectedTag(tag) }}>
              {tag}
              <button className="conv-tag-x" onClick={(e) => handleRemoveTag(e, c.id, tag)}>×</button>
            </span>
          ))}
        </div>
      </div>
      <div className="history-actions">
        <button className="icon-btn btn-xs" onClick={(e) => handlePin(e, c.id, !!c.pinned)} title={c.pinned ? t('history.unpin') : t('history.pin')}>
          {c.pinned ? '📌' : '📍'}
        </button>
        <button className="icon-btn btn-xs" onClick={(e) => { e.stopPropagation(); setTagInput({ convId: c.id, value: '' }) }} title={t('history.addTag')}>🏷️</button>
        <button className="icon-btn btn-xs" onClick={(e) => handleDelete(e, c.id)} title={t('common.delete')}>🗑</button>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <input className="input" placeholder={t('history.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
          <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
          <button className="btn btn-secondary btn-sm" title={t('history.importTitle')} onClick={() => importRef.current?.click()}>📥</button>
        </div>
        {importStatus && (
          <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 4, fontFamily: 'var(--mono)' }}>{importStatus}</div>
        )}

        {/* Tag filter chips */}
        {allTags.length > 0 && (
          <div className="history-tag-filter">
            <button
              className={`filter-chip ${!selectedTag ? 'active' : ''}`}
              onClick={() => setSelectedTag(null)}
            >{t('common.all')}</button>
            {allTags.map((t) => (
              <button
                key={t.name}
                className={`filter-chip ${selectedTag === t.name ? 'active' : ''}`}
                onClick={() => setSelectedTag(selectedTag === t.name ? null : t.name)}
                style={selectedTag === t.name ? { borderColor: t.color, color: t.color } : undefined}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tag input popup */}
      {tagInput && (
        <div className="tag-input-bar">
          <input
            className="input input-sm"
            placeholder={t('history.tagPlaceholder')}
            value={tagInput.value}
            onChange={(e) => setTagInput({ ...tagInput, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddTag(tagInput.convId, tagInput.value)
              if (e.key === 'Escape') setTagInput(null)
            }}
            autoFocus
          />
          <button className="btn btn-ghost btn-xs" onClick={() => setTagInput(null)}>{t('common.cancel')}</button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {index.length === 0 ? (
          <div className="empty-state">
            <span className="e-icon">💬</span>
            <h3>{t('history.emptyTitle')}</h3>
            <p>{t('history.emptyDesc')}</p>
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <>
                <div style={{ padding: '8px 14px 4px', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--mono)' }}>{t('history.pinSection')}</div>
                {pinned.map((c) => <ConvItem key={c.id} c={c} />)}
              </>
            )}
            {recents.length > 0 && (
              <>
                <div style={{ padding: '8px 14px 4px', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--mono)' }}>{t('history.recentSection')}</div>
                {recents.map((c) => <ConvItem key={c.id} c={c} />)}
              </>
            )}
            {filtered.length === 0 && index.length > 0 && (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text3)', fontSize: 12 }}>
                {t('common.noResults')}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
