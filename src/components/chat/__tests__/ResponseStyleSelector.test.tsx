import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { ResponseStyleSelector } from '../ResponseStyleSelector'

const mockGetStyles = vi.fn()
const mockTrackStyleUsage = vi.fn()
const mockGetRecommendedStyle = vi.fn()

vi.mock('../../../lib/responseTemplate', () => ({
  BUILTIN_STYLES: [
    { id: 'concise', name: '간결', tone: 'formal', builtin: true, usageCount: 5, lengthGuide: 'short', formatHints: [], systemPromptSuffix: '', createdAt: 0 },
    { id: 'detailed', name: '상세', tone: 'formal', builtin: true, usageCount: 3, lengthGuide: 'long', formatHints: [], systemPromptSuffix: '', createdAt: 0 },
    { id: 'technical', name: '기술적', tone: 'technical', builtin: true, usageCount: 0, lengthGuide: 'medium', formatHints: [], systemPromptSuffix: '', createdAt: 0 },
    { id: 'casual', name: '캐주얼', tone: 'casual', builtin: true, usageCount: 0, lengthGuide: 'medium', formatHints: [], systemPromptSuffix: '', createdAt: 0 },
  ],
  getStyles: (...args: unknown[]) => mockGetStyles(...args),
  trackStyleUsage: (...args: unknown[]) => mockTrackStyleUsage(...args),
  getRecommendedStyle: (...args: unknown[]) => mockGetRecommendedStyle(...args),
}))

vi.mock('../../../i18n', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}))

const defaultProps = {
  onSelectStyle: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetStyles.mockResolvedValue([])
  mockTrackStyleUsage.mockResolvedValue(undefined)
  mockGetRecommendedStyle.mockResolvedValue({ id: 'concise', name: '간결' })
})

describe('ResponseStyleSelector', () => {
  it('renders trigger button with default label', async () => {
    await act(async () => {
      render(<ResponseStyleSelector {...defaultProps} />)
    })

    expect(screen.getByRole('button', { name: /style\.default/i })).toBeInTheDocument()
  })

  it('opens dropdown on click', async () => {
    await act(async () => {
      render(<ResponseStyleSelector {...defaultProps} />)
    })

    const trigger = screen.getByRole('button', { name: /style\.default/i })
    fireEvent.click(trigger)

    expect(screen.getByText('style.concise')).toBeInTheDocument()
    expect(screen.getByText('style.detailed')).toBeInTheDocument()
  })

  it('selects default option and calls onSelectStyle(null)', async () => {
    await act(async () => {
      render(<ResponseStyleSelector {...defaultProps} currentStyleId="concise" />)
    })

    const trigger = screen.getByRole('button')
    fireEvent.click(trigger)

    const defaultOption = screen.getByText('style.default')
    fireEvent.click(defaultOption)

    expect(defaultProps.onSelectStyle).toHaveBeenCalledWith(null)
  })

  it('shows builtin badge for builtin styles', async () => {
    await act(async () => {
      render(<ResponseStyleSelector {...defaultProps} />)
    })

    fireEvent.click(screen.getByRole('button'))

    const builtinBadges = screen.getAllByText('style.builtin')
    expect(builtinBadges.length).toBeGreaterThanOrEqual(1)
  })

  it('selects style and calls onSelectStyle + trackStyleUsage', async () => {
    await act(async () => {
      render(<ResponseStyleSelector {...defaultProps} />)
    })

    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('style.concise'))

    expect(defaultProps.onSelectStyle).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'concise' }),
    )
    expect(mockTrackStyleUsage).toHaveBeenCalledWith('concise')
  })

  it('shows recommended badge for recommended style', async () => {
    await act(async () => {
      render(<ResponseStyleSelector {...defaultProps} />)
    })

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('style.recommended')).toBeInTheDocument()
    })
  })

  it('closes dropdown on outside click', async () => {
    await act(async () => {
      render(
        <div>
          <div data-testid="outside">outside</div>
          <ResponseStyleSelector {...defaultProps} />
        </div>,
      )
    })

    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('style.concise')).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByTestId('outside'))

    expect(screen.queryByText('style.concise')).not.toBeInTheDocument()
  })

  it('reflects currentStyleId in trigger label', async () => {
    await act(async () => {
      render(<ResponseStyleSelector {...defaultProps} currentStyleId="concise" />)
    })

    expect(screen.getByRole('button', { name: /style\.concise/i })).toBeInTheDocument()
  })

  it('shows custom styles when available', async () => {
    mockGetStyles.mockResolvedValue([
      { id: 'custom-1', name: 'My Style', tone: 'casual', usageCount: 1, lengthGuide: 'short', formatHints: [], systemPromptSuffix: '', createdAt: Date.now() },
    ])

    await act(async () => {
      render(<ResponseStyleSelector {...defaultProps} />)
    })

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('My Style')).toBeInTheDocument()
    })
  })

  it('closes dropdown on ESC key', async () => {
    await act(async () => {
      render(<ResponseStyleSelector {...defaultProps} />)
    })

    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('style.concise')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByText('style.concise')).not.toBeInTheDocument()
  })
})
