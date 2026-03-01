// lib/shortcuts.ts — Keyboard shortcut system

export type ShortcutAction =
  | 'new-chat'
  | 'focus-input'
  | 'stop-generation'
  | 'search-history'
  | 'toggle-context'
  | 'toggle-dark-mode'
  | 'next-tab'
  | 'prev-tab'

export interface Shortcut {
  id: string
  keys: string
  action: ShortcutAction
  description: string
  customizable: boolean
}

export const DEFAULT_SHORTCUTS: Shortcut[] = [
  { id: 'new-chat',       keys: 'Ctrl+N',         action: 'new-chat',        description: '새 대화',             customizable: true },
  { id: 'focus-input',    keys: '/',               action: 'focus-input',     description: '입력창 포커스',       customizable: false },
  { id: 'stop-gen',       keys: 'Escape',          action: 'stop-generation', description: '응답 생성 중지',      customizable: false },
  { id: 'search-history', keys: 'Ctrl+K',          action: 'search-history',  description: '대화 기록 검색',      customizable: true },
  { id: 'toggle-context', keys: 'Ctrl+Shift+P',    action: 'toggle-context',  description: '페이지 컨텍스트 토글', customizable: true },
  { id: 'next-tab',       keys: 'Ctrl+]',          action: 'next-tab',        description: '다음 탭',             customizable: false },
  { id: 'prev-tab',       keys: 'Ctrl+[',          action: 'prev-tab',        description: '이전 탭',             customizable: false },
]

const STORAGE_KEY = 'hchat:shortcuts'

export function parseKeyCombo(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')

  const key = e.key
  if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
    parts.push(key.length === 1 ? key.toUpperCase() : key)
  }
  return parts.join('+')
}

export function matchShortcut(e: KeyboardEvent, shortcuts: Shortcut[]): Shortcut | undefined {
  const combo = parseKeyCombo(e)
  return shortcuts.find((s) => s.keys === combo)
}

export async function loadShortcuts(): Promise<Shortcut[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  const custom = result[STORAGE_KEY] as Shortcut[] | undefined
  if (!custom) return DEFAULT_SHORTCUTS

  // Merge: custom overrides defaults by id
  return DEFAULT_SHORTCUTS.map((def) => {
    const override = custom.find((c) => c.id === def.id)
    return override ? { ...def, keys: override.keys } : def
  })
}

export async function saveShortcuts(shortcuts: Shortcut[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: shortcuts })
}
