// multimodalInput.ts — 멀티모달 이미지 입력 관리 (첨부, 검증, 클립보드, 스크린샷, 리사이즈)

export interface ImageAttachment {
  id: string
  dataUrl: string
  name: string
  size: number
  type: string
  addedAt: number
}

export interface AttachmentManager {
  add(dataUrl: string, name?: string): ImageAttachment | null
  remove(id: string): void
  clear(): void
  getAll(): ImageAttachment[]
  count(): number
}

export interface ImageValidation {
  valid: boolean
  error?: 'too_large' | 'unsupported_type' | 'invalid_data'
  size?: number
  type?: string
}

const SUPPORTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const
const MAX_SIZE_BYTES = 10 * 1024 * 1024
const DATA_URL_REGEX = /^data:(image\/[a-z+]+);base64,(.+)$/

function parseDataUrl(dataUrl: string): { type: string; data: string } | null {
  const match = DATA_URL_REGEX.exec(dataUrl)
  if (!match) return null
  return { type: match[1], data: match[2] }
}

function calculateBase64Size(base64: string): number {
  const padding = (base64.match(/=+$/) ?? ['']).length
  return Math.floor((base64.length * 3) / 4) - padding
}

function extractTypeFromDataUrl(dataUrl: string): string | null {
  const parsed = parseDataUrl(dataUrl)
  return parsed ? parsed.type : null
}

// --- Attachment Manager ---

export function createAttachmentManager(maxImages = 5): AttachmentManager {
  let attachments: ImageAttachment[] = []

  return {
    add(dataUrl: string, name?: string): ImageAttachment | null {
      if (attachments.length >= maxImages) return null

      const type = extractTypeFromDataUrl(dataUrl) ?? 'image/unknown'
      const parsed = parseDataUrl(dataUrl)
      const size = parsed ? calculateBase64Size(parsed.data) : 0

      const attachment: ImageAttachment = {
        id: crypto.randomUUID(),
        dataUrl,
        name: name ?? `image-${Date.now()}`,
        size,
        type,
        addedAt: Date.now(),
      }

      attachments = [...attachments, attachment]
      return attachment
    },

    remove(id: string): void {
      attachments = attachments.filter((a) => a.id !== id)
    },

    clear(): void {
      attachments = []
    },

    getAll(): ImageAttachment[] {
      return [...attachments]
    },

    count(): number {
      return attachments.length
    },
  }
}

// --- Image Validation ---

export function validateImage(dataUrl: string): ImageValidation {
  const parsed = parseDataUrl(dataUrl)

  if (!parsed) {
    return { valid: false, error: 'invalid_data' }
  }

  const { type, data } = parsed

  if (!SUPPORTED_TYPES.includes(type as (typeof SUPPORTED_TYPES)[number])) {
    return { valid: false, error: 'unsupported_type', type }
  }

  const size = calculateBase64Size(data)

  if (size > MAX_SIZE_BYTES) {
    return { valid: false, error: 'too_large', size, type }
  }

  return { valid: true, size, type }
}

// --- Clipboard Image Extraction ---

export function extractImageFromClipboard(event: ClipboardEvent): Promise<string | null> {
  const items = event.clipboardData?.items
  if (!items) return Promise.resolve(null)

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (!file) continue

      return new Promise<string | null>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('클립보드 이미지 읽기 실패'))
        reader.readAsDataURL(file)
      })
    }
  }

  return Promise.resolve(null)
}

// --- Screenshot Capture ---

export async function captureScreenshot(): Promise<string> {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(
      { format: 'png', quality: 90 } as chrome.tabs.CaptureVisibleTabOptions,
    )
    return dataUrl
  } catch (error) {
    throw new Error(
      `스크린샷 캡처 실패: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

// --- Image Resize ---

export function resizeImage(
  dataUrl: string,
  maxWidth: number,
  maxHeight: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onload = () => {
      const { width, height } = img

      if (width <= maxWidth && height <= maxHeight) {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas 컨텍스트 생성 실패'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/png'))
        return
      }

      const ratio = Math.min(maxWidth / width, maxHeight / height)
      const newWidth = Math.round(width * ratio)
      const newHeight = Math.round(height * ratio)

      const canvas = document.createElement('canvas')
      canvas.width = newWidth
      canvas.height = newHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas 컨텍스트 생성 실패'))
        return
      }
      ctx.drawImage(img, 0, 0, newWidth, newHeight)
      resolve(canvas.toDataURL('image/png'))
    }

    img.onerror = () => reject(new Error('이미지 로드 실패'))
    img.src = dataUrl
  })
}
