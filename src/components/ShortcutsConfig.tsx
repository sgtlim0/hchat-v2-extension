import { useState, useRef, useCallback } from 'react'
import type { Shortcut } from '../lib/shortcuts'
import { DEFAULT_SHORTCUTS } from '../lib/shortcuts'
import {
  createKeyRecorder,
  RESERVED_COMBOS,
  formatShortcutDisplay,
} from '../lib/shortcutManager'
import { useLocale } from '../i18n'

interface ShortcutsConfigProps {
  shortcuts: Shortcut[]
  onChange: (shortcuts: Shortcut[]) => void
  conflictWarning?: string
}

export function ShortcutsConfig({ shortcuts, onChange, conflictWarning }: ShortcutsConfigProps) {
  const { t } = useLocale()
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [localWarning, setLocalWarning] = useState<string | null>(null)
  const recorderRef = useRef(createKeyRecorder())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const displayWarning = conflictWarning ?? localWarning

  const handleRecord = useCallback((shortcutId: string) => {
    setRecordingId(shortcutId)
    setLocalWarning(null)

    recorderRef.current.start((keys: string) => {
      setRecordingId(null)

      if (RESERVED_COMBOS.includes(keys)) {
        setLocalWarning(t('shortcuts.reserved'))
        return
      }

      const conflict = shortcuts.find((s) => s.keys === keys && s.id !== shortcutId)
      if (conflict) {
        setLocalWarning(t('shortcuts.conflict'))
        return
      }

      const updated = shortcuts.map((s) =>
        s.id === shortcutId ? { ...s, keys } : s
      )
      onChange(updated)
    })
  }, [shortcuts, onChange, t])

  const handleReset = useCallback(() => {
    setLocalWarning(null)
    onChange(DEFAULT_SHORTCUTS)
  }, [onChange])

  const handleExport = useCallback(() => {
    const json = JSON.stringify(shortcuts, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'hchat-shortcuts.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [shortcuts])

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as Shortcut[]
        if (!Array.isArray(parsed)) return

        // Merge imported with defaults by id
        const merged = DEFAULT_SHORTCUTS.map((def) => {
          const imported = parsed.find((p) => p.id === def.id)
          return imported ? { ...def, keys: imported.keys } : def
        })
        onChange(merged)
      } catch {
        // Ignore invalid JSON
      }
    }
    reader.readAsText(file)

    // Reset input so same file can be re-imported
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [onChange])

  return (
    <div className="shortcuts-config">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {shortcuts.map((s) => (
          <div key={s.id} className="shortcut-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
            <span className="shortcut-desc" style={{ flex: 1, fontSize: 12 }}>
              {t(s.description)}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {recordingId === s.id ? (
                <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                  {t('shortcuts.recordPrompt')}
                </span>
              ) : (
                <kbd style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'var(--bg3, var(--bg2))', border: '1px solid var(--border)' }}>
                  {formatShortcutDisplay(s.keys)}
                </kbd>
              )}
              {s.customizable && recordingId !== s.id && (
                <button
                  className="btn btn-ghost btn-xs"
                  style={{ fontSize: 10 }}
                  onClick={() => handleRecord(s.id)}
                >
                  {t('shortcuts.record')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {displayWarning && (
        <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: 'var(--red-bg, rgba(239,68,68,0.1))', color: 'var(--red, #ef4444)', fontSize: 11, fontWeight: 500 }}>
          {displayWarning}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-xs" onClick={handleReset}>
          {t('shortcuts.reset')}
        </button>
        <button className="btn btn-secondary btn-xs" onClick={handleExport}>
          {t('shortcuts.export')}
        </button>
        <label className="btn btn-secondary btn-xs" style={{ cursor: 'pointer' }}>
          {t('shortcuts.import')}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
        </label>
      </div>

      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>
        {t('shortcuts.platformNote')}
      </div>
    </div>
  )
}
