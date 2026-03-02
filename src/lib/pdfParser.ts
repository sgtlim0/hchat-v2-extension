// lib/pdfParser.ts — PDF text extraction using pdf.js worker-less approach

const MAX_CHARS = 50000

/**
 * Extract text from a PDF File object.
 * Uses pdf.js from CDN to avoid bundling the large worker.
 */
export async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const uint8Array = new Uint8Array(arrayBuffer)

  // Load pdf.js from CDN if not available
  const pdfjsLib = await loadPdfJs()
  if (!pdfjsLib) {
    return extractPdfTextFallback(uint8Array)
  }

  try {
    const doc = await pdfjsLib.getDocument({ data: uint8Array }).promise
    const pages: string[] = []
    let totalChars = 0

    for (let i = 1; i <= doc.numPages && totalChars < MAX_CHARS; i++) {
      const page = await doc.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item: { str?: string }) => item.str ?? '')
        .join(' ')
        .trim()

      if (pageText) {
        pages.push(`[페이지 ${i}]\n${pageText}`)
        totalChars += pageText.length
      }
    }

    const result = pages.join('\n\n')
    if (result.length > MAX_CHARS) {
      return result.slice(0, MAX_CHARS) + `\n\n...(${result.length - MAX_CHARS}자 생략, 총 ${doc.numPages}페이지)`
    }
    return result
  } catch (err) {
    throw new Error(`PDF 파싱 실패: ${String(err)}`)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pdfjsLib: any = null

async function loadPdfJs() {
  if (_pdfjsLib) return _pdfjsLib

  try {
    // Check if already loaded globally
    if ((globalThis as Record<string, unknown>).pdfjsLib) {
      _pdfjsLib = (globalThis as Record<string, unknown>).pdfjsLib
      return _pdfjsLib
    }

    // Dynamic import from CDN
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs'
    script.type = 'module'

    await new Promise<void>((resolve, reject) => {
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('pdf.js 로드 실패'))
      document.head.appendChild(script)
    })

    _pdfjsLib = (globalThis as Record<string, unknown>).pdfjsLib
    if (_pdfjsLib) {
      _pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs'
    }
    return _pdfjsLib
  } catch {
    return null
  }
}

/**
 * Simple fallback: extract raw text from PDF binary without pdf.js
 * Only works for PDFs with uncompressed text streams
 */
function extractPdfTextFallback(data: Uint8Array): string {
  const text = new TextDecoder('latin1').decode(data)
  const texts: string[] = []

  // Extract text from BT...ET blocks (basic PDF text extraction)
  const regex = /\(([^)]*)\)/g
  let match

  while ((match = regex.exec(text)) !== null) {
    const decoded = match[1]
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\')
    if (decoded.length > 2 && /[a-zA-Z가-힣]/.test(decoded)) {
      texts.push(decoded)
    }
  }

  const result = texts.join(' ').slice(0, MAX_CHARS)
  if (!result) {
    throw new Error('PDF에서 텍스트를 추출할 수 없습니다. 스캔된 PDF는 지원하지 않습니다.')
  }
  return result
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}
