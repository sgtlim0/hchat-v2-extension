import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MultimodalPreview } from '../MultimodalPreview'
import type { ImageAttachment } from '../../../lib/multimodalInput'

vi.mock('../../../i18n', () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (!params) return key
      return key.replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? String(params[k]) : `{${k}}`))
    },
  }),
}))

function createAttachment(overrides: Partial<ImageAttachment> = {}): ImageAttachment {
  return {
    id: 'att-1',
    dataUrl: 'data:image/png;base64,abc123',
    name: 'screenshot.png',
    size: 2048,
    type: 'image/png',
    addedAt: Date.now(),
    ...overrides,
  }
}

describe('MultimodalPreview', () => {
  let onRemove: ReturnType<typeof vi.fn>
  let onClear: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    onRemove = vi.fn()
    onClear = vi.fn()
  })

  it('returns null when attachments is empty', () => {
    const { container } = render(
      <MultimodalPreview attachments={[]} onRemove={onRemove} onClear={onClear} />,
    )

    expect(container.innerHTML).toBe('')
  })

  it('renders image thumbnail', () => {
    const att = createAttachment()

    render(
      <MultimodalPreview attachments={[att]} onRemove={onRemove} onClear={onClear} />,
    )

    const img = screen.getByRole('img')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', att.dataUrl)
  })

  it('displays name and size', () => {
    const att = createAttachment({ name: 'photo.jpg', size: 3072 })

    render(
      <MultimodalPreview attachments={[att]} onRemove={onRemove} onClear={onClear} />,
    )

    expect(screen.getByText('photo.jpg')).toBeInTheDocument()
    expect(screen.getByText('3.0 KB')).toBeInTheDocument()
  })

  it('calls onRemove when remove button is clicked', () => {
    const att = createAttachment({ id: 'att-42' })

    render(
      <MultimodalPreview attachments={[att]} onRemove={onRemove} onClear={onClear} />,
    )

    const removeBtn = screen.getByRole('button', { name: /attachment\.remove/i })
    fireEvent.click(removeBtn)

    expect(onRemove).toHaveBeenCalledWith('att-42')
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('calls onClear when clear all button is clicked', () => {
    const atts = [
      createAttachment({ id: 'a1' }),
      createAttachment({ id: 'a2', name: 'img2.png' }),
    ]

    render(
      <MultimodalPreview attachments={atts} onRemove={onRemove} onClear={onClear} />,
    )

    const clearBtn = screen.getByRole('button', { name: /attachment\.clearAll/i })
    fireEvent.click(clearBtn)

    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('renders grid with multiple images', () => {
    const atts = [
      createAttachment({ id: 'a1', name: 'img1.png' }),
      createAttachment({ id: 'a2', name: 'img2.png' }),
      createAttachment({ id: 'a3', name: 'img3.png' }),
    ]

    render(
      <MultimodalPreview attachments={atts} onRemove={onRemove} onClear={onClear} />,
    )

    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(3)

    expect(screen.getByText('img1.png')).toBeInTheDocument()
    expect(screen.getByText('img2.png')).toBeInTheDocument()
    expect(screen.getByText('img3.png')).toBeInTheDocument()
  })

  it('formats size correctly in KB and MB', () => {
    const atts = [
      createAttachment({ id: 'a1', name: 'small.png', size: 512 }),
      createAttachment({ id: 'a2', name: 'large.png', size: 2_621_440 }),
    ]

    render(
      <MultimodalPreview attachments={atts} onRemove={onRemove} onClear={onClear} />,
    )

    expect(screen.getByText('0.5 KB')).toBeInTheDocument()
    expect(screen.getByText('2.5 MB')).toBeInTheDocument()
  })

  it('hides clear all button when only one attachment', () => {
    const att = createAttachment()

    render(
      <MultimodalPreview attachments={[att]} onRemove={onRemove} onClear={onClear} />,
    )

    expect(screen.queryByRole('button', { name: /attachment\.clearAll/i })).not.toBeInTheDocument()
  })
})
