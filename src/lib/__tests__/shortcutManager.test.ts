import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createFocusTrap,
  createShortcutManager,
  createKeyRecorder,
  formatShortcutDisplay,
  isMac,
  RESERVED_COMBOS,
} from '../shortcutManager'
import { DEFAULT_SHORTCUTS } from '../shortcuts'

describe('shortcutManager', () => {
  beforeEach(async () => {
    await chrome.storage.local.clear()
    document.body.innerHTML = ''
  })

  // ── createFocusTrap ──

  describe('createFocusTrap', () => {
    it('activates and tracks active state', () => {
      document.body.innerHTML = '<div id="trap"><button>A</button></div>'
      const trap = createFocusTrap({ containerId: 'trap' })

      expect(trap.isActive()).toBe(false)
      trap.activate()
      expect(trap.isActive()).toBe(true)
    })

    it('deactivates and resets state', () => {
      document.body.innerHTML = '<div id="trap"><button>A</button></div>'
      const trap = createFocusTrap({ containerId: 'trap', returnFocusOnDeactivate: false })

      trap.activate()
      expect(trap.isActive()).toBe(true)
      trap.deactivate()
      expect(trap.isActive()).toBe(false)
    })

    it('does not double-activate', () => {
      document.body.innerHTML = '<div id="trap"><button>A</button></div>'
      const trap = createFocusTrap({ containerId: 'trap' })
      const addSpy = vi.spyOn(document, 'addEventListener')

      trap.activate()
      const callCount = addSpy.mock.calls.length
      trap.activate()
      expect(addSpy.mock.calls.length).toBe(callCount)

      trap.deactivate()
      addSpy.mockRestore()
    })

    it('cycles focus forward on Tab at last element', () => {
      document.body.innerHTML = `
        <div id="trap">
          <button id="first">First</button>
          <button id="last">Last</button>
        </div>
      `
      const trap = createFocusTrap({ containerId: 'trap' })
      trap.activate()

      const last = document.getElementById('last')!
      last.focus()

      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
      const preventSpy = vi.spyOn(event, 'preventDefault')
      document.dispatchEvent(event)

      expect(preventSpy).toHaveBeenCalled()
      trap.deactivate()
    })

    it('cycles focus backward on Shift+Tab at first element', () => {
      document.body.innerHTML = `
        <div id="trap">
          <button id="first">First</button>
          <button id="last">Last</button>
        </div>
      `
      const trap = createFocusTrap({ containerId: 'trap' })
      trap.activate()

      const first = document.getElementById('first')!
      first.focus()

      const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })
      const preventSpy = vi.spyOn(event, 'preventDefault')
      document.dispatchEvent(event)

      expect(preventSpy).toHaveBeenCalled()
      trap.deactivate()
    })

    it('deactivates on Escape when escapeDeactivates is true', () => {
      document.body.innerHTML = '<div id="trap"><button>A</button></div>'
      const trap = createFocusTrap({ containerId: 'trap', escapeDeactivates: true })
      trap.activate()
      expect(trap.isActive()).toBe(true)

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      expect(trap.isActive()).toBe(false)
    })

    it('updates container id', () => {
      document.body.innerHTML = `
        <div id="trap1"><button>A</button></div>
        <div id="trap2"><input /></div>
      `
      const trap = createFocusTrap({ containerId: 'trap1' })
      trap.updateContainerId('trap2')
      trap.activate()
      expect(trap.isActive()).toBe(true)
      trap.deactivate()
    })
  })

  // ── createShortcutManager ──

  describe('createShortcutManager', () => {
    it('initializes and adds keydown listener', () => {
      const addSpy = vi.spyOn(document, 'addEventListener')
      const manager = createShortcutManager()
      const handler = vi.fn()

      manager.init(handler)
      expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function))

      manager.destroy()
      addSpy.mockRestore()
    })

    it('destroys and removes keydown listener', () => {
      const removeSpy = vi.spyOn(document, 'removeEventListener')
      const manager = createShortcutManager()
      manager.init(vi.fn())
      manager.destroy()

      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
      removeSpy.mockRestore()
    })

    it('returns empty shortcuts after destroy', () => {
      const manager = createShortcutManager()
      manager.init(vi.fn())
      manager.destroy()
      expect(manager.getShortcuts()).toEqual([])
    })
  })

  // ── updateBinding ──

  describe('updateBinding', () => {
    it('updates a binding successfully', async () => {
      const manager = createShortcutManager()
      manager.init(vi.fn())

      // Wait for async loadShortcuts
      await new Promise((r) => setTimeout(r, 10))

      await manager.updateBinding('search-history', 'Ctrl+H')
      const updated = manager.getShortcuts().find((s) => s.id === 'search-history')
      expect(updated?.keys).toBe('Ctrl+H')

      manager.destroy()
    })

    it('rejects reserved combos', async () => {
      const manager = createShortcutManager()
      manager.init(vi.fn())
      await new Promise((r) => setTimeout(r, 10))

      await expect(manager.updateBinding('search-history', 'Ctrl+W'))
        .rejects.toThrow('Reserved shortcut')

      manager.destroy()
    })

    it('rejects conflicting combos', async () => {
      const manager = createShortcutManager()
      manager.init(vi.fn())
      await new Promise((r) => setTimeout(r, 10))

      // Ctrl+Shift+P is already toggle-context
      await expect(manager.updateBinding('search-history', 'Ctrl+Shift+P'))
        .rejects.toThrow('Conflict with')

      manager.destroy()
    })
  })

  // ── findConflict ──

  describe('findConflict', () => {
    it('finds a conflict', async () => {
      const manager = createShortcutManager()
      manager.init(vi.fn())
      await new Promise((r) => setTimeout(r, 10))

      const conflict = manager.findConflict('Ctrl+K')
      expect(conflict).not.toBeNull()
      expect(conflict?.id).toBe('search-history')

      manager.destroy()
    })

    it('returns null when no conflict', async () => {
      const manager = createShortcutManager()
      manager.init(vi.fn())
      await new Promise((r) => setTimeout(r, 10))

      const conflict = manager.findConflict('Ctrl+Alt+Z')
      expect(conflict).toBeNull()

      manager.destroy()
    })

    it('excludes self from conflict check', async () => {
      const manager = createShortcutManager()
      manager.init(vi.fn())
      await new Promise((r) => setTimeout(r, 10))

      const conflict = manager.findConflict('Ctrl+K', 'search-history')
      expect(conflict).toBeNull()

      manager.destroy()
    })
  })

  // ── isReservedCombo ──

  describe('isReservedCombo', () => {
    it('returns true for reserved combos', () => {
      const manager = createShortcutManager()
      expect(manager.isReservedCombo('Ctrl+W')).toBe(true)
      expect(manager.isReservedCombo('F5')).toBe(true)
      expect(manager.isReservedCombo('Ctrl+Tab')).toBe(true)
    })

    it('returns false for non-reserved combos', () => {
      const manager = createShortcutManager()
      expect(manager.isReservedCombo('Ctrl+K')).toBe(false)
      expect(manager.isReservedCombo('Ctrl+Shift+P')).toBe(false)
    })
  })

  // ── createKeyRecorder ──

  describe('createKeyRecorder', () => {
    it('tracks recording state via start/stop', () => {
      const recorder = createKeyRecorder()
      expect(recorder.isRecording()).toBe(false)

      recorder.start(vi.fn())
      expect(recorder.isRecording()).toBe(true)

      recorder.stop()
      expect(recorder.isRecording()).toBe(false)
    })

    it('captures key combo and auto-stops', () => {
      const recorder = createKeyRecorder()
      const onRecord = vi.fn()

      recorder.start(onRecord)
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
      )

      expect(onRecord).toHaveBeenCalledWith('Ctrl+K')
      expect(recorder.isRecording()).toBe(false)
    })

    it('ignores modifier-only presses', () => {
      const recorder = createKeyRecorder()
      const onRecord = vi.fn()

      recorder.start(onRecord)
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true, bubbles: true })
      )

      expect(onRecord).not.toHaveBeenCalled()
      expect(recorder.isRecording()).toBe(true)

      recorder.stop()
    })
  })

  // ── formatShortcutDisplay ──

  describe('formatShortcutDisplay', () => {
    it('formats with Mac symbols when on Mac', () => {
      const originalPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform')
      Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true })

      expect(formatShortcutDisplay('Ctrl+Shift+P')).toBe('\u2318\u21E7P')
      expect(formatShortcutDisplay('Ctrl+K')).toBe('\u2318K')
      expect(formatShortcutDisplay('Alt+F4')).toBe('\u2325F4')

      if (originalPlatform) {
        Object.defineProperty(navigator, 'platform', originalPlatform)
      } else {
        Object.defineProperty(navigator, 'platform', { value: '', configurable: true })
      }
    })

    it('keeps original format on non-Mac', () => {
      const originalPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform')
      Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true })

      expect(formatShortcutDisplay('Ctrl+Shift+P')).toBe('Ctrl+Shift+P')
      expect(formatShortcutDisplay('Ctrl+K')).toBe('Ctrl+K')

      if (originalPlatform) {
        Object.defineProperty(navigator, 'platform', originalPlatform)
      } else {
        Object.defineProperty(navigator, 'platform', { value: '', configurable: true })
      }
    })
  })

  // ── RESERVED_COMBOS ──

  describe('RESERVED_COMBOS', () => {
    it('contains expected browser shortcuts', () => {
      expect(RESERVED_COMBOS).toContain('Ctrl+W')
      expect(RESERVED_COMBOS).toContain('Ctrl+T')
      expect(RESERVED_COMBOS).toContain('F5')
      expect(RESERVED_COMBOS).toContain('F12')
    })
  })

  // ── resetToDefaults ──

  describe('resetToDefaults', () => {
    it('resets shortcuts to defaults', async () => {
      const manager = createShortcutManager()
      manager.init(vi.fn())
      await new Promise((r) => setTimeout(r, 10))

      await manager.updateBinding('search-history', 'Ctrl+H')
      await manager.resetToDefaults()

      const search = manager.getShortcuts().find((s) => s.id === 'search-history')
      expect(search?.keys).toBe('Ctrl+K')

      manager.destroy()
    })
  })
})
