// Content script - injects AI toolbar on text selection + page context tracking
// Runs on all pages

import './toolbar'

// ── Page context tracking ──────────────────────
function extractMainContent(): string {
  const el = document.querySelector('article') ?? document.querySelector('main') ?? document.body
  return el.innerText.replace(/\n{3,}/g, '\n\n').trim().slice(0, 6000)
}

function detectPageType(url: string): string {
  if (/github\.com|gitlab\.com|bitbucket\.org/.test(url)) return 'code'
  if (/youtube\.com|youtu\.be|vimeo\.com/.test(url)) return 'video'
  if (/twitter\.com|x\.com|reddit\.com/.test(url)) return 'social'
  if (/docs\.|documentation|wiki|readme/i.test(url)) return 'docs'
  return 'unknown'
}

function updatePageContext() {
  const ctx = {
    url: location.href,
    title: document.title,
    text: extractMainContent(),
    meta: { type: detectPageType(location.href) },
    ts: Date.now(),
  }
  chrome.storage.local.set({ 'hchat:page-context': ctx })
}

// Initial context capture (after page loads)
setTimeout(updatePageContext, 1500)

// SPA navigation detection
let lastUrl = location.href
const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href
    setTimeout(updatePageContext, 800)
  }
})
observer.observe(document.documentElement, { childList: true, subtree: true })

// Text selection → update context with selection
let selTimer: ReturnType<typeof setTimeout> | null = null
document.addEventListener('mouseup', () => {
  if (selTimer) clearTimeout(selTimer)
  selTimer = setTimeout(() => {
    const sel = window.getSelection()?.toString().trim()
    if (sel && sel.length > 10) {
      chrome.storage.local.get('hchat:page-context', (r) => {
        const ctx = r['hchat:page-context']
        if (ctx) {
          chrome.storage.local.set({
            'hchat:page-context': { ...ctx, selection: sel.slice(0, 1000), ts: Date.now() },
          })
        }
      })
    }
  }, 500)
})

// ── Highlight restoration ──────────────────────
async function restoreHighlights() {
  try {
    const result = await chrome.runtime.sendMessage({
      type: 'GET_HIGHLIGHTS',
      url: location.href,
    })
    const highlights = result?.highlights ?? []
    for (const h of highlights) {
      try {
        const node = document.evaluate(
          h.xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null,
        ).singleNodeValue
        if (!node) continue

        const range = document.createRange()
        const textNode = node.nodeType === Node.TEXT_NODE ? node : node.firstChild
        if (!textNode) continue

        const text = textNode.textContent ?? ''
        const start = text.indexOf(h.text, h.textOffset > 0 ? h.textOffset - 5 : 0)
        if (start === -1) continue

        range.setStart(textNode, start)
        range.setEnd(textNode, start + h.text.length)

        const mark = document.createElement('mark')
        mark.className = `hchat-highlight hchat-highlight-${h.color}`
        mark.dataset.highlightId = h.id
        range.surroundContents(mark)
      } catch {
        // DOM changed, skip this highlight
      }
    }
  } catch {
    // Background not ready or no highlights
  }
}

// Restore highlights after page loads
setTimeout(restoreHighlights, 2000)

// Listen for context update requests from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'UPDATE_PAGE_CONTEXT') {
    updatePageContext()
  }
})
