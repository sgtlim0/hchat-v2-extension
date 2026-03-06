import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TeamSharingPanel } from '../TeamSharingPanel'

// Mock i18n
vi.mock('../../i18n', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'sharing.title': '팀 공유',
        'sharing.export': '내보내기',
        'sharing.import': '가져오기',
        'sharing.history': '기록',
        'sharing.author': '작성자',
        'sharing.description': '설명',
        'sharing.selectItems': '항목 선택',
        'sharing.preview': '미리보기',
        'sharing.apply': '적용',
        'sharing.download': '다운로드',
        'common.close': '닫기',
        'common.error': '오류',
      }
      return map[key] ?? key
    },
    locale: 'ko',
  }),
}))

// Mock teamSharing
const mockGetShareHistory = vi.fn()
const mockCreateSharePackage = vi.fn()
const mockExportPackage = vi.fn()
const mockImportPackage = vi.fn()
const mockValidatePackage = vi.fn()
const mockApplyPackage = vi.fn()

vi.mock('../../lib/teamSharing', () => ({
  createSharePackage: (...args: unknown[]) => mockCreateSharePackage(...args),
  exportPackage: (...args: unknown[]) => mockExportPackage(...args),
  importPackage: (...args: unknown[]) => mockImportPackage(...args),
  validatePackage: (...args: unknown[]) => mockValidatePackage(...args),
  applyPackage: (...args: unknown[]) => mockApplyPackage(...args),
  getShareHistory: (...args: unknown[]) => mockGetShareHistory(...args),
}))

describe('TeamSharingPanel', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetShareHistory.mockResolvedValue([])
    mockValidatePackage.mockReturnValue({ valid: true, errors: [] })
    mockApplyPackage.mockResolvedValue({ added: 2, skipped: 0, updated: 0, errors: [] })
  })

  // 1. 렌더링: 제목 + 탭 3개 + 닫기 버튼
  it('renders title, 3 tabs, and close button', () => {
    render(<TeamSharingPanel onClose={mockOnClose} />)

    expect(screen.getByText('팀 공유')).toBeInTheDocument()
    expect(screen.getByText('내보내기')).toBeInTheDocument()
    expect(screen.getByText('가져오기')).toBeInTheDocument()
    expect(screen.getByText('기록')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '닫기' })).toBeInTheDocument()
  })

  // 2. 닫기 버튼 클릭 → onClose 호출
  it('calls onClose when close button is clicked', () => {
    render(<TeamSharingPanel onClose={mockOnClose} />)

    fireEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(mockOnClose).toHaveBeenCalledOnce()
  })

  // 3. 내보내기 탭: 체크박스 5개 (item types) 표시
  it('shows 5 item type checkboxes in export tab', () => {
    render(<TeamSharingPanel onClose={mockOnClose} />)

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(5)
    expect(screen.getByLabelText('assistant')).toBeInTheDocument()
    expect(screen.getByLabelText('prompt')).toBeInTheDocument()
    expect(screen.getByLabelText('template')).toBeInTheDocument()
    expect(screen.getByLabelText('chain')).toBeInTheDocument()
    expect(screen.getByLabelText('workflow')).toBeInTheDocument()
  })

  // 4. 내보내기 탭: 작성자/설명 입력 필드
  it('shows author and description inputs in export tab', () => {
    render(<TeamSharingPanel onClose={mockOnClose} />)

    expect(screen.getByPlaceholderText('작성자')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('설명')).toBeInTheDocument()
  })

  // 5. 내보내기: 다운로드 버튼 클릭 → createSharePackage + exportPackage 호출
  it('creates and downloads package on export', () => {
    const mockPkg = {
      formatVersion: 1,
      author: 'tester',
      description: 'test desc',
      createdAt: Date.now(),
      items: [{ type: 'assistant', data: {} }],
    }
    mockCreateSharePackage.mockReturnValue(mockPkg)
    mockExportPackage.mockReturnValue(JSON.stringify(mockPkg))

    // Mock URL.createObjectURL / revokeObjectURL
    const createObjectURL = vi.fn(() => 'blob:test')
    const revokeObjectURL = vi.fn()
    global.URL.createObjectURL = createObjectURL
    global.URL.revokeObjectURL = revokeObjectURL

    render(<TeamSharingPanel onClose={mockOnClose} />)

    // Select assistant checkbox
    fireEvent.click(screen.getByLabelText('assistant'))

    // Fill in author and description
    fireEvent.change(screen.getByPlaceholderText('작성자'), { target: { value: 'tester' } })
    fireEvent.change(screen.getByPlaceholderText('설명'), { target: { value: 'test desc' } })

    // Click download
    fireEvent.click(screen.getByText('다운로드'))

    expect(mockCreateSharePackage).toHaveBeenCalledWith(
      [{ type: 'assistant', data: {} }],
      { author: 'tester', description: 'test desc' },
    )
    expect(mockExportPackage).toHaveBeenCalledWith(mockPkg)
  })

  // 6. 가져오기 탭 전환
  it('switches to import tab', () => {
    render(<TeamSharingPanel onClose={mockOnClose} />)

    fireEvent.click(screen.getByText('가져오기'))

    // Import tab should show file upload area
    expect(screen.getByText('미리보기')).toBeInTheDocument()
  })

  // 7. 가져오기: 파일 업로드 → 검증 → 미리보기 표시
  it('validates and shows preview on file upload', async () => {
    const pkgData = {
      formatVersion: 1,
      author: 'author1',
      description: 'desc',
      createdAt: Date.now(),
      items: [
        { type: 'assistant', data: { id: '1' } },
        { type: 'prompt', data: { id: '2' } },
      ],
    }
    mockImportPackage.mockReturnValue(pkgData)
    mockValidatePackage.mockReturnValue({ valid: true, errors: [] })

    render(<TeamSharingPanel onClose={mockOnClose} />)
    fireEvent.click(screen.getByText('가져오기'))

    const fileInput = screen.getByTestId('import-file-input')
    const file = new File([JSON.stringify(pkgData)], 'share.json', { type: 'application/json' })

    // Simulate file read
    Object.defineProperty(fileInput, 'files', { value: [file] })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(mockImportPackage).toHaveBeenCalled()
      expect(mockValidatePackage).toHaveBeenCalledWith(pkgData)
    })
  })

  // 8. 가져오기: 적용 버튼 → applyPackage 호출
  it('applies package on apply button click', async () => {
    const pkgData = {
      formatVersion: 1,
      author: 'author1',
      description: 'desc',
      createdAt: Date.now(),
      items: [{ type: 'assistant', data: { id: '1' } }],
    }
    mockImportPackage.mockReturnValue(pkgData)
    mockValidatePackage.mockReturnValue({ valid: true, errors: [] })
    mockApplyPackage.mockResolvedValue({ added: 1, skipped: 0, updated: 0, errors: [] })

    render(<TeamSharingPanel onClose={mockOnClose} />)
    fireEvent.click(screen.getByText('가져오기'))

    const fileInput = screen.getByTestId('import-file-input')
    const file = new File([JSON.stringify(pkgData)], 'share.json', { type: 'application/json' })
    Object.defineProperty(fileInput, 'files', { value: [file] })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText('적용')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('적용'))

    await waitFor(() => {
      expect(mockApplyPackage).toHaveBeenCalledWith(pkgData)
    })
  })

  // 9. 가져오기: 검증 실패 시 에러 표시
  it('shows validation errors on invalid package', async () => {
    const pkgData = { formatVersion: 1, author: '', description: '', createdAt: 0, items: [] }
    mockImportPackage.mockReturnValue(pkgData)
    mockValidatePackage.mockReturnValue({ valid: false, errors: ['author가 필요합니다'] })

    render(<TeamSharingPanel onClose={mockOnClose} />)
    fireEvent.click(screen.getByText('가져오기'))

    const fileInput = screen.getByTestId('import-file-input')
    const file = new File([JSON.stringify(pkgData)], 'share.json', { type: 'application/json' })
    Object.defineProperty(fileInput, 'files', { value: [file] })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText('author가 필요합니다')).toBeInTheDocument()
    })
  })

  // 10. 히스토리 탭: 공유 기록 표시
  it('shows share history in history tab', async () => {
    mockGetShareHistory.mockResolvedValue([
      { id: 'r1', type: 'export', packageName: 'pkg1', itemCount: 3, timestamp: Date.now() - 60000 },
      { id: 'r2', type: 'import', packageName: 'pkg2', itemCount: 5, timestamp: Date.now() },
    ])

    render(<TeamSharingPanel onClose={mockOnClose} />)
    fireEvent.click(screen.getByText('기록'))

    await waitFor(() => {
      expect(screen.getByText('pkg1')).toBeInTheDocument()
      expect(screen.getByText('pkg2')).toBeInTheDocument()
    })
  })

  // 11. 히스토리 탭: 기록 없을 때 빈 상태 표시
  it('shows empty state when no history', async () => {
    mockGetShareHistory.mockResolvedValue([])

    render(<TeamSharingPanel onClose={mockOnClose} />)
    fireEvent.click(screen.getByText('기록'))

    await waitFor(() => {
      expect(screen.getByText(/기록/)).toBeInTheDocument()
    })
  })

  // 12. 내보내기: 항목 미선택 시 다운로드 비활성화
  it('disables download when no items selected', () => {
    render(<TeamSharingPanel onClose={mockOnClose} />)

    const downloadBtn = screen.getByText('다운로드')
    expect(downloadBtn).toBeDisabled()
  })
})
