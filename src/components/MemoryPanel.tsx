import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocale } from '../i18n'
import type { Memory } from '../lib/aiMemory'
import {
  getMemories,
  addMemory,
  updateMemory,
  deleteMemory,
  searchMemories,
  exportMemories,
  importMemories,
} from '../lib/aiMemory'

interface MemoryPanelProps {
  onClose: () => void
}

const CATEGORIES: ReadonlyArray<Memory['category']> = [
  'name',
  'preference',
  'project',
  'fact',
  'custom',
]

export function MemoryPanel({ onClose }: MemoryPanelProps) {
  const { t } = useLocale()
  const [memories, setMemories] = useState<Memory[]>([])
  const [filter, setFilter] = useState<Memory['category'] | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [addContent, setAddContent] = useState('')
  const [addCategory, setAddCategory] = useState<Memory['category']>('custom')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadMemories = useCallback(async () => {
    const data = await getMemories()
    setMemories(data)
  }, [])

  useEffect(() => {
    loadMemories()
  }, [loadMemories])

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (query.trim()) {
      const results = await searchMemories(query)
      setMemories(results)
    } else {
      await loadMemories()
    }
  }, [loadMemories])

  const handleApprove = useCallback(async (id: string) => {
    await updateMemory(id, { approved: true })
    await loadMemories()
  }, [loadMemories])

  const handleDelete = useCallback(async (id: string) => {
    await deleteMemory(id)
    await loadMemories()
  }, [loadMemories])

  const handleAdd = useCallback(async () => {
    if (!addContent.trim()) return
    await addMemory({
      content: addContent.trim(),
      category: addCategory,
      approved: true,
    })
    setAddContent('')
    setShowAddForm(false)
    await loadMemories()
  }, [addContent, addCategory, loadMemories])

  const handleExport = useCallback(async () => {
    const json = await exportMemories()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'hchat-memories.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async () => {
      try {
        await importMemories(reader.result as string)
        await loadMemories()
      } catch {
        // Ignore invalid JSON
      }
    }
    reader.readAsText(file)

    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [loadMemories])

  const filtered = filter === 'all'
    ? memories
    : memories.filter((m) => m.category === filter)

  return (
    <div className="memory-panel" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{t('memory.title')}</h3>
        <button className="btn btn-ghost btn-xs" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder={t('memory.search')}
        value={searchQuery}
        onChange={(e) => handleSearch(e.target.value)}
        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg2)', fontSize: 12 }}
      />

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <button
          className={`btn btn-xs ${filter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setFilter('all')}
        >
          {t('common.all')}
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`btn btn-xs ${filter === cat ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Memory list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
        {filtered.map((m) => (
          <div
            key={m.id}
            className="memory-card"
            style={{
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--bg2)',
              fontSize: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                className="memory-category-badge"
                style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--accent-bg, rgba(59,130,246,0.1))', color: 'var(--accent)' }}
              >
                {m.category}
              </span>
              <span style={{ fontSize: 10, color: m.approved ? 'var(--green, #22c55e)' : 'var(--yellow, #eab308)' }}>
                {m.approved ? t('memory.approved') : t('memory.pending')}
              </span>
            </div>
            <div>{m.content}</div>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
              {!m.approved && (
                <button className="btn btn-ghost btn-xs" onClick={() => handleApprove(m.id)}>
                  {t('memory.approve')}
                </button>
              )}
              <button className="btn btn-ghost btn-xs" style={{ color: 'var(--red, #ef4444)' }} onClick={() => handleDelete(m.id)}>
                {t('memory.delete')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showAddForm ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg2)' }}>
          <input
            type="text"
            placeholder={t('memory.addPlaceholder')}
            value={addContent}
            onChange={(e) => setAddContent(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}
          />
          <select
            value={addCategory}
            onChange={(e) => setAddCategory(e.target.value as Memory['category'])}
            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <button className="btn btn-primary btn-xs" onClick={handleAdd}>
            {t('memory.addSubmit')}
          </button>
        </div>
      ) : (
        <button className="btn btn-secondary btn-xs" onClick={() => setShowAddForm(true)}>
          {t('memory.add')}
        </button>
      )}

      {/* Export / Import */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-secondary btn-xs" onClick={handleExport}>
          {t('memory.export')}
        </button>
        <label className="btn btn-secondary btn-xs" style={{ cursor: 'pointer' }}>
          {t('memory.import')}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
        </label>
      </div>
    </div>
  )
}
