import React, { useState, useEffect, useRef } from 'react'
import { searchMessages, escapeRegex, type SearchResult } from '../lib/messageSearch'
import { useLocale } from '../i18n'

function highlightMatchElements(snippet: string, query: string): React.ReactNode[] {
  if (!query.trim()) return [snippet]
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi')
  const parts = snippet.split(regex)
  return parts.map((part, i) =>
    regex.test(part) ? React.createElement('mark', { key: i }, part) : part
  )
}

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (convId: string) => void
}

export function MessageSearchModal({ open, onClose, onSelect }: Props) {
  const { t, locale } = useLocale()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const r = await searchMessages(query, 30)
      setResults(r)
      setSelectedIdx(0)
      setLoading(false)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && results[selectedIdx]) {
      onSelect(results[selectedIdx].convId)
      onClose()
    }
  }

  const rel = (ts: number) => {
    const d = Date.now() - ts
    if (d < 3600000) return t('time.minutesAgo', { n: Math.floor(d / 60000) })
    if (d < 86400000) return t('time.hoursAgo', { n: Math.floor(d / 3600000) })
    return new Date(ts).toLocaleDateString(locale === 'en' ? 'en-US' : 'ko-KR')
  }

  if (!open) return null

  return (
    <div className="search-modal-overlay" onClick={onClose}>
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-modal-input-row">
          <span className="search-modal-icon">🔍</span>
          <input
            ref={inputRef}
            className="search-modal-input"
            placeholder={t('chat.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {loading && <span className="spinner-sm" />}
          <kbd className="search-modal-kbd">ESC</kbd>
        </div>

        <div className="search-modal-results">
          {results.length === 0 && query.trim() && !loading && (
            <div className="search-modal-empty">{t('common.noResults')}</div>
          )}
          {results.map((r, i) => (
            <div
              key={`${r.convId}-${r.message.id}`}
              className={`search-result-item ${i === selectedIdx ? 'selected' : ''}`}
              onClick={() => { onSelect(r.convId); onClose() }}
              onMouseEnter={() => setSelectedIdx(i)}
            >
              <div className="search-result-header">
                <span className="search-result-role">{r.message.role === 'user' ? t('common.me') : 'AI'}</span>
                <span className="search-result-conv">{r.convTitle}</span>
                <span className="search-result-time">{rel(r.message.ts)}</span>
              </div>
              <div className="search-result-snippet">
                {highlightMatchElements(r.matchSnippet, query)}
              </div>
            </div>
          ))}
        </div>

        {results.length > 0 && (
          <div className="search-modal-footer">
            <span>{t('searchModal.navigate')}</span>
            <span>{t('searchModal.select')}</span>
            <span>{t('searchModal.close')}</span>
          </div>
        )}
      </div>
    </div>
  )
}
