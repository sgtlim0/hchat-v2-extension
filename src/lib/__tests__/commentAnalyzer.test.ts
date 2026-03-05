import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../i18n', () => ({
  getGlobalLocale: vi.fn(() => 'ko'),
}))

import { extractComments, buildCommentAnalysisPrompt, type CommentData } from '../commentAnalyzer'
import { getGlobalLocale } from '../../i18n'

const mockedGetGlobalLocale = vi.mocked(getGlobalLocale)

function makeComment(overrides: Partial<CommentData> = {}): CommentData {
  return {
    text: '좋은 영상입니다',
    likes: 10,
    author: 'user1',
    ...overrides,
  }
}

describe('buildCommentAnalysisPrompt', () => {
  beforeEach(() => {
    mockedGetGlobalLocale.mockReturnValue('ko')
  })

  it('한국어 로케일에서 올바른 키워드 포함', () => {
    const comments = [makeComment()]
    const result = buildCommentAnalysisPrompt(comments, '테스트 영상')

    expect(result).toContain('댓글')
    expect(result).toContain('감정 분석')
    expect(result).toContain('주요 토픽')
  })

  it('영어 로케일에서 올바른 키워드 포함', () => {
    mockedGetGlobalLocale.mockReturnValue('en')
    const comments = [makeComment({ text: 'Great video', author: 'user1' })]
    const result = buildCommentAnalysisPrompt(comments, 'Test Video')

    expect(result).toContain('comments')
    expect(result).toContain('Sentiment Analysis')
    expect(result).toContain('Key Topics')
  })

  it('비디오 제목을 프롬프트에 포함', () => {
    const comments = [makeComment()]
    const result = buildCommentAnalysisPrompt(comments, '나의 테스트 영상')

    expect(result).toContain('나의 테스트 영상')
  })

  it('빈 댓글 배열 처리', () => {
    const result = buildCommentAnalysisPrompt([], '테스트 영상')

    expect(result).toBeDefined()
    expect(typeof result).toBe('string')
  })

  it('댓글이 100개를 초과하면 100개로 잘라냄', () => {
    const comments: CommentData[] = Array.from({ length: 150 }, (_, i) =>
      makeComment({ text: `댓글 ${i}`, author: `user${i}`, likes: i })
    )
    const result = buildCommentAnalysisPrompt(comments, '테스트 영상')

    // 101번째 이후 댓글 텍스트는 포함되지 않아야 함
    expect(result).toContain('댓글 0')
    expect(result).toContain('댓글 99')
    expect(result).not.toContain('댓글 100')
    expect(result).not.toContain('댓글 149')
  })

  it('댓글 텍스트와 좋아요 수를 포함', () => {
    const comments = [
      makeComment({ text: '정말 유용해요', likes: 42, author: 'viewer1' }),
    ]
    const result = buildCommentAnalysisPrompt(comments, '테스트')

    expect(result).toContain('정말 유용해요')
    expect(result).toContain('42')
  })
})

describe('extractComments', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    global.chrome = {
      tabs: {
        query: vi.fn(),
      },
      scripting: {
        executeScript: vi.fn(),
      },
    } as unknown as typeof chrome
  })

  it('스크립팅 결과에서 댓글을 반환', async () => {
    const mockComments: CommentData[] = [
      { text: '좋은 영상', likes: 5, author: 'user1' },
      { text: '감사합니다', likes: 3, author: 'user2' },
    ]

    vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 1 }] as chrome.tabs.Tab[])
    vi.mocked(chrome.scripting.executeScript).mockResolvedValue([
      { result: mockComments },
    ] as chrome.scripting.InjectionResult[])

    const result = await extractComments()

    expect(result).toEqual(mockComments)
    expect(chrome.tabs.query).toHaveBeenCalledWith(
      expect.objectContaining({ active: true, currentWindow: true })
    )
  })

  it('maxCount 파라미터를 전달', async () => {
    const mockComments: CommentData[] = [
      { text: '댓글1', likes: 1, author: 'a' },
      { text: '댓글2', likes: 2, author: 'b' },
    ]

    vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 1 }] as chrome.tabs.Tab[])
    vi.mocked(chrome.scripting.executeScript).mockResolvedValue([
      { result: mockComments },
    ] as chrome.scripting.InjectionResult[])

    const result = await extractComments(50)

    expect(result).toEqual(mockComments)
  })

  it('탭이 없으면 빈 배열 반환', async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValue([])

    const result = await extractComments()

    expect(result).toEqual([])
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled()
  })

  it('탭 ID가 undefined이면 빈 배열 반환', async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: undefined }] as chrome.tabs.Tab[])

    const result = await extractComments()

    expect(result).toEqual([])
  })

  it('스크립팅 결과가 없으면 빈 배열 반환', async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 1 }] as chrome.tabs.Tab[])
    vi.mocked(chrome.scripting.executeScript).mockResolvedValue([])

    const result = await extractComments()

    expect(result).toEqual([])
  })

  it('스크립팅 결과의 result가 null이면 빈 배열 반환', async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 1 }] as chrome.tabs.Tab[])
    vi.mocked(chrome.scripting.executeScript).mockResolvedValue([
      { result: null },
    ] as chrome.scripting.InjectionResult[])

    const result = await extractComments()

    expect(result).toEqual([])
  })
})
