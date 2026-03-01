/** AI-powered conversation summarization */

import { streamChatLive, MODELS, type Message } from './models'
import type { AwsCredentials } from '../hooks/useConfig'
import type { Conversation } from './chatHistory'

export interface Summary {
  convId: string
  text: string
  createdAt: number
  messageCount: number
}

const STORAGE_KEY = 'hchat:summaries'

/** Generate a summary for a conversation using the cheapest available model */
export async function generateSummary(
  conv: Conversation,
  aws: AwsCredentials,
  model?: string,
): Promise<string> {
  if (!aws.accessKeyId || !aws.secretAccessKey) {
    throw new Error('AWS 자격증명이 설정되지 않았습니다')
  }

  // Default to cheapest model (Haiku) for summarization
  const targetModel = model ?? 'us.anthropic.claude-haiku-4-5-20251001-v1:0'

  // Build conversation text (limit to recent messages to avoid token overflow)
  const recentMsgs = conv.messages.slice(-30)
  const convText = recentMsgs
    .map((m) => `[${m.role === 'user' ? '사용자' : 'AI'}]: ${m.content.slice(0, 500)}`)
    .join('\n\n')

  const messages: Message[] = [{
    role: 'user',
    content: `다음 대화를 3~5줄로 요약해주세요. 핵심 주제, 결론, 중요 정보를 포함해주세요. 한국어로 작성하세요.\n\n${convText}`,
  }]

  let result = ''
  await streamChatLive({
    aws,
    model: targetModel,
    messages,
    systemPrompt: '당신은 대화 요약 전문가입니다. 간결하고 정확하게 요약해주세요.',
    maxTokens: 512,
    onChunk: (chunk) => { result += chunk },
  })

  return result.trim()
}

/** Save a summary */
export async function saveSummary(summary: Summary): Promise<void> {
  const all = await loadAllSummaries()
  all[summary.convId] = summary
  await chrome.storage.local.set({ [STORAGE_KEY]: all })
}

/** Load summary for a conversation */
export async function loadSummary(convId: string): Promise<Summary | null> {
  const all = await loadAllSummaries()
  return all[convId] ?? null
}

/** Load all summaries */
async function loadAllSummaries(): Promise<Record<string, Summary>> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  return result[STORAGE_KEY] ?? {}
}

/** Delete summary for a conversation */
export async function deleteSummary(convId: string): Promise<void> {
  const all = await loadAllSummaries()
  delete all[convId]
  await chrome.storage.local.set({ [STORAGE_KEY]: all })
}
