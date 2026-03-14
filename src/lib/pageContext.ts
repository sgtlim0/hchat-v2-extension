// lib/pageContext.ts — Page context tracking for sidebar chat

import { getGlobalLocale } from '../i18n'
import { SK } from './storageKeys'

export interface PageContext {
  url: string
  title: string
  text: string
  selection?: string
  meta?: {
    type?: 'article' | 'docs' | 'code' | 'video' | 'social' | 'unknown'
  }
  ts: number
}

const CONTEXT_KEY = SK.PAGE_CONTEXT
const CONTEXT_ENABLED_KEY = SK.PAGE_CONTEXT_ENABLED

export function detectPageType(url: string): PageContext['meta']['type'] {
  if (/github\.com|gitlab\.com|bitbucket\.org/.test(url)) return 'code'
  if (/youtube\.com|youtu\.be|vimeo\.com/.test(url)) return 'video'
  if (/twitter\.com|x\.com|reddit\.com|threads\.net/.test(url)) return 'social'
  if (/docs\.|documentation|wiki|readme/i.test(url)) return 'docs'
  return 'unknown'
}

export function buildPageSystemPrompt(ctx: PageContext): string {
  const isEn = getGlobalLocale() === 'en'

  if (isEn) {
    const lines = [
      'Current web page the user is viewing:',
      `- Title: ${ctx.title}`,
      `- URL: ${ctx.url}`,
    ]
    if (ctx.meta?.type && ctx.meta.type !== 'unknown') {
      lines.push(`- Type: ${ctx.meta.type}`)
    }
    if (ctx.selection) {
      lines.push(`- Selected text: "${ctx.selection.slice(0, 500)}"`)
    }
    lines.push('', 'Page content (excerpt):', ctx.text.slice(0, 3000))
    lines.push('', 'Use this page context to answer the user\'s questions.')
    return lines.join('\n')
  }

  const lines = [
    '현재 사용자가 보고 있는 웹페이지 정보:',
    `- 제목: ${ctx.title}`,
    `- URL: ${ctx.url}`,
  ]
  if (ctx.meta?.type && ctx.meta.type !== 'unknown') {
    lines.push(`- 유형: ${ctx.meta.type}`)
  }
  if (ctx.selection) {
    lines.push(`- 선택한 텍스트: "${ctx.selection.slice(0, 500)}"`)
  }
  lines.push('', `페이지 내용 (발췌):`, ctx.text.slice(0, 3000))
  lines.push('', '이 페이지 컨텍스트를 참고하여 사용자의 질문에 답변하세요.')
  return lines.join('\n')
}

export async function getPageContext(): Promise<PageContext | null> {
  const result = await chrome.storage.local.get(CONTEXT_KEY)
  return result[CONTEXT_KEY] ?? null
}

export async function isContextEnabled(): Promise<boolean> {
  const result = await chrome.storage.local.get(CONTEXT_ENABLED_KEY)
  return result[CONTEXT_ENABLED_KEY] ?? false
}

export async function setContextEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ [CONTEXT_ENABLED_KEY]: enabled })
}
