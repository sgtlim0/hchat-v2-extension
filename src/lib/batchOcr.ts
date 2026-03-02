import { getGlobalLocale } from '../i18n'

export type OcrMode = 'general' | 'businessCard' | 'receipt' | 'screenshot'

export interface OcrResult {
  id: string
  fileName: string
  imageBase64: string    // thumbnail (data URL)
  text: string           // extracted text
  structured?: Record<string, unknown>  // JSON for businessCard/receipt
  mode: OcrMode
  status: 'pending' | 'processing' | 'done' | 'error'
  error?: string
}

// OCR prompt templates per mode (bilingual)
const OCR_PROMPTS: Record<OcrMode, { ko: string; en: string }> = {
  general: {
    ko: '이미지의 모든 텍스트를 정확히 추출해주세요. 원본 구조를 유지해주세요.',
    en: 'Extract all text from this image accurately. Preserve the original structure.',
  },
  businessCard: {
    ko: '명함 정보를 JSON으로 추출해주세요: {"name": "", "company": "", "title": "", "phone": "", "email": "", "address": ""}. 반드시 유효한 JSON만 반환하세요.',
    en: 'Extract business card info as JSON: {"name": "", "company": "", "title": "", "phone": "", "email": "", "address": ""}. Return only valid JSON.',
  },
  receipt: {
    ko: '영수증 정보를 JSON으로 추출해주세요: {"store": "", "date": "", "items": [{"name": "", "price": ""}], "total": ""}. 반드시 유효한 JSON만 반환하세요.',
    en: 'Extract receipt info as JSON: {"store": "", "date": "", "items": [{"name": "", "price": ""}], "total": ""}. Return only valid JSON.',
  },
  screenshot: {
    ko: '스크린샷의 UI 텍스트를 레이아웃 순서대로 추출해주세요.',
    en: 'Extract UI text from this screenshot in layout order.',
  },
}

export function getOcrPrompt(mode: OcrMode): string {
  const locale = getGlobalLocale()
  return OCR_PROMPTS[mode][locale === 'ko' ? 'ko' : 'en']
}

// Process images in batches of 3 (parallel within batch, sequential between batches)
export async function processBatchOcr(
  images: { id: string; fileName: string; base64: string }[],
  mode: OcrMode,
  visionFn: (imageBase64: string, prompt: string) => Promise<string>,
  onProgress: (result: OcrResult) => void,
): Promise<OcrResult[]> {
  const BATCH_SIZE = 3
  const prompt = getOcrPrompt(mode)
  const results: OcrResult[] = []

  for (let i = 0; i < images.length; i += BATCH_SIZE) {
    const batch = images.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.allSettled(
      batch.map(async (img) => {
        const result: OcrResult = {
          id: img.id,
          fileName: img.fileName,
          imageBase64: img.base64,
          text: '',
          mode,
          status: 'processing',
        }
        onProgress(result)

        try {
          const text = await visionFn(img.base64, prompt)

          // Try to parse structured data for specific modes
          let structured: Record<string, unknown> | undefined
          if (mode === 'businessCard' || mode === 'receipt') {
            try {
              const jsonMatch = text.match(/\{[\s\S]*\}/)
              if (jsonMatch) {
                structured = JSON.parse(jsonMatch[0])
              }
            } catch { /* ignore JSON parse errors */ }
          }

          return { ...result, text, structured, status: 'done' as const }
        } catch (err) {
          return { ...result, status: 'error' as const, error: String(err) }
        }
      })
    )

    for (let j = 0; j < batchResults.length; j++) {
      const r = batchResults[j]
      const ocrResult = r.status === 'fulfilled' ? r.value : {
        id: batch[j].id,
        fileName: batch[j].fileName,
        imageBase64: batch[j].base64,
        text: '',
        mode,
        status: 'error' as const,
        error: 'Processing failed',
      }
      results.push(ocrResult)
      onProgress(ocrResult)
    }
  }

  return results
}

// Export all results as text
export function exportOcrResults(results: OcrResult[], format: 'txt' | 'json'): string {
  const doneResults = results.filter(r => r.status === 'done')

  if (format === 'json') {
    return JSON.stringify(doneResults.map(r => ({
      fileName: r.fileName,
      mode: r.mode,
      text: r.text,
      structured: r.structured,
    })), null, 2)
  }

  return doneResults
    .map(r => `=== ${r.fileName} ===\n${r.text}`)
    .join('\n\n')
}
