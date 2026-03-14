import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../lib/shortcuts', async () => {
  const actual = await vi.importActual<typeof import('../../lib/shortcuts')>('../../lib/shortcuts')
  return {
    ...actual,
    loadShortcuts: vi.fn(() => Promise.resolve(actual.DEFAULT_SHORTCUTS)),
  }
})

import { useShortcuts } from '../useShortcuts'
import { DEFAULT_SHORTCUTS, loadShortcuts } from '../../lib/shortcuts'

describe('useShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns default shortcuts initially', () => {
    const { result } = renderHook(() => useShortcuts({}))
    expect(result.current).toEqual(DEFAULT_SHORTCUTS)
  })

  it('loads shortcuts from storage on mount', async () => {
    renderHook(() => useShortcuts({}))
    expect(loadShortcuts).toHaveBeenCalled()
  })

  it('executes action on matching keyboard shortcut (Ctrl+N)', () => {
    const newChat = vi.fn()
    renderHook(() => useShortcuts({ 'new-chat': newChat }))

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'N',
          ctrlKey: true,
          bubbles: true,
        }),
      )
    })

    expect(newChat).toHaveBeenCalled()
  })

  it('executes Escape shortcut for stop-generation', () => {
    const stopGen = vi.fn()
    renderHook(() => useShortcuts({ 'stop-generation': stopGen }))

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
        }),
      )
    })

    expect(stopGen).toHaveBeenCalled()
  })

  it('does not fire single-char shortcut (/) when in input field', () => {
    const focusInput = vi.fn()
    renderHook(() => useShortcuts({ 'focus-input': focusInput }))

    // Create an input element to be the target
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: '/',
          bubbles: true,
        }),
      )
    })

    expect(focusInput).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('fires multi-key shortcut (Ctrl+N) even when in input field', () => {
    const newChat = vi.fn()
    renderHook(() => useShortcuts({ 'new-chat': newChat }))

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'N',
          ctrlKey: true,
          bubbles: true,
        }),
      )
    })

    expect(newChat).toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('does nothing when no action is registered for the shortcut', () => {
    // Register no actions
    renderHook(() => useShortcuts({}))

    // Should not throw
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'N',
          ctrlKey: true,
          bubbles: true,
        }),
      )
    })
  })

  it('removes keydown listener on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const { unmount } = renderHook(() => useShortcuts({}))

    unmount()

    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    removeSpy.mockRestore()
  })

  it('handles Ctrl+K for search-history', () => {
    const searchHistory = vi.fn()
    renderHook(() => useShortcuts({ 'search-history': searchHistory }))

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'K',
          ctrlKey: true,
          bubbles: true,
        }),
      )
    })

    expect(searchHistory).toHaveBeenCalled()
  })
})
