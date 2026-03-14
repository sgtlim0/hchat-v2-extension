import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNetworkStatus } from '../useNetworkStatus'

describe('useNetworkStatus', () => {
  let originalOnLine: boolean

  beforeEach(() => {
    originalOnLine = navigator.onLine
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      writable: true,
      configurable: true,
    })
  })

  it('returns isOnline: true when navigator.onLine is true', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })

    const { result } = renderHook(() => useNetworkStatus())
    expect(result.current.isOnline).toBe(true)
  })

  it('returns isOnline: false when navigator.onLine is false', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true })

    const { result } = renderHook(() => useNetworkStatus())
    expect(result.current.isOnline).toBe(false)
  })

  it('updates to online when online event fires', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true })

    const { result } = renderHook(() => useNetworkStatus())
    expect(result.current.isOnline).toBe(false)

    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    expect(result.current.isOnline).toBe(true)
  })

  it('updates to offline when offline event fires', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })

    const { result } = renderHook(() => useNetworkStatus())
    expect(result.current.isOnline).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current.isOnline).toBe(false)
  })

  it('handles rapid online/offline transitions', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })

    const { result } = renderHook(() => useNetworkStatus())

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current.isOnline).toBe(false)

    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current.isOnline).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current.isOnline).toBe(false)
  })

  it('removes event listeners on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() => useNetworkStatus())

    expect(addSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(addSpy).toHaveBeenCalledWith('offline', expect.any(Function))

    unmount()

    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function))

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })

  it('does not update state after unmount', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })

    const { result, unmount } = renderHook(() => useNetworkStatus())
    expect(result.current.isOnline).toBe(true)

    unmount()

    // This should not throw or cause issues
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
  })

  it('returns a readonly object', () => {
    const { result } = renderHook(() => useNetworkStatus())
    expect(typeof result.current.isOnline).toBe('boolean')
    expect(Object.keys(result.current)).toEqual(['isOnline'])
  })
})
