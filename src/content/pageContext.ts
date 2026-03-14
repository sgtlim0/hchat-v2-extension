import { SK } from '../lib/storageKeys'
// Extracted from content/index.ts for testability
// Page context tracking: extractMainContent, detectPageType, updatePageContext

export function extractMainContent(): string {
  const candidates = [
    document.querySelector('article'),
    document.querySelector('[role="main"]'),
    document.querySelector('main'),
    document.querySelector('#content'),
    document.querySelector('.content'),
  ].filter(Boolean) as HTMLElement[]

  let best = document.body
  let bestLen = 0
  for (const el of candidates) {
    const len = el.innerText?.length ?? 0
    if (len > bestLen) { best = el; bestLen = len }
  }

  const text = best.innerText?.replace(/\n{3,}/g, '\n\n').trim() ?? ''
  if (text.length < 100) {
    return document.body.innerText.replace(/\n{3,}/g, '\n\n').trim().slice(0, 8000)
  }
  return text.slice(0, 8000)
}

export function detectPageType(url: string): string {
  if (/github\.com|gitlab\.com|bitbucket\.org/.test(url)) return 'code'
  if (/youtube\.com|youtu\.be|vimeo\.com/.test(url)) return 'video'
  if (/twitter\.com|x\.com|reddit\.com/.test(url)) return 'social'
  if (/docs\.|documentation|wiki|readme/i.test(url)) return 'docs'
  return 'unknown'
}

export function updatePageContext() {
  const ctx = {
    url: location.href,
    title: document.title,
    text: extractMainContent(),
    meta: { type: detectPageType(location.href) },
    ts: Date.now(),
  }
  chrome.storage.local.set({ [SK.PAGE_CONTEXT]: ctx })
}
