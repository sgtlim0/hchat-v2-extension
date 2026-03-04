import { describe, it, expect, beforeEach } from 'vitest'
import {
  parseKeyCombo,
  matchShortcut,
  loadShortcuts,
  saveShortcuts,
  DEFAULT_SHORTCUTS,
  type Shortcut,
} from '../shortcuts'

describe('shortcuts', () => {
  beforeEach(async () => {
    await chrome.storage.local.clear()
  })

  describe('parseKeyCombo', () => {
    it('parses single key', () => {
      const event = new KeyboardEvent('keydown', { key: 'A' })
      expect(parseKeyCombo(event)).toBe('A')
    })

    it('parses Ctrl+key', () => {
      const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })
      expect(parseKeyCombo(event)).toBe('Ctrl+K')
    })

    it('parses Shift+key', () => {
      const event = new KeyboardEvent('keydown', { key: 'p', shiftKey: true })
      expect(parseKeyCombo(event)).toBe('Shift+P')
    })

    it('parses Alt+key', () => {
      const event = new KeyboardEvent('keydown', { key: 't', altKey: true })
      expect(parseKeyCombo(event)).toBe('Alt+T')
    })

    it('parses Ctrl+Shift+key', () => {
      const event = new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, shiftKey: true })
      expect(parseKeyCombo(event)).toBe('Ctrl+Shift+P')
    })

    it('parses Ctrl+Alt+key', () => {
      const event = new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, altKey: true })
      expect(parseKeyCombo(event)).toBe('Ctrl+Alt+D')
    })

    it('parses Ctrl+Shift+Alt+key', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'x',
        ctrlKey: true,
        shiftKey: true,
        altKey: true,
      })
      expect(parseKeyCombo(event)).toBe('Ctrl+Shift+Alt+X')
    })

    it('treats Meta as Ctrl on Mac', () => {
      const event = new KeyboardEvent('keydown', { key: 'n', metaKey: true })
      expect(parseKeyCombo(event)).toBe('Ctrl+N')
    })

    it('uppercases single letter keys', () => {
      const event = new KeyboardEvent('keydown', { key: 'a' })
      expect(parseKeyCombo(event)).toBe('A')
    })

    it('preserves special key names', () => {
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' })
      expect(parseKeyCombo(escapeEvent)).toBe('Escape')

      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' })
      expect(parseKeyCombo(enterEvent)).toBe('Enter')
    })

    it('ignores standalone modifier keys', () => {
      const ctrlEvent = new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true })
      expect(parseKeyCombo(ctrlEvent)).toBe('Ctrl')

      const shiftEvent = new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true })
      expect(parseKeyCombo(shiftEvent)).toBe('Shift')
    })

    it('parses forward slash', () => {
      const event = new KeyboardEvent('keydown', { key: '/' })
      expect(parseKeyCombo(event)).toBe('/')
    })

    it('parses brackets', () => {
      const leftBracket = new KeyboardEvent('keydown', { key: '[', ctrlKey: true })
      expect(parseKeyCombo(leftBracket)).toBe('Ctrl+[')

      const rightBracket = new KeyboardEvent('keydown', { key: ']', ctrlKey: true })
      expect(parseKeyCombo(rightBracket)).toBe('Ctrl+]')
    })
  })

  describe('matchShortcut', () => {
    const testShortcuts: Shortcut[] = [
      {
        id: 'test1',
        keys: 'Ctrl+K',
        action: 'search-history',
        description: 'Search',
        customizable: true,
      },
      {
        id: 'test2',
        keys: 'Escape',
        action: 'stop-generation',
        description: 'Stop',
        customizable: false,
      },
      {
        id: 'test3',
        keys: 'Ctrl+Shift+P',
        action: 'toggle-context',
        description: 'Toggle',
        customizable: true,
      },
    ]

    it('matches keyboard event to shortcut', () => {
      const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })
      const match = matchShortcut(event, testShortcuts)
      expect(match?.id).toBe('test1')
      expect(match?.action).toBe('search-history')
    })

    it('matches single key shortcut', () => {
      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      const match = matchShortcut(event, testShortcuts)
      expect(match?.id).toBe('test2')
      expect(match?.action).toBe('stop-generation')
    })

    it('matches multi-modifier shortcut', () => {
      const event = new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, shiftKey: true })
      const match = matchShortcut(event, testShortcuts)
      expect(match?.id).toBe('test3')
      expect(match?.action).toBe('toggle-context')
    })

    it('returns undefined for no match', () => {
      const event = new KeyboardEvent('keydown', { key: 'x', ctrlKey: true })
      const match = matchShortcut(event, testShortcuts)
      expect(match).toBeUndefined()
    })

    it('returns undefined for empty shortcut list', () => {
      const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })
      const match = matchShortcut(event, [])
      expect(match).toBeUndefined()
    })
  })

  describe('DEFAULT_SHORTCUTS', () => {
    it('contains 7 default shortcuts', () => {
      expect(DEFAULT_SHORTCUTS).toHaveLength(7)
    })

    it('all shortcuts have required properties', () => {
      DEFAULT_SHORTCUTS.forEach((s) => {
        expect(s).toHaveProperty('id')
        expect(s).toHaveProperty('keys')
        expect(s).toHaveProperty('action')
        expect(s).toHaveProperty('description')
        expect(s).toHaveProperty('customizable')
      })
    })

    it('includes new-chat shortcut', () => {
      const newChat = DEFAULT_SHORTCUTS.find((s) => s.action === 'new-chat')
      expect(newChat).toBeDefined()
      expect(newChat?.keys).toBe('Ctrl+N')
      expect(newChat?.customizable).toBe(true)
    })

    it('includes focus-input shortcut', () => {
      const focusInput = DEFAULT_SHORTCUTS.find((s) => s.action === 'focus-input')
      expect(focusInput).toBeDefined()
      expect(focusInput?.keys).toBe('/')
      expect(focusInput?.customizable).toBe(false)
    })

    it('includes stop-generation shortcut', () => {
      const stopGen = DEFAULT_SHORTCUTS.find((s) => s.action === 'stop-generation')
      expect(stopGen).toBeDefined()
      expect(stopGen?.keys).toBe('Escape')
      expect(stopGen?.customizable).toBe(false)
    })

    it('includes search-history shortcut', () => {
      const search = DEFAULT_SHORTCUTS.find((s) => s.action === 'search-history')
      expect(search).toBeDefined()
      expect(search?.keys).toBe('Ctrl+K')
      expect(search?.customizable).toBe(true)
    })

    it('includes toggle-context shortcut', () => {
      const toggle = DEFAULT_SHORTCUTS.find((s) => s.action === 'toggle-context')
      expect(toggle).toBeDefined()
      expect(toggle?.keys).toBe('Ctrl+Shift+P')
      expect(toggle?.customizable).toBe(true)
    })

    it('includes next-tab shortcut', () => {
      const nextTab = DEFAULT_SHORTCUTS.find((s) => s.action === 'next-tab')
      expect(nextTab).toBeDefined()
      expect(nextTab?.keys).toBe('Ctrl+]')
      expect(nextTab?.customizable).toBe(false)
    })

    it('includes prev-tab shortcut', () => {
      const prevTab = DEFAULT_SHORTCUTS.find((s) => s.action === 'prev-tab')
      expect(prevTab).toBeDefined()
      expect(prevTab?.keys).toBe('Ctrl+[')
      expect(prevTab?.customizable).toBe(false)
    })
  })

  describe('loadShortcuts', () => {
    it('returns default shortcuts when no custom shortcuts exist', async () => {
      const shortcuts = await loadShortcuts()
      expect(shortcuts).toEqual(DEFAULT_SHORTCUTS)
    })

    it('merges custom shortcuts with defaults by ID', async () => {
      const custom: Shortcut[] = [
        {
          id: 'new-chat',
          keys: 'Ctrl+T',
          action: 'new-chat',
          description: 'shortcuts.newChat',
          customizable: true,
        },
      ]

      await saveShortcuts(custom)
      const loaded = await loadShortcuts()

      const newChat = loaded.find((s) => s.id === 'new-chat')
      expect(newChat?.keys).toBe('Ctrl+T') // Custom override
      expect(loaded).toHaveLength(7) // Still 7 shortcuts
    })

    it('preserves default properties except keys', async () => {
      const custom: Shortcut[] = [
        {
          id: 'search-history',
          keys: 'Ctrl+H',
          action: 'search-history',
          description: 'shortcuts.searchHistory',
          customizable: true,
        },
      ]

      await saveShortcuts(custom)
      const loaded = await loadShortcuts()

      const search = loaded.find((s) => s.id === 'search-history')
      expect(search?.keys).toBe('Ctrl+H')
      expect(search?.action).toBe('search-history')
      expect(search?.customizable).toBe(true)
    })

    it('does not add shortcuts not in defaults', async () => {
      const custom: Shortcut[] = [
        {
          id: 'fake-shortcut',
          keys: 'Ctrl+F',
          action: 'search-history',
          description: 'Fake',
          customizable: true,
        },
      ]

      await saveShortcuts(custom)
      const loaded = await loadShortcuts()

      expect(loaded.find((s) => s.id === 'fake-shortcut')).toBeUndefined()
      expect(loaded).toHaveLength(7)
    })
  })

  describe('saveShortcuts', () => {
    it('persists shortcuts in storage', async () => {
      const custom: Shortcut[] = [
        {
          id: 'new-chat',
          keys: 'Ctrl+Alt+N',
          action: 'new-chat',
          description: 'shortcuts.newChat',
          customizable: true,
        },
      ]

      await saveShortcuts(custom)
      const loaded = await loadShortcuts()

      const newChat = loaded.find((s) => s.id === 'new-chat')
      expect(newChat?.keys).toBe('Ctrl+Alt+N')
    })

    it('overwrites previous saved shortcuts', async () => {
      await saveShortcuts([
        {
          id: 'new-chat',
          keys: 'Ctrl+T',
          action: 'new-chat',
          description: 'shortcuts.newChat',
          customizable: true,
        },
      ])

      await saveShortcuts([
        {
          id: 'new-chat',
          keys: 'Ctrl+M',
          action: 'new-chat',
          description: 'shortcuts.newChat',
          customizable: true,
        },
      ])

      const loaded = await loadShortcuts()
      const newChat = loaded.find((s) => s.id === 'new-chat')
      expect(newChat?.keys).toBe('Ctrl+M')
    })

    it('can save multiple custom shortcuts', async () => {
      const custom: Shortcut[] = [
        {
          id: 'new-chat',
          keys: 'Ctrl+T',
          action: 'new-chat',
          description: 'shortcuts.newChat',
          customizable: true,
        },
        {
          id: 'search-history',
          keys: 'Ctrl+H',
          action: 'search-history',
          description: 'shortcuts.searchHistory',
          customizable: true,
        },
      ]

      await saveShortcuts(custom)
      const loaded = await loadShortcuts()

      expect(loaded.find((s) => s.id === 'new-chat')?.keys).toBe('Ctrl+T')
      expect(loaded.find((s) => s.id === 'search-history')?.keys).toBe('Ctrl+H')
    })
  })
})
