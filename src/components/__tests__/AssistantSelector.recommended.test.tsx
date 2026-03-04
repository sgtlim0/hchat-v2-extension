import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { AssistantSelector } from '../AssistantSelector'

const mockGetTopUsed = vi.fn()

vi.mock('../../lib/userPreferences', () => ({
  getTopUsed: (...args: unknown[]) => mockGetTopUsed(...args),
}))

const mockList = vi.fn()
const mockSetActive = vi.fn()

vi.mock('../../lib/assistantBuilder', () => ({
  AssistantRegistry: {
    list: (...args: unknown[]) => mockList(...args),
    setActive: (...args: unknown[]) => mockSetActive(...args),
    getActive: vi.fn(() => Promise.resolve('ast-default')),
    exportAssistants: vi.fn(() => Promise.resolve('[]')),
    importAssistants: vi.fn(() => Promise.resolve({ imported: 0, skipped: 0 })),
    add: vi.fn(),
    remove: vi.fn(),
  },
}))

vi.mock('../../i18n', () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) return `${key}:${JSON.stringify(params)}`
      return key
    },
  }),
}))

const BUILTIN_ASSISTANTS = [
  { id: 'ast-default', name: '기본 비서', icon: '🤖', description: '기본', isBuiltIn: true, category: 'other', usageCount: 0, systemPrompt: '', model: '', tools: [], parameters: {} },
  { id: 'ast-translator', name: '번역가', icon: '🌐', description: '번역', isBuiltIn: true, category: 'translate', usageCount: 5, systemPrompt: '', model: '', tools: [], parameters: {} },
  { id: 'ast-code-reviewer', name: '코드 리뷰어', icon: '💻', description: '코드', isBuiltIn: true, category: 'code', usageCount: 3, systemPrompt: '', model: '', tools: [], parameters: {} },
  { id: 'ast-writer', name: '작가', icon: '✍️', description: '글쓰기', isBuiltIn: true, category: 'writing', usageCount: 1, systemPrompt: '', model: '', tools: [], parameters: {} },
]

const TOP_USED = [
  { id: 'ast-translator', count: 10, lastUsed: Date.now() },
  { id: 'ast-default', count: 8, lastUsed: Date.now() },
  { id: 'ast-code-reviewer', count: 5, lastUsed: Date.now() },
]

async function renderAndOpen(value = 'ast-default') {
  const result = render(
    <AssistantSelector value={value} onChange={vi.fn()} />,
  )
  // Wait for assistants to load, then open dropdown
  await waitFor(() => {
    expect(screen.getByText('기본 비서')).toBeDefined()
  })
  fireEvent.click(screen.getByText('기본 비서'))
  return result
}

describe('AssistantSelector recommended', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockList.mockResolvedValue(BUILTIN_ASSISTANTS)
    mockGetTopUsed.mockResolvedValue(TOP_USED)
  })

  it('loads recommended assistant IDs on mount', async () => {
    render(<AssistantSelector value="ast-default" onChange={vi.fn()} />)
    await waitFor(() => {
      expect(mockGetTopUsed).toHaveBeenCalledWith('assistant', 3)
    })
  })

  it('shows star badge for recommended assistants', async () => {
    await renderAndOpen()
    await waitFor(() => {
      const badges = document.querySelectorAll('.assistant-recommended-badge')
      expect(badges.length).toBeGreaterThan(0)
    })
  })

  it('recommended category tab exists', async () => {
    await renderAndOpen()
    await waitFor(() => {
      expect(screen.getByText('assistant.categoryRecommended')).toBeDefined()
    })
  })

  it('recommended category filters to top used only', async () => {
    await renderAndOpen()
    await waitFor(() => {
      expect(screen.getByText('번역가')).toBeDefined()
    })
    // Click recommended tab
    fireEvent.click(screen.getByText('assistant.categoryRecommended'))
    await waitFor(() => {
      // 작가 (writer) is not in top used, should not appear
      expect(screen.queryByText('작가')).toBeNull()
      // 번역가 (translator) is in top used, should appear
      expect(screen.getByText('번역가')).toBeDefined()
    })
  })

  it('non-recommended assistants do not have badge', async () => {
    await renderAndOpen()
    await waitFor(() => {
      const writerItem = screen.getByText('작가').closest('.persona-item')
      const badge = writerItem?.querySelector('.assistant-recommended-badge')
      expect(badge).toBeNull()
    })
  })

  it('getTopUsed error does not break component', async () => {
    mockGetTopUsed.mockRejectedValue(new Error('fail'))
    await renderAndOpen()
    await waitFor(() => {
      expect(screen.getByText('번역가')).toBeDefined()
    })
  })

  it('empty recommendations shows no badges', async () => {
    mockGetTopUsed.mockResolvedValue([])
    await renderAndOpen()
    await waitFor(() => {
      const badges = document.querySelectorAll('.assistant-recommended-badge')
      expect(badges.length).toBe(0)
    })
  })

  it('recommended tab shows empty state when no recommendations', async () => {
    mockGetTopUsed.mockResolvedValue([])
    await renderAndOpen()
    fireEvent.click(screen.getByText('assistant.categoryRecommended'))
    await waitFor(() => {
      // No assistant items should be shown in dropdown list
      expect(screen.queryByText('번역가')).toBeNull()
      expect(screen.queryByText('코드 리뷰어')).toBeNull()
    })
  })

  it('badge appears in builtin section for recommended assistants', async () => {
    await renderAndOpen()
    await waitFor(() => {
      const translatorItem = screen.getByText('번역가').closest('.persona-item')
      const badge = translatorItem?.querySelector('.assistant-recommended-badge')
      expect(badge).toBeDefined()
      expect(badge?.textContent).toBe('⭐')
    })
  })

  it('recommended IDs update when component remounts', async () => {
    const { unmount } = render(
      <AssistantSelector value="ast-default" onChange={vi.fn()} />,
    )
    await waitFor(() => {
      expect(mockGetTopUsed).toHaveBeenCalledTimes(1)
    })
    unmount()

    mockGetTopUsed.mockResolvedValue([{ id: 'ast-writer', count: 3, lastUsed: Date.now() }])
    render(<AssistantSelector value="ast-default" onChange={vi.fn()} />)
    await waitFor(() => {
      expect(mockGetTopUsed).toHaveBeenCalledTimes(2)
    })
  })
})
