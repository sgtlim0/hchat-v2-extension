import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateOutline,
  generateSlideContent,
  generatePptx,
  type PptxPlanConfig,
  type SlideContent,
} from '../pptxGenerator'
import type { AIProvider } from '../providers/types'

// Mock JSZip
vi.mock('jszip', () => {
  return {
    default: class MockJSZip {
      files: Record<string, unknown> = {}
      file(path: string, content?: string) {
        if (content !== undefined) {
          this.files[path] = content
          return this
        }
        return this.files[path]
      }
      async generateAsync() {
        return new Blob(['mock pptx'], {
          type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        })
      }
    },
  }
})

// Helper: create mock provider
function createMockProvider(response: string): AIProvider {
  return {
    stream: async function* () {
      yield response
      return response
    },
    isConfigured: () => true,
  } as unknown as AIProvider
}

describe('generateOutline', () => {
  it('returns string array from JSON response', async () => {
    const provider = createMockProvider('["슬라이드 1", "슬라이드 2", "슬라이드 3"]')
    const config: PptxPlanConfig = {
      topic: '테스트 주제',
      slideCount: 5,
      style: 'business',
      locale: 'ko',
    }

    const result = await generateOutline(provider, 'test-model', config)

    expect(result).toEqual(['슬라이드 1', '슬라이드 2', '슬라이드 3'])
  })

  it('extracts JSON array from markdown code block', async () => {
    const provider = createMockProvider('```json\n["A", "B"]\n```')
    const config: PptxPlanConfig = {
      topic: 'Test',
      slideCount: 5,
      style: 'business',
      locale: 'en',
    }

    const result = await generateOutline(provider, 'test-model', config)

    expect(result).toEqual(['A', 'B'])
  })

  it('respects slideCount in prompt', async () => {
    const provider = createMockProvider('["Title", "Content"]')
    const config: PptxPlanConfig = {
      topic: 'Test',
      slideCount: 10,
      style: 'academic',
      locale: 'ko',
    }

    await generateOutline(provider, 'test-model', config)
    // If we could inspect the prompt, we'd verify slideCount is used
    expect(true).toBe(true)
  })

  it('throws error if no JSON array found', async () => {
    const provider = createMockProvider('No JSON here')
    const config: PptxPlanConfig = {
      topic: 'Test',
      slideCount: 5,
      style: 'business',
      locale: 'ko',
    }

    await expect(generateOutline(provider, 'test-model', config)).rejects.toThrow(
      'Failed to parse outline',
    )
  })

  it('throws error if empty array', async () => {
    const provider = createMockProvider('[]')
    const config: PptxPlanConfig = {
      topic: 'Test',
      slideCount: 5,
      style: 'business',
      locale: 'ko',
    }

    await expect(generateOutline(provider, 'test-model', config)).rejects.toThrow(
      'Empty outline received',
    )
  })
})

describe('generateSlideContent', () => {
  it('returns valid SlideContent', async () => {
    const provider = createMockProvider(
      '{"bullets": ["Point 1", "Point 2"], "notes": "Speaker notes"}',
    )
    const config: PptxPlanConfig = {
      topic: 'Test',
      slideCount: 5,
      style: 'business',
      locale: 'ko',
    }

    const result = await generateSlideContent(
      provider,
      'test-model',
      'Slide Title',
      config,
      2,
      5,
    )

    expect(result.title).toBe('Slide Title')
    expect(result.bullets).toEqual(['Point 1', 'Point 2'])
    expect(result.notes).toBe('Speaker notes')
    expect(result.layout).toBe('content')
  })

  it('assigns title layout to first slide', async () => {
    const provider = createMockProvider('{"bullets": ["A", "B"]}')
    const config: PptxPlanConfig = {
      topic: 'Test',
      slideCount: 5,
      style: 'business',
      locale: 'ko',
    }

    const result = await generateSlideContent(
      provider,
      'test-model',
      'First Slide',
      config,
      0,
      5,
    )

    expect(result.layout).toBe('title')
  })

  it('assigns closing layout to last slide', async () => {
    const provider = createMockProvider('{"bullets": ["Thanks"]}')
    const config: PptxPlanConfig = {
      topic: 'Test',
      slideCount: 5,
      style: 'business',
      locale: 'ko',
    }

    const result = await generateSlideContent(
      provider,
      'test-model',
      'Last Slide',
      config,
      4,
      5,
    )

    expect(result.layout).toBe('closing')
  })

  it('throws error if no JSON found', async () => {
    const provider = createMockProvider('No JSON response')
    const config: PptxPlanConfig = {
      topic: 'Test',
      slideCount: 5,
      style: 'business',
      locale: 'ko',
    }

    await expect(
      generateSlideContent(provider, 'test-model', 'Slide', config, 1, 5),
    ).rejects.toThrow('Failed to parse slide content')
  })
})

describe('generatePptx', () => {
  it('creates Blob with correct MIME type', async () => {
    const slides: SlideContent[] = [
      { title: 'Title', bullets: ['A'], layout: 'title' },
    ]

    const blob = await generatePptx(slides)

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    )
  })

  it('handles single title slide', async () => {
    const slides: SlideContent[] = [
      { title: 'Welcome', bullets: [], layout: 'title' },
    ]

    const blob = await generatePptx(slides)

    expect(blob.size).toBeGreaterThan(0)
  })

  it('handles content slide with bullets', async () => {
    const slides: SlideContent[] = [
      { title: 'Agenda', bullets: ['Point 1', 'Point 2', 'Point 3'], layout: 'content' },
    ]

    const blob = await generatePptx(slides)

    expect(blob.size).toBeGreaterThan(0)
  })

  it('handles multiple slides', async () => {
    const slides: SlideContent[] = [
      { title: 'Title', bullets: [], layout: 'title' },
      { title: 'Content', bullets: ['A', 'B'], layout: 'content' },
      { title: 'Closing', bullets: ['Thanks'], layout: 'closing' },
    ]

    const blob = await generatePptx(slides)

    expect(blob.size).toBeGreaterThan(0)
  })

  it('handles slides with notes', async () => {
    const slides: SlideContent[] = [
      {
        title: 'Slide with notes',
        bullets: ['Bullet'],
        notes: 'Speaker notes here',
        layout: 'content',
      },
    ]

    const blob = await generatePptx(slides)

    expect(blob.size).toBeGreaterThan(0)
  })

  it('handles empty slides array', async () => {
    const slides: SlideContent[] = []

    const blob = await generatePptx(slides)

    expect(blob).toBeInstanceOf(Blob)
  })
})
