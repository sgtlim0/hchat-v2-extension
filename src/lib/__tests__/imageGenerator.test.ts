import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateImage,
  downloadImageAsBlob,
  estimateImageCost,
  type ImageQuality,
  type ImageSize,
} from '../imageGenerator'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('estimateImageCost', () => {
  const cases: [ImageQuality, ImageSize, number][] = [
    ['standard', '1024x1024', 0.040],
    ['standard', '1792x1024', 0.080],
    ['standard', '1024x1792', 0.080],
    ['hd', '1024x1024', 0.080],
    ['hd', '1792x1024', 0.120],
    ['hd', '1024x1792', 0.120],
  ]

  it.each(cases)('returns %s %s = $%s', (quality, size, expected) => {
    expect(estimateImageCost(quality, size)).toBe(expected)
  })
})

describe('generateImage', () => {
  it('calls OpenAI API and returns parsed result', async () => {
    const mockResponse = {
      data: [{
        url: 'https://example.com/image.png',
        revised_prompt: 'A beautiful sunset over mountains',
      }],
    }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    }))

    const result = await generateImage({ prompt: 'sunset mountains' }, 'sk-test')

    expect(result).toEqual({
      url: 'https://example.com/image.png',
      revisedPrompt: 'A beautiful sunset over mountains',
      size: '1024x1024',
      quality: 'standard',
    })

    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/images/generations',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sk-test',
        },
      }),
    )

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.model).toBe('dall-e-3')
    expect(body.prompt).toBe('sunset mountains')
    expect(body.n).toBe(1)
    expect(body.size).toBe('1024x1024')
    expect(body.quality).toBe('standard')
    expect(body.style).toBe('vivid')
    expect(body.response_format).toBe('url')
  })

  it('uses custom options when provided', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ url: 'https://example.com/img.png', revised_prompt: 'test' }] }),
    }))

    const result = await generateImage(
      { prompt: 'test', size: '1792x1024', quality: 'hd', style: 'natural' },
      'sk-test',
    )

    expect(result.size).toBe('1792x1024')
    expect(result.quality).toBe('hd')

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.size).toBe('1792x1024')
    expect(body.quality).toBe('hd')
    expect(body.style).toBe('natural')
  })

  it('throws on empty API key', async () => {
    await expect(generateImage({ prompt: 'test' }, '')).rejects.toThrow('OpenAI API key is required')
  })

  it('throws on empty prompt', async () => {
    await expect(generateImage({ prompt: '  ' }, 'sk-test')).rejects.toThrow('Prompt is required')
  })

  it('throws on 401 Unauthorized', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve(JSON.stringify({ error: { message: 'Incorrect API key provided' } })),
    }))

    await expect(generateImage({ prompt: 'test' }, 'sk-bad')).rejects.toThrow('Incorrect API key provided')
  })

  it('throws on 429 Rate Limit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve(JSON.stringify({ error: { message: 'Rate limit exceeded' } })),
    }))

    await expect(generateImage({ prompt: 'test' }, 'sk-test')).rejects.toThrow('Rate limit exceeded')
  })

  it('throws on 500 Server Error with plain text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    }))

    await expect(generateImage({ prompt: 'test' }, 'sk-test')).rejects.toThrow('Internal Server Error')
  })

  it('throws on empty response data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    }))

    await expect(generateImage({ prompt: 'test' }, 'sk-test')).rejects.toThrow('No image data in response')
  })

  it('falls back to original prompt when revised_prompt is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ url: 'https://example.com/img.png' }] }),
    }))

    const result = await generateImage({ prompt: 'my prompt' }, 'sk-test')
    expect(result.revisedPrompt).toBe('my prompt')
  })

  it('handles HTTP error with empty text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve(''),
    }))

    await expect(generateImage({ prompt: 'test' }, 'sk-test')).rejects.toThrow('HTTP 503')
  })
})

describe('downloadImageAsBlob', () => {
  it('fetches URL and returns blob', async () => {
    const mockBlob = new Blob(['image data'], { type: 'image/png' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    }))

    const blob = await downloadImageAsBlob('https://example.com/image.png')
    expect(blob).toBe(mockBlob)
    expect(fetch).toHaveBeenCalledWith('https://example.com/image.png')
  })

  it('throws on failed download', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }))

    await expect(downloadImageAsBlob('https://example.com/gone.png')).rejects.toThrow('Failed to download image: HTTP 404')
  })
})
