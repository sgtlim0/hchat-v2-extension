// lib/imageGenerator.ts — DALL-E 3 image generation (direct fetch, no SDK)

export type ImageSize = '1024x1024' | '1792x1024' | '1024x1792'
export type ImageQuality = 'standard' | 'hd'
export type ImageStyle = 'vivid' | 'natural'

export interface ImageGenResult {
  url: string
  revisedPrompt: string
  size: ImageSize
  quality: ImageQuality
}

export interface ImageGenOptions {
  prompt: string
  size?: ImageSize
  quality?: ImageQuality
  style?: ImageStyle
}

const COST_TABLE: Record<ImageQuality, Record<ImageSize, number>> = {
  standard: {
    '1024x1024': 0.040,
    '1792x1024': 0.080,
    '1024x1792': 0.080,
  },
  hd: {
    '1024x1024': 0.080,
    '1792x1024': 0.120,
    '1024x1792': 0.120,
  },
}

export function estimateImageCost(quality: ImageQuality, size: ImageSize): number {
  return COST_TABLE[quality][size]
}

export async function generateImage(
  options: ImageGenOptions,
  apiKey: string,
): Promise<ImageGenResult> {
  const size = options.size ?? '1024x1024'
  const quality = options.quality ?? 'standard'
  const style = options.style ?? 'vivid'

  if (!apiKey) {
    throw new Error('OpenAI API key is required')
  }

  if (!options.prompt.trim()) {
    throw new Error('Prompt is required')
  }

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: options.prompt,
      n: 1,
      size,
      quality,
      style,
      response_format: 'url',
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    let errMsg = `HTTP ${res.status}`
    try {
      const errJson = JSON.parse(errText)
      errMsg = errJson.error?.message ?? errMsg
    } catch {
      errMsg = errText || errMsg
    }
    throw new Error(errMsg)
  }

  const json = await res.json()
  const data = json.data?.[0]

  if (!data?.url) {
    throw new Error('No image data in response')
  }

  return {
    url: data.url,
    revisedPrompt: data.revised_prompt ?? options.prompt,
    size,
    quality,
  }
}

export async function downloadImageAsBlob(url: string): Promise<Blob> {
  const res = await fetch(url)

  if (!res.ok) {
    throw new Error(`Failed to download image: HTTP ${res.status}`)
  }

  return res.blob()
}
