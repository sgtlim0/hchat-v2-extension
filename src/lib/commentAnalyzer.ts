// lib/commentAnalyzer.ts — YouTube comment extraction and analysis

import { getGlobalLocale } from '../i18n'

export interface CommentData {
  text: string
  likes: number
  author: string
}

export interface CommentAnalysis {
  totalComments: number
  sentiments: { positive: number; neutral: number; negative: number }
  topTopics: string[]
  insights: string[]
  topComments: CommentData[]
}

/**
 * Extract comments from YouTube page DOM via executeScript
 */
export async function extractComments(maxCount = 200): Promise<CommentData[]> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return []

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (max: number) => {
      const commentEls = document.querySelectorAll('#content-text')
      const comments: { text: string; likes: number; author: string }[] = []

      for (let i = 0; i < Math.min(commentEls.length, max); i++) {
        const el = commentEls[i] as HTMLElement
        const text = el.innerText?.trim()
        if (!text) continue

        // Try to get likes and author from sibling/parent elements
        const container = el.closest('ytd-comment-renderer')
        const likeEl = container?.querySelector('#vote-count-middle')
        const authorEl = container?.querySelector('#author-text')

        const likesText = (likeEl as HTMLElement)?.innerText?.trim() ?? '0'
        const likes = parseInt(likesText.replace(/[^0-9]/g, '')) || 0
        const author = (authorEl as HTMLElement)?.innerText?.trim() ?? '익명'

        comments.push({ text: text.slice(0, 500), likes, author })
      }

      return comments
    },
    args: [maxCount],
  })

  return results?.[0]?.result ?? []
}

/**
 * Build prompt for AI comment analysis
 */
export function buildCommentAnalysisPrompt(comments: CommentData[], videoTitle: string): string {
  const isEn = getGlobalLocale() === 'en'
  const likesLabel = isEn ? 'likes' : '좋아요'

  const commentTexts = comments
    .slice(0, 100)
    .map((c, i) => `[${i + 1}] (${likesLabel}: ${c.likes}) ${c.text}`)
    .join('\n')

  if (isEn) {
    return `The following are ${comments.length} comments from the YouTube video "${videoTitle}".

Analyze the comments and write results in the following structure:

## Sentiment Analysis
- Positive: X%
- Neutral: X%
- Negative: X%

## Key Topics (up to 5)
- Topic 1: Description
- Topic 2: Description

## Key Insights (3-5)
Points of particular viewer interest, common opinions, points of debate, etc.

## Top 5 Popular Comments
Most liked comments and their significance

---
Comment data:
${commentTexts}`
  }

  return `다음은 YouTube 영상 "${videoTitle}"의 댓글 ${comments.length}개입니다.

댓글을 분석하여 다음 구조로 결과를 작성해줘:

## 감정 분석
- 긍정적: X%
- 중립: X%
- 부정적: X%

## 주요 토픽 (최대 5개)
- 토픽1: 설명
- 토픽2: 설명

## 핵심 인사이트 (3-5개)
시청자들이 특히 관심을 보이는 점, 공통적인 의견, 논쟁 지점 등

## 인기 댓글 TOP 5
가장 좋아요가 많은 댓글과 그 의미

---
댓글 데이터:
${commentTexts}`
}
