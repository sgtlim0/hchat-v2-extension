// lib/insightReport.ts — Unified YouTube insight report (transcript + comments)

import { getCurrentPageContent, getYouTubeTranscriptStructured, formatTimestamp, type TranscriptSegment } from './pageReader'
import { extractComments, buildCommentAnalysisPrompt, type CommentData } from './commentAnalyzer'
import type { AIProvider } from './providers/types'
import { Usage } from './usage'

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
  // Stage 1: Extract page info and transcript
  onProgress({ stage: '자막 추출 중...', percent: 10 })
  const page = await getCurrentPageContent()
  if (!page.isYouTube || !page.youtubeId) {
    throw new Error('YouTube 영상 탭에서 실행해주세요')
  }

  const segments = await getYouTubeTranscriptStructured(page.youtubeId)
  if (segments.length === 0) throw new Error('자막을 찾을 수 없습니다')

  onProgress({ stage: '자막 추출 완료', percent: 20 })

  // Build transcript text
  const transcriptText = segments
    .map((s) => `[${formatTimestamp(s.start)}] ${s.text}`)
    .join('\n')
    .slice(0, 8000)

  // Stage 2: Summary + timestamps
  onProgress({ stage: '요약 및 타임스탬프 생성 중...', percent: 30 })
  const summaryPrompt = `다음은 YouTube 영상 "${page.title}"의 자막입니다.

1. 핵심 내용을 5-7개 항목으로 구조적으로 요약해줘
2. 주요 구간별 타임스탬프를 [MM:SS] 형식으로 정리해줘 (최소 5개)
3. 핵심 결론을 2-3줄로 작성해줘

자막:
${transcriptText}`

  const summary = await streamToText(
    provider, model, summaryPrompt,
    '당신은 영상 분석 전문가입니다. 한국어로 답변하세요.',
    onChunk, signal,
  )

  onProgress({ stage: '요약 완료', percent: 50 })

  // Stage 3: Comment analysis
  onProgress({ stage: '댓글 분석 중...', percent: 55 })
  let commentAnalysis = ''
  let comments: CommentData[] = []

  try {
    comments = await extractComments(200)
    if (comments.length > 0) {
      const commentPrompt = buildCommentAnalysisPrompt(comments, page.title)
      commentAnalysis = await streamToText(
        provider, model, commentPrompt,
        '당신은 소셜미디어 분석 전문가입니다. 한국어로 답변하세요.',
        onChunk, signal,
      )
    } else {
      commentAnalysis = '댓글을 불러올 수 없습니다. 페이지를 스크롤하여 댓글을 로드한 후 다시 시도해주세요.'
    }
  } catch {
    commentAnalysis = '댓글 분석 중 오류가 발생했습니다.'
  }

  onProgress({ stage: '댓글 분석 완료', percent: 75 })

  // Stage 4: Cross-insights
  onProgress({ stage: '인사이트 도출 중...', percent: 80 })
  const insightPrompt = `영상 제목: ${page.title}

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
    '당신은 미디어 분석 전문가입니다. 영상 콘텐츠와 시청자 반응을 종합 분석합니다. 한국어로 답변하세요.',
    onChunk, signal,
  )

  onProgress({ stage: '인사이트 완료', percent: 95 })

  // Stage 5: Compile Markdown
  const fullMarkdown = `# ${page.title}

> URL: ${page.url}
> 생성일: ${new Date().toLocaleDateString('ko-KR')}
> 분석 모델: ${model}

---

## 영상 요약

${summary}

---

## 댓글 분석 (${comments.length}개)

${commentAnalysis}

---

## 종합 인사이트

${insights}

---

*H Chat v3.0 통합 인사이트 리포트*
`

  onProgress({ stage: '리포트 완료!', percent: 100 })

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
