// hooks/useShortcuts.ts — Keyboard shortcut hook for sidepanel
import { useState, useEffect, useCallback } from 'react'
import { DEFAULT_SHORTCUTS, matchShortcut, loadShortcuts, type Shortcut, type ShortcutAction } from '../lib/shortcuts'

export function useShortcuts(actions: Partial<Record<ShortcutAction, () => void>>) {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(DEFAULT_SHORTCUTS)

  useEffect(() => {
    loadShortcuts().then(setShortcuts)
  }, [])

  const handler = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

    const matched = matchShortcut(e, shortcuts)
    if (!matched) return

    // Single-char shortcuts (like /) should not fire when typing in input
    if (isInput && !matched.keys.includes('+')) return

    // Escape always works
    if (matched.action !== 'stop-generation' && isInput && matched.keys === 'Escape') return

    const action = actions[matched.action]
    if (action) {
      e.preventDefault()
      e.stopPropagation()
      action()
    }
  }, [shortcuts, actions])

  useEffect(() => {
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [handler])

  return shortcuts
}
