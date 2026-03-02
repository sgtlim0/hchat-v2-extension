import { useEffect } from 'react'
import { useLocale } from '../../i18n'
import type { ThinkingDepth } from '../../lib/providers/types'

const THINKING_CAPABLE_PATTERNS = [
  'claude-sonnet',
  'claude-opus',
]

function supportsThinking(model: string): boolean {
  return THINKING_CAPABLE_PATTERNS.some((p) => model.includes(p))
}

interface ThinkingDepthSelectorProps {
  depth: ThinkingDepth
  onChange: (depth: ThinkingDepth) => void
  model: string
}

const DEPTHS: { value: ThinkingDepth; icon: string; labelKey: string }[] = [
  { value: 'fast', icon: '⚡', labelKey: 'fast' },
  { value: 'normal', icon: '🧠', labelKey: 'normal' },
  { value: 'deep', icon: '🔬', labelKey: 'deep' },
]

export function ThinkingDepthSelector({ depth, onChange, model }: ThinkingDepthSelectorProps) {
  const { t } = useLocale()
  const canThink = supportsThinking(model)

  // Fallback to normal if model doesn't support thinking and depth is deep
  useEffect(() => {
    if (!canThink && depth === 'deep') {
      onChange('normal')
    }
  }, [canThink, depth, onChange])

  return (
    <div className="thinking-depth-selector" title={t('thinkingDepth.title')}>
      {DEPTHS.map(({ value, icon, labelKey }) => {
        const disabled = value === 'deep' && !canThink
        return (
          <button
            key={value}
            className={`thinking-depth-btn${depth === value ? ' active' : ''}${disabled ? ' disabled' : ''}`}
            onClick={() => !disabled && onChange(value)}
            disabled={disabled}
            title={disabled ? t('thinkingDepth.notSupported') : t(`thinkingDepth.${labelKey}Desc`)}
          >
            <span className="td-icon">{icon}</span>
            <span className="td-label">{t(`thinkingDepth.${labelKey}`)}</span>
          </button>
        )
      })}
    </div>
  )
}
