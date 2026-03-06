import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryPanel } from '../MemoryPanel'

// Mock aiMemory
const mockGetMemories = vi.fn()
const mockAddMemory = vi.fn()
const mockUpdateMemory = vi.fn()
const mockDeleteMemory = vi.fn()
const mockSearchMemories = vi.fn()
const mockExportMemories = vi.fn()
const mockImportMemories = vi.fn()

vi.mock('../../lib/aiMemory', () => ({
  getMemories: (...args: unknown[]) => mockGetMemories(...args),
  addMemory: (...args: unknown[]) => mockAddMemory(...args),
  updateMemory: (...args: unknown[]) => mockUpdateMemory(...args),
  deleteMemory: (...args: unknown[]) => mockDeleteMemory(...args),
  searchMemories: (...args: unknown[]) => mockSearchMemories(...args),
  exportMemories: (...args: unknown[]) => mockExportMemories(...args),
  importMemories: (...args: unknown[]) => mockImportMemories(...args),
}))

// Mock i18n
vi.mock('../../i18n', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'memory.title': 'AI 메모리',
        'memory.search': '메모리 검색',
        'memory.add': '메모리 추가',
        'memory.approve': '승인',
        'memory.delete': '삭제',
        'memory.export': '내보내기',
        'memory.import': '가져오기',
        'memory.category': '카테고리',
        'memory.approved': '승인됨',
        'memory.pending': '대기 중',
        'common.close': '닫기',
      }
      return map[key] ?? key
    },
    locale: 'ko',
  }),
}))

const MOCK_MEMORIES = [
  { id: 'm1', category: 'name' as const, content: '사용자: 홍길동', approved: true, createdAt: Date.now() },
  { id: 'm2', category: 'preference' as const, content: 'TypeScript 선호', approved: false, createdAt: Date.now() },
]

describe('MemoryPanel', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMemories.mockResolvedValue([...MOCK_MEMORIES])
    mockAddMemory.mockResolvedValue({ id: 'm3', category: 'custom', content: 'test', approved: true, createdAt: Date.now() })
    mockUpdateMemory.mockResolvedValue({})
    mockDeleteMemory.mockResolvedValue(undefined)
    mockSearchMemories.mockResolvedValue([])
    mockExportMemories.mockResolvedValue('[]')
    mockImportMemories.mockResolvedValue(0)
  })

  it('타이틀과 닫기 버튼 렌더링', async () => {
    render(<MemoryPanel onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('AI 메모리')).toBeDefined()
    })
    expect(screen.getByText('닫기')).toBeDefined()
  })

  it('메모리 목록 로드 및 표시', async () => {
    render(<MemoryPanel onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('사용자: 홍길동')).toBeDefined()
    })
    expect(screen.getByText('TypeScript 선호')).toBeDefined()
    expect(mockGetMemories).toHaveBeenCalled()
  })

  it('닫기 버튼 클릭 시 onClose 호출', async () => {
    render(<MemoryPanel onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('닫기')).toBeDefined()
    })
    fireEvent.click(screen.getByText('닫기'))
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('검색 입력 시 searchMemories 호출', async () => {
    mockSearchMemories.mockResolvedValue([MOCK_MEMORIES[0]])
    render(<MemoryPanel onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByPlaceholderText('메모리 검색')).toBeDefined()
    })
    const input = screen.getByPlaceholderText('메모리 검색')
    fireEvent.change(input, { target: { value: '홍길동' } })
    await waitFor(() => {
      expect(mockSearchMemories).toHaveBeenCalledWith('홍길동')
    })
  })

  it('카테고리 필터 클릭 시 해당 카테고리만 표시', async () => {
    render(<MemoryPanel onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('사용자: 홍길동')).toBeDefined()
    })
    // Click 'name' category filter button (not the badge inside cards)
    const filterButtons = screen.getAllByText('name')
    // The first 'name' text is the filter button
    fireEvent.click(filterButtons[0])
    await waitFor(() => {
      expect(screen.getByText('사용자: 홍길동')).toBeDefined()
      expect(screen.queryByText('TypeScript 선호')).toBeNull()
    })
  })

  it('승인 버튼 클릭 시 updateMemory 호출', async () => {
    render(<MemoryPanel onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('TypeScript 선호')).toBeDefined()
    })
    // The pending item (m2) should have an approve button
    const approveBtns = screen.getAllByText('승인')
    fireEvent.click(approveBtns[0])
    await waitFor(() => {
      expect(mockUpdateMemory).toHaveBeenCalledWith('m2', { approved: true })
    })
  })

  it('삭제 버튼 클릭 시 deleteMemory 호출', async () => {
    render(<MemoryPanel onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('사용자: 홍길동')).toBeDefined()
    })
    const deleteBtns = screen.getAllByText('삭제')
    fireEvent.click(deleteBtns[0])
    await waitFor(() => {
      expect(mockDeleteMemory).toHaveBeenCalledWith('m1')
    })
  })

  it('메모리 추가: content와 category 입력 후 추가', async () => {
    render(<MemoryPanel onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('메모리 추가')).toBeDefined()
    })
    fireEvent.click(screen.getByText('메모리 추가'))
    // Add form should appear
    await waitFor(() => {
      expect(screen.getByPlaceholderText('memory.addPlaceholder')).toBeDefined()
    })
    const contentInput = screen.getByPlaceholderText('memory.addPlaceholder')
    fireEvent.change(contentInput, { target: { value: '새 메모리 내용' } })
    // Submit the form
    const submitBtn = screen.getByText('memory.addSubmit')
    fireEvent.click(submitBtn)
    await waitFor(() => {
      expect(mockAddMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '새 메모리 내용',
          category: 'custom',
          approved: true,
        })
      )
    })
  })

  it('승인된 항목에 승인됨 배지 표시', async () => {
    render(<MemoryPanel onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('사용자: 홍길동')).toBeDefined()
    })
    expect(screen.getByText('승인됨')).toBeDefined()
  })

  it('미승인 항목에 대기 중 배지 표시', async () => {
    render(<MemoryPanel onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('TypeScript 선호')).toBeDefined()
    })
    expect(screen.getByText('대기 중')).toBeDefined()
  })

  it('Export 버튼 클릭 시 exportMemories 호출', async () => {
    const createObjectURL = vi.fn(() => 'blob:test')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(globalThis, 'URL', {
      value: { createObjectURL, revokeObjectURL },
      writable: true,
    })

    render(<MemoryPanel onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('내보내기')).toBeDefined()
    })
    fireEvent.click(screen.getByText('내보내기'))
    await waitFor(() => {
      expect(mockExportMemories).toHaveBeenCalled()
    })
  })

  it('Import 버튼으로 JSON 파일 가져오기', async () => {
    mockImportMemories.mockResolvedValue(2)
    render(<MemoryPanel onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('가져오기')).toBeDefined()
    })
    const importLabel = screen.getByText('가져오기')
    const input = importLabel.closest('label')?.querySelector('input[type="file"]')
    expect(input).toBeDefined()

    const file = new File(['[{"id":"m4"}]'], 'memories.json', { type: 'application/json' })
    Object.defineProperty(input!, 'files', { value: [file] })
    fireEvent.change(input!)
    await waitFor(() => {
      expect(mockImportMemories).toHaveBeenCalled()
    })
  })
})
