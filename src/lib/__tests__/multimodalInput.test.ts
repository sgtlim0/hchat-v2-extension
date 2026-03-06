import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createAttachmentManager,
  validateImage,
  extractImageFromClipboard,
  captureScreenshot,
  resizeImage,
  type ImageAttachment,
  type AttachmentManager,
  type ImageValidation,
} from '../multimodalInput'

// --- Test helpers ---

const TINY_PNG_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const TINY_JPEG_BASE64 =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAx'
const TINY_GIF_BASE64 = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
const TINY_WEBP_BASE64 = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA'

function makeLargeDataUrl(sizeMB: number): string {
  const chars = 'A'.repeat(Math.ceil((sizeMB * 1024 * 1024 * 4) / 3))
  return `data:image/png;base64,${chars}`
}

// --- AttachmentManager ---

describe('createAttachmentManager', () => {
  let manager: AttachmentManager

  beforeEach(() => {
    manager = createAttachmentManager()
  })

  it('should create manager with default max 5', () => {
    expect(manager.count()).toBe(0)
    expect(manager.getAll()).toEqual([])
  })

  it('should add image and return attachment', () => {
    const result = manager.add(TINY_PNG_BASE64, 'screenshot.png')
    expect(result).not.toBeNull()
    expect(result!.dataUrl).toBe(TINY_PNG_BASE64)
    expect(result!.name).toBe('screenshot.png')
    expect(result!.type).toBe('image/png')
    expect(result!.id).toBeTruthy()
    expect(result!.addedAt).toBeGreaterThan(0)
    expect(manager.count()).toBe(1)
  })

  it('should assign default name when not provided', () => {
    const result = manager.add(TINY_PNG_BASE64)
    expect(result).not.toBeNull()
    expect(result!.name).toMatch(/^image-\d+/)
  })

  it('should return null when max images reached', () => {
    const small = createAttachmentManager(2)
    small.add(TINY_PNG_BASE64, 'a.png')
    small.add(TINY_PNG_BASE64, 'b.png')
    const third = small.add(TINY_PNG_BASE64, 'c.png')
    expect(third).toBeNull()
    expect(small.count()).toBe(2)
  })

  it('should remove image by id', () => {
    const a = manager.add(TINY_PNG_BASE64, 'a.png')!
    manager.add(TINY_JPEG_BASE64, 'b.jpg')
    manager.remove(a.id)
    expect(manager.count()).toBe(1)
    expect(manager.getAll()[0].name).toBe('b.jpg')
  })

  it('should clear all images', () => {
    manager.add(TINY_PNG_BASE64, 'a.png')
    manager.add(TINY_JPEG_BASE64, 'b.jpg')
    manager.clear()
    expect(manager.count()).toBe(0)
    expect(manager.getAll()).toEqual([])
  })

  it('should return immutable list from getAll', () => {
    manager.add(TINY_PNG_BASE64, 'a.png')
    const list1 = manager.getAll()
    const list2 = manager.getAll()
    expect(list1).not.toBe(list2)
    expect(list1).toEqual(list2)
  })
})

// --- validateImage ---

describe('validateImage', () => {
  it('should accept valid PNG', () => {
    const result = validateImage(TINY_PNG_BASE64)
    expect(result.valid).toBe(true)
    expect(result.type).toBe('image/png')
    expect(result.size).toBeGreaterThan(0)
  })

  it('should accept valid JPEG', () => {
    const result = validateImage(TINY_JPEG_BASE64)
    expect(result.valid).toBe(true)
    expect(result.type).toBe('image/jpeg')
  })

  it('should accept valid GIF', () => {
    const result = validateImage(TINY_GIF_BASE64)
    expect(result.valid).toBe(true)
    expect(result.type).toBe('image/gif')
  })

  it('should accept valid WebP', () => {
    const result = validateImage(TINY_WEBP_BASE64)
    expect(result.valid).toBe(true)
    expect(result.type).toBe('image/webp')
  })

  it('should reject image exceeding 10MB', () => {
    const large = makeLargeDataUrl(11)
    const result = validateImage(large)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('too_large')
  })

  it('should reject unsupported type', () => {
    const bmp = 'data:image/bmp;base64,Qk0='
    const result = validateImage(bmp)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('unsupported_type')
  })

  it('should reject invalid data URL', () => {
    const result = validateImage('not-a-data-url')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('invalid_data')
  })
})

// --- extractImageFromClipboard ---

describe('extractImageFromClipboard', () => {
  function createClipboardEventWithImage(type: string, content: Uint8Array): ClipboardEvent {
    const file = new File([content], 'paste.png', { type })
    const dataTransfer = {
      items: [{ kind: 'file', type, getAsFile: () => file }],
    } as unknown as DataTransfer
    return { clipboardData: dataTransfer } as ClipboardEvent
  }

  function createClipboardEventWithText(): ClipboardEvent {
    const dataTransfer = {
      items: [{ kind: 'string', type: 'text/plain', getAsFile: () => null }],
    } as unknown as DataTransfer
    return { clipboardData: dataTransfer } as ClipboardEvent
  }

  function createEmptyClipboardEvent(): ClipboardEvent {
    return { clipboardData: null } as unknown as ClipboardEvent
  }

  it('should extract image from clipboard', async () => {
    // Mock FileReader as a class
    const mockReader = {
      readAsDataURL: vi.fn(),
      result: TINY_PNG_BASE64,
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
    }
    const OriginalFileReader = globalThis.FileReader
    globalThis.FileReader = function () {
      return mockReader
    } as unknown as typeof FileReader

    const event = createClipboardEventWithImage('image/png', new Uint8Array([1, 2, 3]))
    const promise = extractImageFromClipboard(event)

    // Trigger onload
    mockReader.onload?.()

    const result = await promise
    expect(result).toBe(TINY_PNG_BASE64)

    globalThis.FileReader = OriginalFileReader
  })

  it('should return null when no image in clipboard', async () => {
    const event = createClipboardEventWithText()
    const result = await extractImageFromClipboard(event)
    expect(result).toBeNull()
  })

  it('should return null for empty clipboard event', async () => {
    const event = createEmptyClipboardEvent()
    const result = await extractImageFromClipboard(event)
    expect(result).toBeNull()
  })
})

// --- captureScreenshot ---

describe('captureScreenshot', () => {
  beforeEach(() => {
    // Add captureVisibleTab mock
    ;(globalThis as Record<string, unknown>).chrome = {
      ...(globalThis as Record<string, unknown>).chrome as object,
      tabs: {
        ...((globalThis as Record<string, unknown>).chrome as Record<string, unknown>).tabs,
        captureVisibleTab: vi.fn(),
      },
    }
  })

  it('should capture screenshot using chrome API', async () => {
    const mockUrl = 'data:image/png;base64,captured'
    ;(chrome.tabs as Record<string, unknown>).captureVisibleTab = vi.fn(() =>
      Promise.resolve(mockUrl),
    )

    const result = await captureScreenshot()
    expect(result).toBe(mockUrl)
    expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledWith(
      { format: 'png', quality: 90 },
    )
  })

  it('should throw on capture error', async () => {
    ;(chrome.tabs as Record<string, unknown>).captureVisibleTab = vi.fn(() =>
      Promise.reject(new Error('Permission denied')),
    )

    await expect(captureScreenshot()).rejects.toThrow('스크린샷 캡처 실패')
  })
})

// --- resizeImage ---

describe('resizeImage', () => {
  let originalImage: typeof Image
  let originalCreateElement: typeof document.createElement

  beforeEach(() => {
    originalImage = globalThis.Image
    originalCreateElement = document.createElement.bind(document)
  })

  afterEach(() => {
    globalThis.Image = originalImage
    vi.restoreAllMocks()
  })

  // Mock canvas and context
  function setupCanvasMock(naturalWidth: number, naturalHeight: number) {
    const mockContext = {
      drawImage: vi.fn(),
    }
    const mockCanvas = {
      getContext: vi.fn(() => mockContext),
      toDataURL: vi.fn(() => 'data:image/png;base64,resized'),
      width: 0,
      height: 0,
    }
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement
      return originalCreateElement(tag)
    })

    // Mock Image constructor as a function constructor
    const mockImage = {
      width: naturalWidth,
      height: naturalHeight,
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      src: '',
    }
    globalThis.Image = function () {
      setTimeout(() => mockImage.onload?.(), 0)
      return mockImage
    } as unknown as typeof Image

    return { mockCanvas, mockContext, mockImage }
  }

  it('should resize large image maintaining aspect ratio', async () => {
    const { mockCanvas } = setupCanvasMock(2000, 1000)

    const result = await resizeImage(TINY_PNG_BASE64, 800, 600)

    expect(result).toBe('data:image/png;base64,resized')
    // 2000x1000 → scale to fit 800x600 → 800x400 (width-limited)
    expect(mockCanvas.width).toBe(800)
    expect(mockCanvas.height).toBe(400)
  })

  it('should not upscale small images', async () => {
    const { mockCanvas } = setupCanvasMock(200, 100)

    const result = await resizeImage(TINY_PNG_BASE64, 800, 600)

    expect(result).toBe('data:image/png;base64,resized')
    expect(mockCanvas.width).toBe(200)
    expect(mockCanvas.height).toBe(100)
  })
})
