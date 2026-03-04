// lib/shortcutManager.ts — Extended keyboard shortcut system with focus trap

import type { Shortcut, ShortcutAction } from './shortcuts'
import { matchShortcut, loadShortcuts, saveShortcuts, DEFAULT_SHORTCUTS } from './shortcuts'

// ── Focus Trap ──

export interface FocusTrapConfig {
  containerId: string
  initialFocusSelector?: string
  returnFocusOnDeactivate?: boolean
  escapeDeactivates?: boolean
  allowOutsideClick?: boolean
}

export interface FocusTrap {
  activate(): void
  deactivate(): void
  isActive(): boolean
  updateContainerId(id: string): void
}

const FOCUSABLE_SELECTOR = 'a, button, input, select, textarea, [tabindex]'

export function createFocusTrap(config: FocusTrapConfig): FocusTrap {
  let active = false
  let containerId = config.containerId
  let previouslyFocused: Element | null = null
  let trapHandler: ((e: KeyboardEvent) => void) | null = null

  const getFocusableElements = (): HTMLElement[] => {
    const container = document.getElementById(containerId)
    if (!container) return []
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      .filter((el) => !el.hasAttribute('disabled') && el.tabIndex >= 0)
  }

  const handleTrapKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && config.escapeDeactivates !== false) {
      deactivate()
      return
    }
    if (e.key !== 'Tab') return

    const focusable = getFocusableElements()
    if (focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const activate = (): void => {
    if (active) return
    previouslyFocused = document.activeElement
    active = true
    trapHandler = handleTrapKeydown
    document.addEventListener('keydown', trapHandler)

    const container = document.getElementById(containerId)
    if (config.initialFocusSelector && container) {
      const initial = container.querySelector<HTMLElement>(config.initialFocusSelector)
      if (initial) { initial.focus(); return }
    }
    const focusable = getFocusableElements()
    if (focusable.length > 0) focusable[0].focus()
  }

  const deactivate = (): void => {
    if (!active) return
    active = false
    if (trapHandler) {
      document.removeEventListener('keydown', trapHandler)
      trapHandler = null
    }
    if (config.returnFocusOnDeactivate !== false && previouslyFocused instanceof HTMLElement) {
      previouslyFocused.focus()
    }
    previouslyFocused = null
  }

  return {
    activate,
    deactivate,
    isActive: () => active,
    updateContainerId: (id: string) => { containerId = id },
  }
}

// ── Reserved Combos ──

export const RESERVED_COMBOS: readonly string[] = [
  'Ctrl+W', 'Ctrl+T', 'Ctrl+N', 'Ctrl+Tab', 'Ctrl+Shift+Tab',
  'Ctrl+L', 'Ctrl+R', 'F5', 'F12', 'Alt+F4',
] as const

// ── Shortcut Registry ──

export type ShortcutHandler = (action: ShortcutAction, event: KeyboardEvent) => void

export interface ShortcutManager {
  init(handler: ShortcutHandler): void
  destroy(): void
  getShortcuts(): Shortcut[]
  updateBinding(id: string, newKeys: string): Promise<void>
  resetToDefaults(): Promise<void>
  findConflict(keys: string, excludeId?: string): Shortcut | null
  isReservedCombo(keys: string): boolean
}

export function createShortcutManager(): ShortcutManager {
  let shortcuts: Shortcut[] = []
  let keydownHandler: ((e: KeyboardEvent) => void) | null = null

  return {
    init(handler: ShortcutHandler): void {
      loadShortcuts().then((loaded) => { shortcuts = loaded })
      keydownHandler = (e: KeyboardEvent) => {
        const matched = matchShortcut(e, shortcuts)
        if (matched) handler(matched.action, e)
      }
      document.addEventListener('keydown', keydownHandler)
    },

    destroy(): void {
      if (keydownHandler) {
        document.removeEventListener('keydown', keydownHandler)
        keydownHandler = null
      }
      shortcuts = []
    },

    getShortcuts: () => [...shortcuts],

    async updateBinding(id: string, newKeys: string): Promise<void> {
      if (this.isReservedCombo(newKeys)) {
        throw new Error(`Reserved shortcut: ${newKeys}`)
      }
      const conflict = this.findConflict(newKeys, id)
      if (conflict) {
        throw new Error(`Conflict with: ${conflict.id}`)
      }
      shortcuts = shortcuts.map((s) => (s.id === id ? { ...s, keys: newKeys } : s))
      await saveShortcuts(shortcuts)
    },

    async resetToDefaults(): Promise<void> {
      shortcuts = [...DEFAULT_SHORTCUTS]
      await saveShortcuts(shortcuts)
    },

    findConflict(keys: string, excludeId?: string): Shortcut | null {
      return shortcuts.find((s) => s.keys === keys && s.id !== excludeId) ?? null
    },

    isReservedCombo(keys: string): boolean {
      return RESERVED_COMBOS.includes(keys)
    },
  }
}

// ── Key Recorder ──

export interface KeyRecorder {
  start(onRecord: (keys: string) => void): void
  stop(): void
  isRecording(): boolean
}

export function createKeyRecorder(): KeyRecorder {
  let recording = false
  let handler: ((e: KeyboardEvent) => void) | null = null

  return {
    start(onRecord: (keys: string) => void): void {
      if (recording) return
      recording = true
      handler = (e: KeyboardEvent) => {
        e.preventDefault()
        const key = e.key
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return

        const parts: string[] = []
        if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
        if (e.shiftKey) parts.push('Shift')
        if (e.altKey) parts.push('Alt')
        parts.push(key.length === 1 ? key.toUpperCase() : key)

        this.stop()
        onRecord(parts.join('+'))
      }
      document.addEventListener('keydown', handler)
    },

    stop(): void {
      if (!recording) return
      recording = false
      if (handler) {
        document.removeEventListener('keydown', handler)
        handler = null
      }
    },

    isRecording: () => recording,
  }
}

// ── Utility ──

export function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform ?? '')
}

export function formatShortcutDisplay(keys: string): string {
  if (!isMac()) return keys
  return keys
    .replace(/Ctrl\+/g, '\u2318')
    .replace(/Shift\+/g, '\u21E7')
    .replace(/Alt\+/g, '\u2325')
}
