import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ShortcutsConfig } from '../ShortcutsConfig'
import { DEFAULT_SHORTCUTS } from '../../lib/shortcuts'

// Mock shortcutManager
vi.mock('../../lib/shortcutManager', () => ({
  createKeyRecorder: () => {
    let recording = false
    let handler: ((keys: string) => void) | null = null
    return {
      start: vi.fn((onRecord: (keys: string) => void) => {
        recording = true
        handler = onRecord
        // Simulate a key record after a tick
        setTimeout(() => {
          if (handler) handler('Ctrl+Shift+X')
        }, 10)
      }),
      stop: vi.fn(() => { recording = false; handler = null }),
      isRecording: () => recording,
    }
  },
  RESERVED_COMBOS: ['Ctrl+W', 'Ctrl+T', 'Ctrl+N', 'Ctrl+Tab', 'Ctrl+Shift+Tab', 'Ctrl+L', 'Ctrl+R', 'F5', 'F12', 'Alt+F4'],
  formatShortcutDisplay: (keys: string) => keys,
  isMac: () => false,
}))

// Mock i18n
vi.mock('../../i18n', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'shortcuts.newChat': '새 대화',
        'shortcuts.focusInput': '입력창 포커스',
        'shortcuts.stopGeneration': '응답 생성 중지',
        'shortcuts.searchHistory': '대화 기록 검색',
        'shortcuts.toggleContext': '페이지 컨텍스트 토글',
        'shortcuts.nextTab': '다음 탭',
        'shortcuts.prevTab': '이전 탭',
        'shortcuts.config': '단축키 설정',
        'shortcuts.title': '키보드 단축키',
        'shortcuts.record': '키 변경',
        'shortcuts.recordPrompt': '키를 누르세요...',
        'shortcuts.reserved': '예약된 단축키입니다',
        'shortcuts.conflict': '이미 사용 중인 단축키입니다',
        'shortcuts.reset': '기본값 복원',
        'shortcuts.export': '내보내기',
        'shortcuts.import': '가져오기',
        'shortcuts.platformNote': '플랫폼별 키 표시가 다를 수 있습니다',
      }
      return map[key] ?? key
    },
    locale: 'ko',
  }),
}))

describe('ShortcutsConfig', () => {
  const mockOnChange = vi.fn()

  beforeEach(() => {
    mockOnChange.mockClear()
  })

  it('기본 단축키 목록 렌더링', () => {
    render(<ShortcutsConfig shortcuts={DEFAULT_SHORTCUTS} onChange={mockOnChange} />)
    expect(screen.getByText('새 대화')).toBeDefined()
    expect(screen.getByText('입력창 포커스')).toBeDefined()
    expect(screen.getByText('다음 탭')).toBeDefined()
  })

  it('각 단축키의 키 조합 표시', () => {
    render(<ShortcutsConfig shortcuts={DEFAULT_SHORTCUTS} onChange={mockOnChange} />)
    expect(screen.getByText('Ctrl+N')).toBeDefined()
    expect(screen.getByText('Ctrl+K')).toBeDefined()
    expect(screen.getByText('/')).toBeDefined()
  })

  it('customizable이 true인 단축키만 키 변경 버튼 표시', () => {
    render(<ShortcutsConfig shortcuts={DEFAULT_SHORTCUTS} onChange={mockOnChange} />)
    const recordBtns = screen.getAllByText('키 변경')
    // customizable: true인 항목: new-chat, search-history, toggle-context = 3개
    expect(recordBtns.length).toBe(3)
  })

  it('키 변경 버튼 클릭 시 녹음 모드 활성화', async () => {
    render(<ShortcutsConfig shortcuts={DEFAULT_SHORTCUTS} onChange={mockOnChange} />)
    const recordBtns = screen.getAllByText('키 변경')
    fireEvent.click(recordBtns[0])
    expect(screen.getByText('키를 누르세요...')).toBeDefined()
  })

  it('키 녹음 후 onChange 호출', async () => {
    render(<ShortcutsConfig shortcuts={DEFAULT_SHORTCUTS} onChange={mockOnChange} />)
    const recordBtns = screen.getAllByText('키 변경')
    fireEvent.click(recordBtns[0])
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled()
    })
  })

  it('예약된 콤보 입력 시 경고 표시', async () => {
    const { rerender } = render(<ShortcutsConfig shortcuts={DEFAULT_SHORTCUTS} onChange={mockOnChange} />)
    // Simulate a reserved combo conflict via state — we test the warning display
    // The warning is shown when a conflict is detected. We test the conflict prop.
    rerender(<ShortcutsConfig shortcuts={DEFAULT_SHORTCUTS} onChange={mockOnChange} conflictWarning="예약된 단축키입니다" />)
    expect(screen.getByText('예약된 단축키입니다')).toBeDefined()
  })

  it('충돌하는 단축키 입력 시 경고 표시', () => {
    render(<ShortcutsConfig shortcuts={DEFAULT_SHORTCUTS} onChange={mockOnChange} conflictWarning="이미 사용 중인 단축키입니다" />)
    expect(screen.getByText('이미 사용 중인 단축키입니다')).toBeDefined()
  })

  it('기본값 복원 버튼 클릭 시 onChange에 DEFAULT_SHORTCUTS 전달', () => {
    const modified = DEFAULT_SHORTCUTS.map((s) =>
      s.id === 'new-chat' ? { ...s, keys: 'Ctrl+Shift+Z' } : s
    )
    render(<ShortcutsConfig shortcuts={modified} onChange={mockOnChange} />)
    const resetBtn = screen.getByText('기본값 복원')
    fireEvent.click(resetBtn)
    expect(mockOnChange).toHaveBeenCalledWith(DEFAULT_SHORTCUTS)
  })

  it('Export 버튼 클릭 시 JSON 다운로드', () => {
    const createObjectURL = vi.fn(() => 'blob:test')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(globalThis, 'URL', {
      value: { createObjectURL, revokeObjectURL },
      writable: true,
    })

    render(<ShortcutsConfig shortcuts={DEFAULT_SHORTCUTS} onChange={mockOnChange} />)
    const exportBtn = screen.getByText('내보내기')
    fireEvent.click(exportBtn)
    expect(createObjectURL).toHaveBeenCalled()
  })

  it('Import 시 유효한 JSON 파일로 onChange 호출', async () => {
    render(<ShortcutsConfig shortcuts={DEFAULT_SHORTCUTS} onChange={mockOnChange} />)
    const importBtn = screen.getByText('가져오기')
    const input = importBtn.closest('label')?.querySelector('input[type="file"]')
    expect(input).toBeDefined()

    const validData = JSON.stringify(DEFAULT_SHORTCUTS)
    const file = new File([validData], 'shortcuts.json', { type: 'application/json' })
    Object.defineProperty(input!, 'files', { value: [file] })
    fireEvent.change(input!)

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled()
    })
  })
})
