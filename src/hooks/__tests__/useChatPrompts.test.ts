import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const mockPrompts = [
  { id: 'p1', title: '페이지 요약', content: '{{content}} 요약해주세요', shortcut: 'sum', category: '읽기', usageCount: 0, createdAt: 0 },
  { id: 'p2', title: '번역', content: '{{content}} 한국어로 번역', shortcut: 'tr', category: '번역', usageCount: 0, createdAt: 0 },
  { id: 'p3', title: '코드 리뷰', content: '코드를 리뷰해주세요', shortcut: 'cr', category: '코드', usageCount: 0, createdAt: 0 },
]

vi.mock('../../lib/promptLibrary', () => ({
  PromptLibrary: {
    searchByShortcut: vi.fn((q: string) => {
      const lq = q.toLowerCase()
      return Promise.resolve(
        mockPrompts.filter(
          (p) =>
            p.title.toLowerCase().includes(lq) ||
            p.shortcut?.toLowerCase().startsWith(lq) ||
            p.category.toLowerCase().includes(lq),
        ),
      )
    }),
    incrementUsage: vi.fn(() => Promise.resolve()),
  },
}))

import { useChatPrompts } from '../useChatPrompts'
import { PromptLibrary } from '../../lib/promptLibrary'

describe('useChatPrompts', () => {
  let setInput: ReturnType<typeof vi.fn>
  let textareaRef: React.RefObject<HTMLTextAreaElement | null>

  beforeEach(() => {
    vi.clearAllMocks()
    setInput = vi.fn()
    textareaRef = { current: { focus: vi.fn() } as unknown as HTMLTextAreaElement }
  })

  it('initializes with prompts hidden', () => {
    const { result } = renderHook(() => useChatPrompts(setInput, textareaRef))

    expect(result.current.showPrompts).toBe(false)
    expect(result.current.prompts).toEqual([])
    expect(result.current.promptIdx).toBe(0)
  })

  it('shows prompts when input starts with /', async () => {
    const { result } = renderHook(() => useChatPrompts(setInput, textareaRef))

    act(() => {
      result.current.handlePromptInput('/sum')
    })

    expect(result.current.showPrompts).toBe(true)

    await waitFor(() => {
      expect(result.current.prompts.length).toBeGreaterThan(0)
    })
    expect(PromptLibrary.searchByShortcut).toHaveBeenCalledWith('sum')
  })

  it('hides prompts when input does not start with /', () => {
    const { result } = renderHook(() => useChatPrompts(setInput, textareaRef))

    // First show
    act(() => {
      result.current.handlePromptInput('/sum')
    })
    expect(result.current.showPrompts).toBe(true)

    // Then type without /
    act(() => {
      result.current.handlePromptInput('hello')
    })
    expect(result.current.showPrompts).toBe(false)
  })

  it('resets promptIdx to 0 when search changes', () => {
    const { result } = renderHook(() => useChatPrompts(setInput, textareaRef))

    act(() => {
      result.current.handlePromptInput('/sum')
    })

    expect(result.current.promptIdx).toBe(0)
  })

  it('navigates down with ArrowDown', async () => {
    const { result } = renderHook(() => useChatPrompts(setInput, textareaRef))

    act(() => {
      result.current.handlePromptInput('/')
    })

    await waitFor(() => {
      expect(result.current.prompts.length).toBeGreaterThan(0)
    })

    const event = { key: 'ArrowDown', preventDefault: vi.fn() } as unknown as React.KeyboardEvent
    act(() => {
      const handled = result.current.handlePromptKeyDown(event)
      expect(handled).toBe(true)
    })

    expect(result.current.promptIdx).toBe(1)
    expect(event.preventDefault).toHaveBeenCalled()
  })

  it('navigates up with ArrowUp (clamps to 0)', async () => {
    const { result } = renderHook(() => useChatPrompts(setInput, textareaRef))

    act(() => {
      result.current.handlePromptInput('/')
    })

    await waitFor(() => {
      expect(result.current.prompts.length).toBeGreaterThan(0)
    })

    // Already at 0, should stay at 0
    const event = { key: 'ArrowUp', preventDefault: vi.fn() } as unknown as React.KeyboardEvent
    act(() => {
      result.current.handlePromptKeyDown(event)
    })

    expect(result.current.promptIdx).toBe(0)
  })

  it('applies prompt on Enter key', async () => {
    const { result } = renderHook(() => useChatPrompts(setInput, textareaRef))

    act(() => {
      result.current.handlePromptInput('/sum')
    })

    await waitFor(() => {
      expect(result.current.prompts.length).toBeGreaterThan(0)
    })

    const event = { key: 'Enter', preventDefault: vi.fn() } as unknown as React.KeyboardEvent
    act(() => {
      const handled = result.current.handlePromptKeyDown(event)
      expect(handled).toBe(true)
    })

    expect(setInput).toHaveBeenCalled()
    expect(PromptLibrary.incrementUsage).toHaveBeenCalledWith('p1')
    expect(result.current.showPrompts).toBe(false)
  })

  it('closes prompts on Escape key', async () => {
    const { result } = renderHook(() => useChatPrompts(setInput, textareaRef))

    act(() => {
      result.current.handlePromptInput('/')
    })
    expect(result.current.showPrompts).toBe(true)

    const event = { key: 'Escape', preventDefault: vi.fn() } as unknown as React.KeyboardEvent
    act(() => {
      const handled = result.current.handlePromptKeyDown(event)
      expect(handled).toBe(true)
    })

    expect(result.current.showPrompts).toBe(false)
  })

  it('returns false for unrelated keys when prompts are shown', async () => {
    const { result } = renderHook(() => useChatPrompts(setInput, textareaRef))

    act(() => {
      result.current.handlePromptInput('/')
    })

    const event = { key: 'a', preventDefault: vi.fn() } as unknown as React.KeyboardEvent
    let handled = false
    act(() => {
      handled = result.current.handlePromptKeyDown(event)
    })

    expect(handled).toBe(false)
  })

  it('returns false for any key when prompts are hidden', () => {
    const { result } = renderHook(() => useChatPrompts(setInput, textareaRef))

    const event = { key: 'ArrowDown', preventDefault: vi.fn() } as unknown as React.KeyboardEvent
    let handled = false
    act(() => {
      handled = result.current.handlePromptKeyDown(event)
    })

    expect(handled).toBe(false)
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('applyPrompt replaces {{content}} placeholder and focuses textarea', async () => {
    const { result } = renderHook(() => useChatPrompts(setInput, textareaRef))

    act(() => {
      result.current.applyPrompt(mockPrompts[0])
    })

    expect(setInput).toHaveBeenCalledWith(' 요약해주세요')
    expect(textareaRef.current!.focus).toHaveBeenCalled()
  })
})
