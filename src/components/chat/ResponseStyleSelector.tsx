import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocale } from '../../i18n'
import {
  BUILTIN_STYLES,
  getStyles,
  trackStyleUsage,
  getRecommendedStyle,
} from '../../lib/responseTemplate'
import type { ResponseStyle } from '../../lib/responseTemplate'

interface Props {
  onSelectStyle: (style: ResponseStyle | null) => void
  currentStyleId?: string
}

const STYLE_LABEL_KEYS: Record<string, string> = {
  concise: 'style.concise',
  detailed: 'style.detailed',
  technical: 'style.technical',
  casual: 'style.casual',
}

export function ResponseStyleSelector({ onSelectStyle, currentStyleId }: Props) {
  const { t } = useLocale()
  const [isOpen, setIsOpen] = useState(false)
  const [customStyles, setCustomStyles] = useState<ResponseStyle[]>([])
  const [recommendedId, setRecommendedId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [styles, recommended] = await Promise.all([
          getStyles(),
          getRecommendedStyle(),
        ])
        if (cancelled) return
        const custom = styles.filter((s) => !s.builtin)
        setCustomStyles(custom)
        setRecommendedId(recommended?.id ?? null)
      } catch {
        // silent fail
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setIsOpen(false)
    }
  }, [])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleOutsideClick, handleKeyDown])

  function handleSelect(style: ResponseStyle | null) {
    onSelectStyle(style)
    if (style) {
      trackStyleUsage(style.id)
    }
    setIsOpen(false)
  }

  function getTriggerLabel(): string {
    if (!currentStyleId) return t('style.default')
    const key = STYLE_LABEL_KEYS[currentStyleId]
    if (key) return t(key)
    const custom = customStyles.find((s) => s.id === currentStyleId)
    return custom?.name ?? t('style.default')
  }

  return (
    <div className="response-style-selector" ref={containerRef}>
      <button
        className="response-style-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        {getTriggerLabel()}
      </button>

      {isOpen && (
        <div className="response-style-dropdown" role="listbox">
          <div
            className={`response-style-option${!currentStyleId ? ' active' : ''}`}
            role="option"
            aria-selected={!currentStyleId}
            onClick={() => handleSelect(null)}
          >
            {t('style.default')}
          </div>

          <div className="response-style-divider" />

          {BUILTIN_STYLES.map((style) => (
            <div
              key={style.id}
              className={`response-style-option${currentStyleId === style.id ? ' active' : ''}`}
              role="option"
              aria-selected={currentStyleId === style.id}
              onClick={() => handleSelect(style)}
            >
              <span className="response-style-name">
                {t(STYLE_LABEL_KEYS[style.id] ?? style.name)}
              </span>
              <span className="response-style-badge builtin">{t('style.builtin')}</span>
              {recommendedId === style.id && (
                <span className="response-style-badge recommended">{t('style.recommended')}</span>
              )}
            </div>
          ))}

          {customStyles.length > 0 && (
            <>
              <div className="response-style-divider" />
              {customStyles.map((style) => (
                <div
                  key={style.id}
                  className={`response-style-option${currentStyleId === style.id ? ' active' : ''}`}
                  role="option"
                  aria-selected={currentStyleId === style.id}
                  onClick={() => handleSelect(style)}
                >
                  <span className="response-style-name">{style.name}</span>
                  {recommendedId === style.id && (
                    <span className="response-style-badge recommended">{t('style.recommended')}</span>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
