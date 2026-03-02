// lib/insightReport.ts — Unified YouTube insight report (transcript + comments)

import { getCurrentPageContent, getYouTubeTranscriptStructured, formatTimestamp } from './pageReader'
import { extractComments, buildCommentAnalysisPrompt, type CommentData } from './commentAnalyzer'
import type { AIProvider } from './providers/types'
import { Usage } from './usage'
import { getGlobalLocale } from '../i18n'

export interface ReportProgress {
  stage: string
  percent: number
}

export interface InsightReport {
  title: string
  url: string
  summary: string
  timestamps: string
  commentAnalysis: string
  insights: string
  fullMarkdown: string
}

async function streamToText(
  provider: AIProvider,
  model: string,
  prompt: string,
  systemPrompt: string,
  onChunk?: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  let text = ''
  const gen = provider.stream({ model, messages: [{ role: 'user', content: prompt }], systemPrompt, signal })
  for await (const chunk of gen) {
    text += chunk
    onChunk?.(chunk)
  }
  Usage.track(model, provider.type, prompt, text, 'report').catch(() => {})
  return text
}

export async function generateInsightReport(
  provider: AIProvider,
  model: string,
  onProgress: (p: ReportProgress) => void,
  onChunk?: (text: string) => void,
  signal?: AbortSignal,
): Promise<InsightReport> {
  const isEn = getGlobalLocale() === 'en'

  // Stage 1: Extract page info and transcript
  onProgress({ stage: isEn ? 'Extracting transcript...' : '자막 추출 중...', percent: 10 })
  const page = await getCurrentPageContent()
  if (!page.isYouTube || !page.youtubeId) {
    throw new Error(isEn ? 'Please run on a YouTube video tab' : 'YouTube 영상 탭에서 실행해주세요')
  }

  const segments = await getYouTubeTranscriptStructured(page.youtubeId)
  if (segments.length === 0) throw new Error(isEn ? 'No subtitles found' : '자막을 찾을 수 없습니다')

  onProgress({ stage: isEn ? 'Transcript extracted' : '자막 추출 완료', percent: 20 })

  // Build transcript text
  const transcriptText = segments
    .map((s) => `[${formatTimestamp(s.start)}] ${s.text}`)
    .join('\n')
    .slice(0, 8000)

  // Stage 2: Summary + timestamps
  onProgress({ stage: isEn ? 'Generating summary & timestamps...' : '요약 및 타임스탬프 생성 중...', percent: 30 })
  const summaryPrompt = isEn
    ? `The following is the transcript of the YouTube video "${page.title}".

1. Summarize the key content in 5-7 structured bullet points
2. List key timestamps in [MM:SS] format (at least 5)
3. Write a key conclusion in 2-3 lines

Transcript:
${transcriptText}`
    : `다음은 YouTube 영상 "${page.title}"의 자막입니다.

1. 핵심 내용을 5-7개 항목으로 구조적으로 요약해줘
2. 주요 구간별 타임스탬프를 [MM:SS] 형식으로 정리해줘 (최소 5개)
3. 핵심 결론을 2-3줄로 작성해줘

자막:
${transcriptText}`

  const summary = await streamToText(
    provider, model, summaryPrompt,
    isEn ? 'You are a video analysis expert. Please respond in English.' : '당신은 영상 분석 전문가입니다. 한국어로 답변하세요.',
    onChunk, signal,
  )

  onProgress({ stage: isEn ? 'Summary complete' : '요약 완료', percent: 50 })

  // Stage 3: Comment analysis
  onProgress({ stage: isEn ? 'Analyzing comments...' : '댓글 분석 중...', percent: 55 })
  let commentAnalysis = ''
  let comments: CommentData[] = []

  try {
    comments = await extractComments(200)
    if (comments.length > 0) {
      const commentPrompt = buildCommentAnalysisPrompt(comments, page.title)
      commentAnalysis = await streamToText(
        provider, model, commentPrompt,
        isEn ? 'You are a social media analysis expert. Please respond in English.' : '당신은 소셜미디어 분석 전문가입니다. 한국어로 답변하세요.',
        onChunk, signal,
      )
    } else {
      commentAnalysis = isEn
        ? 'Could not load comments. Please scroll the page to load comments and try again.'
        : '댓글을 불러올 수 없습니다. 페이지를 스크롤하여 댓글을 로드한 후 다시 시도해주세요.'
    }
  } catch {
    commentAnalysis = isEn ? 'An error occurred during comment analysis.' : '댓글 분석 중 오류가 발생했습니다.'
  }

  onProgress({ stage: isEn ? 'Comment analysis complete' : '댓글 분석 완료', percent: 75 })

  // Stage 4: Cross-insights
  onProgress({ stage: isEn ? 'Deriving insights...' : '인사이트 도출 중...', percent: 80 })
  const insightPrompt = isEn
    ? `Video title: ${page.title}

## Video Summary
${summary}

## Comment Analysis
${commentAnalysis}

Based on the video content and viewer reactions above, summarize:
1. Differences between video content and viewer reactions
2. Points that viewers were particularly interested in
3. Topics that need further investigation
4. Overall evaluation and implications`
    : `영상 제목: ${page.title}

## 영상 요약
${summary}

## 댓글 분석
${commentAnalysis}

위 영상 내용과 시청자 반응을 종합하여:
1. 영상 내용 vs 시청자 반응의 차이점
2. 시청자가 특히 관심을 보인 포인트
3. 추가 조사가 필요한 주제
4. 전체적인 평가와 시사점

을 정리해줘.`

  const insights = await streamToText(
    provider, model, insightPrompt,
    isEn ? 'You are a media analysis expert. You comprehensively analyze video content and viewer reactions. Please respond in English.' : '당신은 미디어 분석 전문가입니다. 영상 콘텐츠와 시청자 반응을 종합 분석합니다. 한국어로 답변하세요.',
    onChunk, signal,
  )

  onProgress({ stage: isEn ? 'Insights complete' : '인사이트 완료', percent: 95 })

  // Stage 5: Compile Markdown
  const dateStr = new Date().toLocaleDateString(isEn ? 'en-US' : 'ko-KR')
  const commentCountLabel = isEn ? `${comments.length} comments` : `${comments.length}개`
  const fullMarkdown = isEn
    ? `# ${page.title}

> URL: ${page.url}
> Generated: ${dateStr}
> Model: ${model}

---

## Video Summary

${summary}

---

## Comment Analysis (${commentCountLabel})

${commentAnalysis}

---

## Comprehensive Insights

${insights}

---

*H Chat v3.0 Insight Report*
`
    : `# ${page.title}

> URL: ${page.url}
> 생성일: ${dateStr}
> 분석 모델: ${model}

---

## 영상 요약

${summary}

---

## 댓글 분석 (${commentCountLabel})

${commentAnalysis}

---

## 종합 인사이트

${insights}

---

*H Chat v3.0 통합 인사이트 리포트*
`

  onProgress({ stage: isEn ? 'Report complete!' : '리포트 완료!', percent: 100 })

  return {
    title: page.title,
    url: page.url,
    summary,
    timestamps: summary, // Timestamps are included in summary
    commentAnalysis,
    insights,
    fullMarkdown,
  }
}
