// content/search-injector.ts — Inject AI summary card into search engine results

import { getLocale, tSync, type Locale } from '../i18n'
import { SK } from '../lib/storageKeys'

const SEARCH_CONFIGS: Record<string, { querySelector: string; insertBefore: string; queryParam: string }> = {
  'www.google.com': { querySelector: '#search', insertBefore: '#search', queryParam: 'q' },
  'www.google.co.kr': { querySelector: '#search', insertBefore: '#search', queryParam: 'q' },
  'www.bing.com': { querySelector: '#b_results', insertBefore: '#b_results', queryParam: 'q' },
  'search.naver.com': { querySelector: '#main_pack', insertBefore: '#main_pack', queryParam: 'query' },
}

function getSearchQuery(): string | null {
  const config = SEARCH_CONFIGS[window.location.hostname]
  if (!config) return null
  const params = new URLSearchParams(window.location.search)
  return params.get(config.queryParam)
}

function createShadowContainer(): { host: HTMLElement; root: ShadowRoot } {
  const host = document.createElement('div')
  host.id = 'hchat-search-card'
  host.style.cssText = 'margin: 0 0 16px 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif;'
  const root = host.attachShadow({ mode: 'closed' })
  return { host, root }
}

function buildCardHTML(query: string, locale: Locale): string {
  return `
    <style>
      .hchat-card {
        border: 1px solid #e0e0e0;
        border-radius: 12px;
        padding: 16px;
        background: #fff;
        box-shadow: 0 1px 4px rgba(0,0,0,0.08);
        font-size: 14px;
        line-height: 1.6;
        color: #333;
        position: relative;
      }
      @media (prefers-color-scheme: dark) {
        .hchat-card {
          background: #1e1e2e;
          border-color: #333;
          color: #e0e0e0;
        }
        .hchat-header { color: #aaa !important; }
        .hchat-answer { color: #ddd !important; }
      }
      .hchat-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font-size: 12px;
        color: #666;
      }
      .hchat-logo {
        width: 20px; height: 20px;
        background: linear-gradient(135deg, #34d399, #10b981);
        border-radius: 5px;
        display: flex; align-items: center; justify-content: center;
        font-weight: 700; font-size: 11px; color: #fff;
      }
      .hchat-answer { white-space: pre-wrap; }
      .hchat-cursor { animation: blink 0.7s infinite; }
      @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
      .hchat-close {
        position: absolute; top: 8px; right: 8px;
        background: none; border: none; cursor: pointer;
        font-size: 16px; color: #999; padding: 4px;
      }
      .hchat-close:hover { color: #666; }
    </style>
    <div class="hchat-card">
      <button class="hchat-close" id="hchat-close">✕</button>
      <div class="hchat-header">
        <div class="hchat-logo">H</div>
        <span>${tSync(locale, 'searchInjector.aiSummary')}</span>
        <span id="hchat-model" style="margin-left:auto;font-size:11px;opacity:0.6"></span>
      </div>
      <div class="hchat-answer" id="hchat-answer">
        <span class="hchat-cursor">▌</span>
      </div>
    </div>
  `
}

function injectCard() {
  const query = getSearchQuery()
  if (!query) return

  const config = SEARCH_CONFIGS[window.location.hostname]
  if (!config) return

  const target = document.querySelector(config.insertBefore)
  if (!target) return

  // Don't inject twice
  if (document.getElementById('hchat-search-card')) return

  // Check if feature enabled via storage
  chrome.storage.local.get(SK.CONFIG, async (result) => {
    const cfg = result[SK.CONFIG]
    if (cfg && cfg.enableSearchEnhance === false) return

    const locale = await getLocale()

    const { host, root } = createShadowContainer()
    root.innerHTML = buildCardHTML(query, locale)
    target.parentElement?.insertBefore(host, target)

    const answerEl = root.getElementById('hchat-answer')
    const closeBtn = root.getElementById('hchat-close')

    closeBtn?.addEventListener('click', () => { host.remove() })

    // Stream answer via background
    const port = chrome.runtime.connect({ name: 'inline-stream' })
    const searchPrompt = locale === 'en'
      ? `Answer the following search query concisely and accurately in 3-5 sentences. Use plain text without markdown:\n\n"${query}"`
      : `다음 검색 질문에 대해 간결하고 정확하게 3-5문장으로 답변해줘. 마크다운 없이 일반 텍스트로 답변:\n\n"${query}"`

    port.postMessage({
      type: 'INLINE_STREAM',
      prompt: searchPrompt,
      maxTokens: 512,
    })

    let answer = ''
    port.onMessage.addListener((msg) => {
      if (msg.type === 'chunk' && answerEl) {
        answer += msg.text
        answerEl.textContent = answer
      }
      if (msg.type === 'done' && answerEl) {
        answerEl.textContent = answer || tSync(locale, 'searchInjector.noAnswer')
      }
      if (msg.type === 'error' && answerEl) {
        answerEl.textContent = tSync(locale, 'searchInjector.error')
        answerEl.style.color = '#e57373'
      }
    })
  })
}

// Run on page load
if (document.readyState === 'complete') {
  injectCard()
} else {
  window.addEventListener('load', injectCard)
}
