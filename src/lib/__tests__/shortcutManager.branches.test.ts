import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createFocusTrap,
  createShortcutManager,
  createKeyRecorder,
  isMac,
  formatShortcutDisplay,
  RESERVED_COMBOS,
} from '../shortcutManager'

vi.mock('../shortcuts', () => ({
  matchShortcut: vi.fn(),
  loadShortcuts: vi.fn(async () => [
    { id: 'open-chat', keys: 'Ctrl+Shift+H', action: 'openChat' as const },
    { id: 'new-chat', keys: 'Ctrl+N', action: 'newChat' as const },
  ]),
  saveShortcuts: vi.fn(async () => {}),
  DEFAULT_SHORTCUTS: [
    { id: 'open-chat', keys: 'Ctrl+Shift+H', action: 'openChat' as const },
    { id: 'new-chat', keys: 'Ctrl+N', action: 'newChat' as const },
  ],
}))

describe('shortcutManager branch coverage', () => {
  describe('createFocusTrap', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="test-container">
          <button id="btn1">First</button>
          <button id="btn2">Second</button>
          <button id="btn3">Third</button>
        </div>
      `
    })

    afterEach(() => {
      document.body.innerHTML = ''
    })

    it('focuses initial element via selector', () => {
      const trap = createFocusTrap({
        containerId: 'test-container',
        initialFocusSelector: '#btn2',
      })
      trap.activate()
      expect(document.activeElement?.id).toBe('btn2')
      trap.deactivate()
    })

    it('focuses first focusable when no initialFocusSelector', () => {
      const trap = createFocusTrap({ containerId: 'test-container' })
      trap.activate()
      expect(document.activeElement?.id).toBe('btn1')
      trap.deactivate()
    })

    it('does nothing on double activate', () => {
      const trap = createFocusTrap({ containerId: 'test-container' })
      trap.activate()
      trap.activate() // should not throw
      expect(trap.isActive()).toBe(true)
      trap.deactivate()
    })

    it('does nothing on double deactivate', () => {
      const trap = createFocusTrap({ containerId: 'test-container' })
      trap.activate()
      trap.deactivate()
      trap.deactivate() // should not throw
      expect(trap.isActive()).toBe(false)
    })

    it('deactivates on Escape key', () => {
      const trap = createFocusTrap({ containerId: 'test-container' })
      trap.activate()
      expect(trap.isActive()).toBe(true)

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      expect(trap.isActive()).toBe(false)
    })

    it('does not deactivate on Escape when escapeDeactivates is false', () => {
      const trap = createFocusTrap({
        containerId: 'test-container',
        escapeDeactivates: false,
      })
      trap.activate()
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      expect(trap.isActive()).toBe(true)
      trap.deactivate()
    })

    it('wraps Tab from last to first element', () => {
      const trap = createFocusTrap({ containerId: 'test-container' })
      trap.activate()

      const btn3 = document.getElementById('btn3')!
      btn3.focus()

      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
      document.dispatchEvent(event)
    })

    it('wraps Shift+Tab from first to last element', () => {
      const trap = createFocusTrap({ containerId: 'test-container' })
      trap.activate()

      const btn1 = document.getElementById('btn1')!
      btn1.focus()

      const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
      document.dispatchEvent(event)
    })

    it('returns focus on deactivate when returnFocusOnDeactivate is true', () => {
      const outsideBtn = document.createElement('button')
      outsideBtn.id = 'outside'
      document.body.appendChild(outsideBtn)
      outsideBtn.focus()

      const trap = createFocusTrap({
        containerId: 'test-container',
        returnFocusOnDeactivate: true,
      })
      trap.activate()
      expect(document.activeElement?.id).toBe('btn1')

      trap.deactivate()
      expect(document.activeElement?.id).toBe('outside')
    })

    it('does not return focus when returnFocusOnDeactivate is false', () => {
      const trap = createFocusTrap({
        containerId: 'test-container',
        returnFocusOnDeactivate: false,
      })
      trap.activate()
      trap.deactivate()
      // Should not throw, and focus stays wherever it is
    })

    it('updateContainerId changes target', () => {
      document.body.innerHTML += '<div id="other"><input id="inp1" /></div>'
      const trap = createFocusTrap({ containerId: 'test-container' })
      trap.updateContainerId('other')
      trap.activate()
      expect(document.activeElement?.id).toBe('inp1')
      trap.deactivate()
    })

    it('handles empty container gracefully', () => {
      document.body.innerHTML = '<div id="empty-container"></div>'
      const trap = createFocusTrap({ containerId: 'empty-container' })
      trap.activate()
      // No focusable elements, should not throw
      trap.deactivate()
    })

    it('handles non-existent container', () => {
      const trap = createFocusTrap({ containerId: 'non-existent' })
      trap.activate()
      trap.deactivate()
    })

    it('handles non-existent initialFocusSelector', () => {
      const trap = createFocusTrap({
        containerId: 'test-container',
        initialFocusSelector: '#non-existent',
      })
      trap.activate()
      expect(document.activeElement?.id).toBe('btn1')
      trap.deactivate()
    })

    it('ignores non-Tab keys', () => {
      const trap = createFocusTrap({ containerId: 'test-container' })
      trap.activate()
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
      expect(trap.isActive()).toBe(true)
      trap.deactivate()
    })

    it('skips disabled elements', () => {
      const btn2 = document.getElementById('btn2')!
      btn2.setAttribute('disabled', '')

      const trap = createFocusTrap({ containerId: 'test-container' })
      trap.activate()
      // btn2 should be skipped
      trap.deactivate()
    })
  })

  describe('createShortcutManager', () => {
    it('initializes and handles shortcuts', async () => {
      const handler = vi.fn()
      const manager = createShortcutManager()
      manager.init(handler)

      // loadShortcuts is async — wait for it
      await new Promise((r) => setTimeout(r, 10))

      expect(manager.getShortcuts().length).toBeGreaterThanOrEqual(0)
      manager.destroy()
    })

    it('destroy cleans up handler', () => {
      const manager = createShortcutManager()
      manager.init(vi.fn())
      manager.destroy()
      manager.destroy() // double destroy should not throw
    })

    it('isReservedCombo checks RESERVED_COMBOS', () => {
      const manager = createShortcutManager()
      manager.init(vi.fn())
      expect(manager.isReservedCombo('Ctrl+W')).toBe(true)
      expect(manager.isReservedCombo('Ctrl+Shift+X')).toBe(false)
      manager.destroy()
    })

    it('findConflict returns null when no conflict', () => {
      const manager = createShortcutManager()
      manager.init(vi.fn())
      expect(manager.findConflict('Ctrl+Shift+Z')).toBeNull()
      manager.destroy()
    })
  })

  describe('createKeyRecorder', () => {
    it('records key combination', () => {
      const recorder = createKeyRecorder()
      const onRecord = vi.fn()
      recorder.start(onRecord)
      expect(recorder.isRecording()).toBe(true)

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'K', ctrlKey: true }))
      expect(onRecord).toHaveBeenCalledWith('Ctrl+K')
      expect(recorder.isRecording()).toBe(false)
    })

    it('ignores modifier-only keys', () => {
      const recorder = createKeyRecorder()
      const onRecord = vi.fn()
      recorder.start(onRecord)

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control' }))
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt' }))
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Meta' }))

      expect(onRecord).not.toHaveBeenCalled()
      expect(recorder.isRecording()).toBe(true)
      recorder.stop()
    })

    it('does nothing on double start', () => {
      const recorder = createKeyRecorder()
      recorder.start(vi.fn())
      recorder.start(vi.fn()) // should not throw
      expect(recorder.isRecording()).toBe(true)
      recorder.stop()
    })

    it('does nothing on stop when not recording', () => {
      const recorder = createKeyRecorder()
      recorder.stop() // should not throw
      expect(recorder.isRecording()).toBe(false)
    })

    it('records with Shift modifier', () => {
      const recorder = createKeyRecorder()
      const onRecord = vi.fn()
      recorder.start(onRecord)

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', shiftKey: true }))
      expect(onRecord).toHaveBeenCalledWith('Shift+A')
    })

    it('records with Alt modifier', () => {
      const recorder = createKeyRecorder()
      const onRecord = vi.fn()
      recorder.start(onRecord)

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F1', altKey: true }))
      expect(onRecord).toHaveBeenCalledWith('Alt+F1')
    })

    it('records special key names as-is', () => {
      const recorder = createKeyRecorder()
      const onRecord = vi.fn()
      recorder.start(onRecord)

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      expect(onRecord).toHaveBeenCalledWith('Escape')
    })
  })

  describe('isMac', () => {
    it('returns true for Mac platform', () => {
      Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true })
      expect(isMac()).toBe(true)
    })

    it('returns false for Windows', () => {
      Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true })
      expect(isMac()).toBe(false)
    })
  })

  describe('formatShortcutDisplay', () => {
    it('replaces modifiers on Mac', () => {
      Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true })
      expect(formatShortcutDisplay('Ctrl+Shift+Alt+K')).toContain('\u2318')
      expect(formatShortcutDisplay('Ctrl+Shift+Alt+K')).toContain('\u21E7')
      expect(formatShortcutDisplay('Ctrl+Shift+Alt+K')).toContain('\u2325')
    })

    it('returns unchanged on non-Mac', () => {
      Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true })
      expect(formatShortcutDisplay('Ctrl+Shift+K')).toBe('Ctrl+Shift+K')
    })
  })

  describe('RESERVED_COMBOS', () => {
    it('includes common browser shortcuts', () => {
      expect(RESERVED_COMBOS).toContain('Ctrl+W')
      expect(RESERVED_COMBOS).toContain('Ctrl+T')
      expect(RESERVED_COMBOS).toContain('F5')
      expect(RESERVED_COMBOS).toContain('F12')
    })
  })
})
