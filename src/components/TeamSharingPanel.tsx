import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocale } from '../i18n'
import type { SharePackage, ShareItemType, ShareRecord } from '../lib/teamSharing'
import {
  createSharePackage,
  exportPackage,
  importPackage,
  validatePackage,
  applyPackage,
  getShareHistory,
} from '../lib/teamSharing'

interface TeamSharingPanelProps {
  onClose: () => void
}

type TabType = 'export' | 'import' | 'history'

const ITEM_TYPES: ShareItemType[] = ['assistant', 'prompt', 'template', 'chain', 'workflow']

export function TeamSharingPanel({ onClose }: TeamSharingPanelProps) {
  const { t } = useLocale()
  const [activeTab, setActiveTab] = useState<TabType>('export')

  return (
    <div className="team-sharing-panel">
      <div className="team-sharing-header">
        <h3>{t('sharing.title')}</h3>
        <button aria-label={t('common.close')} onClick={onClose}>
          {t('common.close')}
        </button>
      </div>

      <div className="team-sharing-tabs">
        <button
          className={activeTab === 'export' ? 'active' : ''}
          onClick={() => setActiveTab('export')}
        >
          {t('sharing.export')}
        </button>
        <button
          className={activeTab === 'import' ? 'active' : ''}
          onClick={() => setActiveTab('import')}
        >
          {t('sharing.import')}
        </button>
        <button
          className={activeTab === 'history' ? 'active' : ''}
          onClick={() => setActiveTab('history')}
        >
          {t('sharing.history')}
        </button>
      </div>

      {activeTab === 'export' && <ExportTab />}
      {activeTab === 'import' && <ImportTab />}
      {activeTab === 'history' && <HistoryTab />}
    </div>
  )
}

function ExportTab() {
  const { t } = useLocale()
  const [selectedTypes, setSelectedTypes] = useState<Set<ShareItemType>>(new Set())
  const [author, setAuthor] = useState('')
  const [description, setDescription] = useState('')

  const handleToggleType = useCallback((type: ShareItemType) => {
    setSelectedTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }, [])

  const handleDownload = useCallback(() => {
    if (selectedTypes.size === 0) return

    const items = Array.from(selectedTypes).map(type => ({ type, data: {} }))
    const pkg = createSharePackage(items, { author, description })
    const json = exportPackage(pkg)

    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `hchat-share-${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }, [selectedTypes, author, description])

  return (
    <div className="team-sharing-export">
      <div className="team-sharing-section">
        <label>{t('sharing.selectItems')}</label>
        {ITEM_TYPES.map(type => (
          <div key={type} className="team-sharing-checkbox">
            <input
              type="checkbox"
              id={`share-type-${type}`}
              checked={selectedTypes.has(type)}
              onChange={() => handleToggleType(type)}
            />
            <label htmlFor={`share-type-${type}`}>{type}</label>
          </div>
        ))}
      </div>

      <div className="team-sharing-section">
        <input
          type="text"
          placeholder={t('sharing.author')}
          value={author}
          onChange={e => setAuthor(e.target.value)}
        />
        <input
          type="text"
          placeholder={t('sharing.description')}
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>

      <button
        disabled={selectedTypes.size === 0}
        onClick={handleDownload}
      >
        {t('sharing.download')}
      </button>
    </div>
  )
}

function ImportTab() {
  const { t } = useLocale()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importedPkg, setImportedPkg] = useState<SharePackage | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [applyResult, setApplyResult] = useState<string | null>(null)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const json = ev.target?.result as string
        const pkg = importPackage(json)
        const validation = validatePackage(pkg)

        if (!validation.valid) {
          setValidationErrors(validation.errors)
          setImportedPkg(null)
          return
        }

        setValidationErrors([])
        setImportedPkg(pkg)
      } catch (err) {
        setValidationErrors([(err as Error).message])
        setImportedPkg(null)
      }
    }
    reader.readAsText(file)
  }, [])

  const handleApply = useCallback(async () => {
    if (!importedPkg) return

    try {
      const result = await applyPackage(importedPkg)
      setApplyResult(
        `added: ${result.added}, skipped: ${result.skipped}, updated: ${result.updated}`,
      )
    } catch (err) {
      setApplyResult(`${t('common.error')}: ${(err as Error).message}`)
    }
  }, [importedPkg, t])

  return (
    <div className="team-sharing-import">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        data-testid="import-file-input"
        onChange={handleFileChange}
      />

      {validationErrors.length > 0 && (
        <div className="team-sharing-errors">
          {validationErrors.map((err, i) => (
            <div key={i} className="team-sharing-error">{err}</div>
          ))}
        </div>
      )}

      <div className="team-sharing-preview">
        <h4>{t('sharing.preview')}</h4>
        {importedPkg && (
          <div>
            <div>{t('sharing.author')}: {importedPkg.author}</div>
            <div>{t('sharing.description')}: {importedPkg.description}</div>
            <div>{importedPkg.items.length} items</div>
          </div>
        )}
      </div>

      {importedPkg && (
        <button onClick={handleApply}>
          {t('sharing.apply')}
        </button>
      )}

      {applyResult && (
        <div className="team-sharing-result">{applyResult}</div>
      )}
    </div>
  )
}

function HistoryTab() {
  const { t } = useLocale()
  const [history, setHistory] = useState<ShareRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const records = await getShareHistory()
        if (!cancelled) {
          setHistory(records)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return <div>{t('common.loading')}</div>
  }

  if (history.length === 0) {
    return <div className="team-sharing-empty">{t('sharing.history')}</div>
  }

  return (
    <div className="team-sharing-history">
      {history.map(record => (
        <div key={record.id} className="team-sharing-record">
          <span className="record-type">{record.type}</span>
          <span className="record-name">{record.packageName}</span>
          <span className="record-count">{record.itemCount}</span>
          <span className="record-date">
            {new Date(record.timestamp).toLocaleDateString()}
          </span>
        </div>
      ))}
    </div>
  )
}
