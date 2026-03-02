// content/writing-assistant.ts — AI writing toolbar for textarea/contenteditable

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

let activeButton: HTMLElement | null = null
let activePopup: HTMLElement | null = null

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
  btn.innerHTML = '✨'
  btn.style.cssText = `
    position: absolute; z-index: 999999;
    width: 28px; height: 28px;
    background: linear-gradient(135deg, #34d399, #10b981);
    border-radius: 50%; display: flex; align-items: center;
    justify-content: center; cursor: pointer; font-size: 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    transition: transform 0.15s; user-select: none;
  `
  btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.15)' })
  btn.addEventListener('mouseleave', () => { btn.style.transform = 'scale(1)' })
  return btn
}

function createPopup(el: HTMLElement, text: string, btnRect: DOMRect, locale: Locale): HTMLElement {
  const popup = document.createElement('div')
  popup.className = 'hchat-writing-popup'
  popup.style.cssText = `
    position: absolute; z-index: 999999;
    top: ${btnRect.bottom + 4}px; left: ${btnRect.left}px;
    background: #1e1e2e; border: 1px solid #333; border-radius: 10px;
    padding: 8px; display: flex; flex-wrap: wrap; gap: 4px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3); max-width: 280px;
  `

  for (const t of WRITING_TRANSFORMS) {
    const chip = document.createElement('button')
    const label = tSync(locale, t.labelKey)
    chip.textContent = `${t.icon} ${label}`
    chip.style.cssText = `
      background: #2a2a3e; color: #e0e0e0; border: 1px solid #444;
      border-radius: 6px; padding: 4px 8px; font-size: 12px;
      cursor: pointer; white-space: nowrap; transition: background 0.1s;
    `
    chip.addEventListener('mouseenter', () => { chip.style.background = '#3a3a5e' })
    chip.addEventListener('mouseleave', () => { chip.style.background = '#2a2a3e' })
    chip.addEventListener('click', (e) => {
      e.stopPropagation()
      runTransform(el, text, t.id, popup, locale)
    })
    popup.appendChild(chip)
  }

  document.body.appendChild(popup)
  return popup
}

function runTransform(el: HTMLElement, text: string, transformId: string, popup: HTMLElement, locale: Locale) {
  const prompts = locale === 'en' ? PROMPTS_EN : PROMPTS_KO
  const promptFn = prompts[transformId]
  if (!promptFn) return

  // Show loading
  popup.innerHTML = `
    <div style="color: #aaa; font-size: 12px; padding: 8px; display: flex; align-items: center; gap: 8px;">
      <span style="animation: spin 1s linear infinite; display:inline-block;">⏳</span>
      ${tSync(locale, 'writingAssistant.processing')}
    </div>
    <style>@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }</style>
  `

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
      popup.innerHTML = `
        <div style="color: #e0e0e0; font-size: 12px; padding: 8px; max-height: 200px; overflow-y: auto; white-space: pre-wrap; line-height: 1.5;">
          ${escapeHtml(result)}<span style="animation: blink 0.7s infinite;">▌</span>
        </div>
        <style>@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }</style>
      `
    }
    if (msg.type === 'done' || msg.type === 'error') {
      const finalText = msg.type === 'error' ? `⚠ ${tSync(locale, 'writingAssistant.error')} ` + msg.message : result

      popup.innerHTML = `
        <div style="color: #e0e0e0; font-size: 12px; padding: 8px; max-height: 200px; overflow-y: auto; white-space: pre-wrap; line-height: 1.5;">
          ${escapeHtml(finalText)}
        </div>
        <div style="display: flex; gap: 6px; padding: 4px 8px;">
          <button id="hchat-accept" style="background: #10b981; color: #fff; border: none; border-radius: 6px; padding: 4px 12px; font-size: 11px; cursor: pointer;">${tSync(locale, 'writingAssistant.apply')}</button>
          <button id="hchat-copy" style="background: #333; color: #ccc; border: 1px solid #555; border-radius: 6px; padding: 4px 12px; font-size: 11px; cursor: pointer;">${tSync(locale, 'writingAssistant.copy')}</button>
          <button id="hchat-close" style="background: none; color: #888; border: none; padding: 4px 8px; font-size: 11px; cursor: pointer;">${tSync(locale, 'writingAssistant.close')}</button>
        </div>
      `

      popup.querySelector('#hchat-accept')?.addEventListener('click', () => {
        replaceText(el, result)
        cleanup()
      })
      popup.querySelector('#hchat-copy')?.addEventListener('click', () => {
        navigator.clipboard.writeText(result)
        const btn = popup.querySelector('#hchat-copy') as HTMLElement
        if (btn) btn.textContent = `✓ ${tSync(locale, 'writingAssistant.copied')}`
      })
      popup.querySelector('#hchat-close')?.addEventListener('click', cleanup)
    }
  })
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
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

  const rect = el.getBoundingClientRect()
  const sel = window.getSelection()
  const selRect = sel?.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : rect

  const btn = createButton()
  btn.style.top = `${window.scrollY + selRect.top - 32}px`
  btn.style.left = `${window.scrollX + selRect.right + 4}px`
  document.body.appendChild(btn)
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

  // Find closest editable element
  const editable = target.closest('textarea, [contenteditable="true"], input[type="text"]')
  if (editable && isEditableElement(editable)) {
    setTimeout(() => showButton(editable), 100)
  }
})

// Cleanup on click outside
document.addEventListener('mousedown', (e) => {
  const target = e.target as Element
  if (activeButton && !activeButton.contains(target) && activePopup && !activePopup.contains(target)) {
    cleanup()
  }
})

// Watch for dynamic textareas
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node instanceof HTMLElement) {
        // Mark new editables for potential button attachment
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
