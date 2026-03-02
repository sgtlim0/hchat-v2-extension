// content/writing-assistant.ts — AI writing toolbar for textarea/contenteditable
// Uses Shadow DOM to avoid CSP conflicts with host pages

import { getLocale, tSync, type Locale } from '../i18n'

const WRITING_TRANSFORMS = [
  { id: 'improve', icon: '✨', labelKey: 'writingAssistant.improve' },
  { id: 'shorter', icon: '📏', labelKey: 'writingAssistant.shorter' },
  { id: 'longer', icon: '📐', labelKey: 'writingAssistant.longer' },
  { id: 'formal', icon: '👔', labelKey: 'writingAssistant.formal' },
  { id: 'casual', icon: '😊', labelKey: 'writingAssistant.casual' },
  { id: 'translate-en', icon: '🇺🇸', labelKey: 'writingAssistant.translateEn' },
  { id: 'translate-ko', icon: '🇰🇷', labelKey: 'writingAssistant.translateKo' },
]

const PROMPTS_KO: Record<string, (text: string) => string> = {
  improve: (t) => `다음 텍스트를 더 자연스럽고 명확하게 다듬어줘. 원래 의미를 유지하되, 가독성을 높여줘. 결과만 출력:\n\n${t}`,
  shorter: (t) => `다음 텍스트를 핵심만 남겨 짧게 줄여줘. 결과만 출력:\n\n${t}`,
  longer: (t) => `다음 텍스트를 더 상세하고 풍부하게 확장해줘. 결과만 출력:\n\n${t}`,
  formal: (t) => `다음 텍스트를 격식체(존댓말)로 변환해줘. 결과만 출력:\n\n${t}`,
  casual: (t) => `다음 텍스트를 캐주얼하고 친근한 말투로 변환해줘. 결과만 출력:\n\n${t}`,
  'translate-en': (t) => `Translate the following text to natural English. Output only the translation:\n\n${t}`,
  'translate-ko': (t) => `다음 텍스트를 자연스러운 한국어로 번역해줘. 번역 결과만 출력:\n\n${t}`,
}

const PROMPTS_EN: Record<string, (text: string) => string> = {
  improve: (t) => `Improve the following text to be more natural and clear. Keep the original meaning but enhance readability. Output only the result:\n\n${t}`,
  shorter: (t) => `Shorten the following text to its key points. Output only the result:\n\n${t}`,
  longer: (t) => `Expand the following text with more detail and depth. Output only the result:\n\n${t}`,
  formal: (t) => `Rewrite the following text in a formal tone. Output only the result:\n\n${t}`,
  casual: (t) => `Rewrite the following text in a casual, friendly tone. Output only the result:\n\n${t}`,
  'translate-en': (t) => `Translate the following text to natural English. Output only the translation:\n\n${t}`,
  'translate-ko': (t) => `Translate the following text to natural Korean. Output only the translation:\n\n${t}`,
}

let shadowHost: HTMLElement | null = null
let shadowRoot: ShadowRoot | null = null
let activeButton: HTMLElement | null = null
let activePopup: HTMLElement | null = null

const SHADOW_STYLES = `
  :host { all: initial; }
  .hchat-writing-btn {
    position: absolute; z-index: 999999;
    width: 28px; height: 28px;
    background: linear-gradient(135deg, #34d399, #10b981);
    border-radius: 50%; display: flex; align-items: center;
    justify-content: center; cursor: pointer; font-size: 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    transition: transform 0.15s; user-select: none;
    pointer-events: auto;
  }
  .hchat-writing-btn:hover { transform: scale(1.15); }
  .hchat-writing-popup {
    position: absolute; z-index: 999999;
    background: #1e1e2e; border: 1px solid #333; border-radius: 10px;
    padding: 8px; display: flex; flex-wrap: wrap; gap: 4px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3); max-width: 280px;
    pointer-events: auto;
  }
  .transform-chip {
    background: #2a2a3e; color: #e0e0e0; border: 1px solid #444;
    border-radius: 6px; padding: 4px 8px; font-size: 12px;
    cursor: pointer; white-space: nowrap; transition: background 0.1s;
  }
  .transform-chip:hover { background: #3a3a5e; }
  .popup-loading {
    color: #aaa; font-size: 12px; padding: 8px;
    display: flex; align-items: center; gap: 8px;
  }
  .popup-content {
    color: #e0e0e0; font-size: 12px; padding: 8px;
    max-height: 200px; overflow-y: auto;
    white-space: pre-wrap; line-height: 1.5;
  }
  .popup-actions {
    display: flex; gap: 6px; padding: 4px 8px;
  }
  .btn-accept {
    background: #10b981; color: #fff; border: none;
    border-radius: 6px; padding: 4px 12px; font-size: 11px; cursor: pointer;
  }
  .btn-copy {
    background: #333; color: #ccc; border: 1px solid #555;
    border-radius: 6px; padding: 4px 12px; font-size: 11px; cursor: pointer;
  }
  .btn-close {
    background: none; color: #888; border: none;
    padding: 4px 8px; font-size: 11px; cursor: pointer;
  }
  .hchat-cursor {
    animation: hchat-blink 0.7s infinite;
  }
  .spinner {
    display: inline-block;
    animation: spin 1s linear infinite;
  }
  @keyframes hchat-blink { 0%,100%{opacity:1} 50%{opacity:0} }
  @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
`

function ensureShadowHost(): ShadowRoot {
  if (shadowRoot) return shadowRoot
  shadowHost = document.createElement('div')
  shadowHost.id = 'hchat-writing-host'
  shadowHost.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;z-index:999999;pointer-events:none;'
  document.body.appendChild(shadowHost)
  shadowRoot = shadowHost.attachShadow({ mode: 'closed' })

  const style = document.createElement('style')
  style.textContent = SHADOW_STYLES
  shadowRoot.appendChild(style)

  return shadowRoot
}

function getSelectedText(el: HTMLElement): string {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    return el.value.substring(el.selectionStart ?? 0, el.selectionEnd ?? 0)
  }
  const sel = window.getSelection()
  return sel?.toString() ?? ''
}

function replaceText(el: HTMLElement, newText: string) {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    el.value = el.value.substring(0, start) + newText + el.value.substring(end)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  } else if (el.isContentEditable) {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      range.deleteContents()
      range.insertNode(document.createTextNode(newText))
    }
  }
}

function createButton(): HTMLElement {
  const btn = document.createElement('div')
  btn.className = 'hchat-writing-btn'
  btn.textContent = '✨'
  return btn
}

function createPopup(el: HTMLElement, text: string, btnRect: DOMRect, locale: Locale): HTMLElement {
  const root = ensureShadowHost()
  const popup = document.createElement('div')
  popup.className = 'hchat-writing-popup'
  popup.style.top = `${btnRect.bottom + 4}px`
  popup.style.left = `${btnRect.left}px`

  for (const t of WRITING_TRANSFORMS) {
    const chip = document.createElement('button')
    chip.className = 'transform-chip'
    const label = tSync(locale, t.labelKey)
    chip.textContent = `${t.icon} ${label}`
    chip.addEventListener('click', (e) => {
      e.stopPropagation()
      runTransform(el, text, t.id, popup, locale)
    })
    popup.appendChild(chip)
  }

  root.appendChild(popup)
  return popup
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function runTransform(el: HTMLElement, text: string, transformId: string, popup: HTMLElement, locale: Locale) {
  const prompts = locale === 'en' ? PROMPTS_EN : PROMPTS_KO
  const promptFn = prompts[transformId]
  if (!promptFn) return

  // Show loading
  popup.innerHTML = ''
  const loadingDiv = document.createElement('div')
  loadingDiv.className = 'popup-loading'
  const spinnerSpan = document.createElement('span')
  spinnerSpan.className = 'spinner'
  spinnerSpan.textContent = '⏳'
  loadingDiv.appendChild(spinnerSpan)
  loadingDiv.appendChild(document.createTextNode(` ${tSync(locale, 'writingAssistant.processing')}`))
  popup.appendChild(loadingDiv)

  const port = chrome.runtime.connect({ name: 'inline-stream' })
  port.postMessage({
    type: 'INLINE_STREAM',
    prompt: promptFn(text),
    maxTokens: 1024,
  })

  let result = ''
  port.onMessage.addListener((msg) => {
    if (msg.type === 'chunk') {
      result += msg.text
      popup.innerHTML = ''
      const contentDiv = document.createElement('div')
      contentDiv.className = 'popup-content'
      contentDiv.innerHTML = escapeHtml(result)
      const cursorSpan = document.createElement('span')
      cursorSpan.className = 'hchat-cursor'
      cursorSpan.textContent = '▌'
      contentDiv.appendChild(cursorSpan)
      popup.appendChild(contentDiv)
    }
    if (msg.type === 'done' || msg.type === 'error') {
      const finalText = msg.type === 'error' ? `⚠ ${tSync(locale, 'writingAssistant.error')} ${msg.message}` : result

      popup.innerHTML = ''

      const contentDiv = document.createElement('div')
      contentDiv.className = 'popup-content'
      contentDiv.textContent = finalText
      popup.appendChild(contentDiv)

      const actionsDiv = document.createElement('div')
      actionsDiv.className = 'popup-actions'

      const acceptBtn = document.createElement('button')
      acceptBtn.className = 'btn-accept'
      acceptBtn.textContent = tSync(locale, 'writingAssistant.apply')
      acceptBtn.addEventListener('click', () => {
        replaceText(el, result)
        cleanup()
      })

      const copyBtn = document.createElement('button')
      copyBtn.className = 'btn-copy'
      copyBtn.textContent = tSync(locale, 'writingAssistant.copy')
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(result)
        copyBtn.textContent = `✓ ${tSync(locale, 'writingAssistant.copied')}`
      })

      const closeBtn = document.createElement('button')
      closeBtn.className = 'btn-close'
      closeBtn.textContent = tSync(locale, 'writingAssistant.close')
      closeBtn.addEventListener('click', cleanup)

      actionsDiv.appendChild(acceptBtn)
      actionsDiv.appendChild(copyBtn)
      actionsDiv.appendChild(closeBtn)
      popup.appendChild(actionsDiv)
    }
  })
}

function cleanup() {
  activeButton?.remove()
  activePopup?.remove()
  activeButton = null
  activePopup = null
}

function isEditableElement(el: Element): el is HTMLElement {
  if (el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLInputElement && el.type === 'text') return true
  if (el instanceof HTMLElement && el.isContentEditable) return true
  return false
}

async function showButton(el: HTMLElement) {
  cleanup()

  const text = getSelectedText(el)
  if (!text || text.length < 2) return

  const locale = await getLocale()
  const root = ensureShadowHost()

  const rect = el.getBoundingClientRect()
  const sel = window.getSelection()
  const selRect = sel?.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : rect

  const btn = createButton()
  btn.style.top = `${window.scrollY + selRect.top - 32}px`
  btn.style.left = `${window.scrollX + selRect.right + 4}px`
  root.appendChild(btn)
  activeButton = btn

  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    const popup = createPopup(el, text, btn.getBoundingClientRect(), locale)
    activePopup = popup
    btn.remove()
    activeButton = null
  })
}

// Listen for text selection in editable elements
document.addEventListener('mouseup', (e) => {
  const target = e.target as Element
  if (!target) return

  const editable = target.closest('textarea, [contenteditable="true"], input[type="text"]')
  if (editable && isEditableElement(editable)) {
    setTimeout(() => showButton(editable), 100)
  }
})

// Cleanup on click outside
document.addEventListener('mousedown', (e) => {
  if (shadowRoot) {
    const path = e.composedPath()
    const isInsideBtn = activeButton && path.includes(activeButton)
    const isInsidePopup = activePopup && path.includes(activePopup)
    if (!isInsideBtn && !isInsidePopup) {
      cleanup()
    }
  }
})

// Watch for dynamic textareas
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node instanceof HTMLElement) {
        const editables = node.querySelectorAll('textarea, [contenteditable="true"]')
        editables.forEach((el) => {
          el.addEventListener('mouseup', () => {
            if (isEditableElement(el)) showButton(el)
          })
        })
      }
    }
  }
})

observer.observe(document.body, { childList: true, subtree: true })
