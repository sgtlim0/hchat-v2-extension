// Content script - injects AI toolbar on text selection + page context tracking
// Runs on all pages

import './toolbar'
import { updatePageContext } from './pageContext'
import { SK } from '../lib/storageKeys'

// Initial context capture (after page loads)
setTimeout(updatePageContext, 1500)

// SPA navigation detection via History API interception (more efficient than MutationObserver)
let lastUrl = location.href

function onNavigate() {
  if (location.href !== lastUrl) {
    lastUrl = location.href
    setTimeout(updatePageContext, 800)
  }
}

// Handle popstate (back/forward)
window.addEventListener('popstate', onNavigate)

// Intercept pushState/replaceState for SPA frameworks
const originalPushState = history.pushState.bind(history)
const originalReplaceState = history.replaceState.bind(history)

history.pushState = function(...args: Parameters<typeof history.pushState>) {
  originalPushState(...args)
  onNavigate()
}

history.replaceState = function(...args: Parameters<typeof history.replaceState>) {
  originalReplaceState(...args)
  onNavigate()
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (selTimer) clearTimeout(selTimer)
})

// Text selection → update context with selection
let selTimer: ReturnType<typeof setTimeout> | null = null
document.addEventListener('mouseup', () => {
  if (selTimer) clearTimeout(selTimer)
  selTimer = setTimeout(() => {
    const sel = window.getSelection()?.toString().trim()
    if (sel && sel.length > 10) {
      chrome.storage.local.get(SK.PAGE_CONTEXT, (r) => {
        const ctx = r[SK.PAGE_CONTEXT]
        if (ctx) {
          chrome.storage.local.set({
            [SK.PAGE_CONTEXT]: { ...ctx, selection: sel.slice(0, 1000), ts: Date.now() },
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
