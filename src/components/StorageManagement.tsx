import { useState, useEffect } from 'react'
import { analyzeStorage, formatBytes, cleanupOrphans, findOldConversations, deleteConversations, type StorageBreakdown } from '../lib/storageManager'
import { useLocale } from '../i18n'

export function StorageManagement() {
  const { t } = useLocale()
  const [breakdown, setBreakdown] = useState<StorageBreakdown | null>(null)
  const [cleanupMsg, setCleanupMsg] = useState('')

  const load = () => analyzeStorage().then(setBreakdown)
  useEffect(() => { load() }, [])

  const handleCleanOrphans = async () => {
    const count = await cleanupOrphans()
    setCleanupMsg(count > 0 ? t('storage.orphansRemoved', { n: count }) : t('storage.noOrphans'))
    load()
    setTimeout(() => setCleanupMsg(''), 3000)
  }

  const handleCleanOld = async () => {
    const old = await findOldConversations(90)
    if (old.length === 0) {
      setCleanupMsg(t('storage.noOldConversations'))
      setTimeout(() => setCleanupMsg(''), 3000)
      return
    }
    const totalSize = old.reduce((a, b) => a + b.sizeBytes, 0)
    if (!confirm(t('storage.cleanOldConfirm', { n: old.length, size: formatBytes(totalSize) }))) return
    await deleteConversations(old.map((c) => c.id))
    setCleanupMsg(t('storage.cleanOldSuccess', { n: old.length }))
    load()
    setTimeout(() => setCleanupMsg(''), 3000)
  }

  if (!breakdown) return <div style={{ padding: 8 }}><span className="spinner-sm" /></div>

  const categories = [
    { key: 'conversations', label: t('storage.conversations'), size: breakdown.conversations, color: '#34d399' },
    { key: 'bookmarks', label: t('storage.bookmarks'), size: breakdown.bookmarks, color: '#60a5fa' },
    { key: 'usage', label: t('storage.usageData'), size: breakdown.usage, color: '#fbbf24' },
    { key: 'config', label: t('storage.config'), size: breakdown.config, color: '#a78bfa' },
    { key: 'other', label: t('storage.other'), size: breakdown.other, color: '#6b7c93' },
  ].filter((c) => c.size > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text0)' }}>{t('storage.totalUsage')}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{formatBytes(breakdown.total)}</span>
      </div>

      {/* Bar visualization */}
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--bg3)' }}>
        {categories.map((c) => (
          <div key={c.key} style={{ width: `${(c.size / breakdown.total) * 100}%`, background: c.color, minWidth: c.size > 0 ? 2 : 0 }} title={`${c.label}: ${formatBytes(c.size)}`} />
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {categories.map((c) => (
          <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: c.color }} />
            <span style={{ color: 'var(--text2)' }}>{c.label}</span>
            <span style={{ color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{formatBytes(c.size)}</span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10, color: 'var(--text3)' }}>
        {t('storage.conversationCount', { n: breakdown.conversationCount })}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-xs" onClick={handleCleanOrphans}>{t('storage.cleanOrphans')}</button>
        <button className="btn btn-ghost btn-xs" onClick={handleCleanOld}>{t('storage.cleanOld')}</button>
      </div>

      {cleanupMsg && <div style={{ fontSize: 11, color: 'var(--accent)', padding: '2px 0' }}>{cleanupMsg}</div>}
    </div>
  )
}
