// Floating AI toolbar that appears on text selection
// Uses Shadow DOM to avoid CSP conflicts with host pages

import { getLocale, tSync, type Locale } from '../i18n'

let shadowHost: HTMLElement | null = null
let shadowRoot: ShadowRoot | null = null
let toolbar: HTMLElement | null = null
let resultPanel: HTMLElement | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null

const PROMPTS_KO: Record<string, (t: string) => string> = {
  explain: (t) => `다음을 쉽게 설명해줘:\n\n${t}`,
  translate: (t) => `다음을 한국어로 번역해줘:\n\n${t}`,
  summarize: (t) => `다음을 3줄로 요약해줘:\n\n${t}`,
  rewrite: (t) => `다음 문장을 더 명확하게 다듬어줘:\n\n${t}`,
  formal: (t) => `다음을 격식 있는 문체로 바꿔줘:\n\n${t}`,
  grammar: (t) => `다음의 문법과 맞춤법을 교정해줘:\n\n${t}`,
}

const PROMPTS_EN: Record<string, (t: string) => string> = {
  explain: (t) => `Explain the following in simple terms:\n\n${t}`,
  translate: (t) => `Translate the following to English:\n\n${t}`,
  summarize: (t) => `Summarize the following in 3 sentences:\n\n${t}`,
  rewrite: (t) => `Rewrite the following to be clearer and more concise:\n\n${t}`,
  formal: (t) => `Rewrite the following in a formal tone:\n\n${t}`,
  grammar: (t) => `Check and correct the grammar and spelling of the following:\n\n${t}`,
}

const ACTION_IDS = ['explain', 'translate', 'summarize', 'rewrite', 'formal', 'grammar', 'highlight'] as const
const ACTION_ICONS: Record<string, string> = {
  explain: '💡', translate: '🌐', summarize: '📄',
  rewrite: '✏️', formal: '🎩', grammar: '✅', highlight: '🖍️',
}

function getStyles(): string {
  return `
    :host { all: initial; }
    .hchat-toolbar {
      position: fixed;
      z-index: 2147483647;
      background: #0e1318;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      padding: 5px;
      display: flex;
      gap: 2px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      user-select: none;
      font-family: 'IBM Plex Sans KR', 'Noto Sans KR', sans-serif;
      transition: opacity 0.15s;
    }
    .hchat-toolbar button {
      background: transparent;
      border: none;
      border-radius: 6px;
      padding: 5px 9px;
      color: #b8c0cc;
      font-size: 11px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
      transition: all 0.12s;
      font-family: inherit;
    }
    .hchat-toolbar button:hover {
      background: rgba(52,211,153,0.1);
      color: #34d399;
    }
    .h-logo {
      width: 22px;
      height: 22px;
      background: linear-gradient(135deg, #34d399, #10b981);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'IBM Plex Mono', monospace;
      font-weight: 700;
      font-size: 11px;
      color: #061210;
      flex-shrink: 0;
    }
    .divider {
      width: 1px;
      background: rgba(255,255,255,0.07);
      margin: 4px 2px;
      align-self: stretch;
    }
    .hchat-result {
      position: fixed;
      z-index: 2147483646;
      background: #0e1318;
      border: 1px solid rgba(52,211,153,0.2);
      border-radius: 12px;
      width: 340px;
      max-height: 400px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.6);
      font-family: 'IBM Plex Sans KR', 'Noto Sans KR', sans-serif;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .r-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      background: rgba(52,211,153,0.05);
      flex-shrink: 0;
    }
    .r-logo {
      width: 20px; height: 20px;
      background: linear-gradient(135deg, #34d399, #10b981);
      border-radius: 5px;
      display: flex; align-items: center; justify-content: center;
      font-family: monospace; font-weight: 700; font-size: 10px;
      color: #061210; flex-shrink: 0;
    }
    .r-title {
      font-size: 12px;
      font-weight: 600;
      color: #34d399;
      flex: 1;
      font-family: 'IBM Plex Mono', monospace;
    }
    .r-close {
      background: transparent;
      border: none;
      color: #6b7c93;
      cursor: pointer;
      font-size: 14px;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: inherit;
    }
    .r-close:hover { background: rgba(255,255,255,0.06); color: #eef1f5; }
    .r-body {
      flex: 1;
      overflow-y: auto;
      padding: 12px 14px;
      font-size: 12.5px;
      line-height: 1.7;
      color: #eef1f5;
      white-space: pre-wrap;
      scrollbar-width: thin;
      scrollbar-color: #2a3a52 transparent;
    }
    .r-footer {
      display: flex;
      gap: 6px;
      padding: 8px 12px;
      border-top: 1px solid rgba(255,255,255,0.06);
      flex-shrink: 0;
    }
    .r-btn {
      flex: 1;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 6px;
      padding: 5px 10px;
      font-size: 11px;
      color: #adb8c8;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.12s;
    }
    .r-btn:hover { background: rgba(52,211,153,0.08); color: #34d399; border-color: rgba(52,211,153,0.2); }
    .hchat-cursor { display: inline-block; animation: hchat-blink 0.8s step-end infinite; color: #34d399; }
    @keyframes hchat-blink { 0%,100%{opacity:1} 50%{opacity:0} }
  `
}

function ensureShadowHost(): ShadowRoot {
  if (shadowRoot) return shadowRoot
  shadowHost = document.createElement('div')
  shadowHost.id = 'hchat-toolbar-host'
  shadowHost.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;'
  document.body.appendChild(shadowHost)
  shadowRoot = shadowHost.attachShadow({ mode: 'closed' })

  const style = document.createElement('style')
  style.textContent = getStyles()
  shadowRoot.appendChild(style)

  return shadowRoot
}

function createToolbar(locale: Locale): HTMLElement {
  const el = document.createElement('div')
  el.className = 'hchat-toolbar'
  el.style.pointerEvents = 'auto'

  const logo = document.createElement('div')
  logo.className = 'h-logo'
  logo.textContent = 'H'
  el.appendChild(logo)

  const div = document.createElement('div')
  div.className = 'divider'
  el.appendChild(div)

  for (const id of ACTION_IDS) {
    const btn = document.createElement('button')
    const label = tSync(locale, 'toolbar.' + id)
    const iconSpan = document.createElement('span')
    iconSpan.textContent = ACTION_ICONS[id]
    const labelSpan = document.createElement('span')
    labelSpan.textContent = label
    btn.appendChild(iconSpan)
    btn.appendChild(labelSpan)
    btn.dataset.action = id
    el.appendChild(btn)
  }

  return el
}

function createResultPanel(title: string, locale: Locale): HTMLElement {
  const el = document.createElement('div')
  el.className = 'hchat-result'
  el.style.pointerEvents = 'auto'

  const header = document.createElement('div')
  header.className = 'r-header'

  const logoDiv = document.createElement('div')
  logoDiv.className = 'r-logo'
  logoDiv.textContent = 'H'
  header.appendChild(logoDiv)

  const titleSpan = document.createElement('span')
  titleSpan.className = 'r-title'
  titleSpan.textContent = title
  header.appendChild(titleSpan)

  const closeBtn = document.createElement('button')
  closeBtn.className = 'r-close'
  closeBtn.textContent = '✕'
  closeBtn.onclick = removeResult
  header.appendChild(closeBtn)

  const body = document.createElement('div')
  body.className = 'r-body'

  const footer = document.createElement('div')
  footer.className = 'r-footer'

  const copyBtn = document.createElement('button')
  copyBtn.className = 'r-btn'
  copyBtn.textContent = `📋 ${tSync(locale, 'toolbar.copyBtn')}`
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(body.innerText.replace('▌', ''))
    copyBtn.textContent = `✓ ${tSync(locale, 'toolbar.copiedBtn')}`
    setTimeout(() => { copyBtn.textContent = `📋 ${tSync(locale, 'toolbar.copyBtn')}` }, 1500)
  }

  const chatBtn = document.createElement('button')
  chatBtn.className = 'r-btn'
  chatBtn.textContent = `💬 ${tSync(locale, 'toolbar.continueChat')}`
  chatBtn.onclick = () => {
    chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' })
  }

  footer.appendChild(copyBtn)
  footer.appendChild(chatBtn)

  el.appendChild(header)
  el.appendChild(body)
  el.appendChild(footer)
  return el
}

function positionElement(el: HTMLElement, root: ShadowRoot, x: number, y: number) {
  root.appendChild(el)
  const rect = el.getBoundingClientRect()
  const vw = window.innerWidth
  let left = x
  let top = y - rect.height - 12
  if (left + rect.width > vw - 10) left = vw - rect.width - 10
  if (left < 10) left = 10
  if (top < 10) top = y + 20
  el.style.left = left + 'px'
  el.style.top = top + 'px'
}

function removeToolbar() {
  toolbar?.remove()
  toolbar = null
}

function removeResult() {
  resultPanel?.remove()
  resultPanel = null
}

async function runAction(actionId: string, selectedText: string, x: number, y: number) {
  if (!ACTION_IDS.includes(actionId as typeof ACTION_IDS[number])) return

  const locale = await getLocale()
  const root = ensureShadowHost()

  removeResult()
  removeToolbar()

  const panel = createResultPanel(tSync(locale, 'toolbar.' + actionId), locale)
  positionElement(panel, root, x, y + 30)
  resultPanel = panel

  const body = panel.querySelector('.r-body') as HTMLElement
  const cursor = document.createElement('span')
  cursor.className = 'hchat-cursor'
  cursor.textContent = '▌'
  body.appendChild(cursor)

  // Get config
  const result = await chrome.storage.local.get('hchat:config')
  const cfg = result['hchat:config']
  const aws = cfg?.aws ?? {}
  const model = cfg?.defaultModel ?? 'us.anthropic.claude-sonnet-4-6'

  if (!aws.accessKeyId || !aws.secretAccessKey) {
    body.textContent = `❌ ${tSync(locale, 'toolbar.noCredentials')}`
    return
  }

  const prompts = locale === 'en' ? PROMPTS_EN : PROMPTS_KO
  const promptFn = prompts[actionId]
  if (!promptFn) return
  const prompt = promptFn(selectedText)
  let text = ''

  try {
    const port = chrome.runtime.connect({ name: 'toolbar-stream' })

    port.postMessage({
      type: 'TOOLBAR_STREAM',
      aws,
      model,
      prompt,
    })

    await new Promise<void>((resolve, reject) => {
      port.onMessage.addListener((msg) => {
        if (msg.type === 'chunk') {
          text += msg.text
          body.textContent = text + '▌'
          body.scrollTop = body.scrollHeight
        } else if (msg.type === 'done') {
          body.textContent = text
          resolve()
        } else if (msg.type === 'error') {
          body.textContent = '❌ ' + msg.message
          reject(new Error(msg.message))
        }
      })
      port.onDisconnect.addListener(() => {
        if (!text) reject(new Error(tSync(locale, 'toolbar.disconnected')))
      })
    })
  } catch (err) {
    body.textContent = '❌ ' + String(err)
  }
}

// ── Highlight save ────────────────────────────

function getXPathForNode(node: Node): string {
  if (node.nodeType === Node.DOCUMENT_NODE) return '/'
  const parts: string[] = []
  let current: Node | null = node
  while (current && current !== document.documentElement) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as Element
      let index = 1
      let sib = el.previousElementSibling
      while (sib) { if (sib.nodeName === el.nodeName) index++; sib = sib.previousElementSibling }
      parts.unshift(`${el.nodeName.toLowerCase()}[${index}]`)
    } else if (current.nodeType === Node.TEXT_NODE) {
      let index = 1
      let sib = current.previousSibling
      while (sib) { if (sib.nodeType === Node.TEXT_NODE) index++; sib = sib.previousSibling }
      parts.unshift(`text()[${index}]`)
    }
    current = current.parentNode
  }
  return '/' + parts.join('/')
}

function saveHighlight(text: string) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return

  const range = selection.getRangeAt(0)
  const xpath = getXPathForNode(range.startContainer)
  const textOffset = range.startOffset

  try {
    const mark = document.createElement('mark')
    mark.className = 'hchat-highlight hchat-highlight-yellow'
    mark.dataset.highlightId = crypto.randomUUID()
    range.surroundContents(mark)
  } catch {
    // Can't surround if range crosses elements
  }

  chrome.runtime.sendMessage({
    type: 'SAVE_HIGHLIGHT',
    data: {
      text,
      url: location.href,
      title: document.title,
      xpath,
      textOffset,
      color: 'yellow',
      tags: [],
    },
  })
}

// ── Event listeners ───────────────────────────

let mouseX = 0, mouseY = 0
document.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY }, { passive: true })

document.addEventListener('mouseup', () => {
  setTimeout(() => {
    const sel = window.getSelection()
    const text = sel?.toString().trim()

    if (!text || text.length < 3) {
      if (hideTimer) clearTimeout(hideTimer)
      hideTimer = setTimeout(() => { removeToolbar() }, 300)
      return
    }

    chrome.storage.local.get('hchat:config', async (r) => {
      if (!r['hchat:config']?.enableContentScript) return

      const locale = await getLocale()
      const root = ensureShadowHost()

      removeToolbar()

      const el = createToolbar(locale)
      positionElement(el, root, mouseX, mouseY)
      toolbar = el

      el.addEventListener('click', (ev) => {
        const btn = (ev.target as HTMLElement).closest('button')
        const action = btn?.dataset.action
        if (!action) return
        if (action === 'highlight') {
          saveHighlight(text)
          removeToolbar()
        } else {
          runAction(action, text, mouseX, mouseY)
        }
      })
    })
  }, 10)
})

document.addEventListener('mousedown', (e) => {
  if (shadowRoot) {
    const path = e.composedPath()
    const isInsideToolbar = toolbar && path.includes(toolbar)
    const isInsideResult = resultPanel && path.includes(resultPanel)
    if (!isInsideToolbar && !isInsideResult) {
      if (hideTimer) clearTimeout(hideTimer)
      hideTimer = setTimeout(() => { removeToolbar() }, 200)
    }
  }
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { removeToolbar(); removeResult() }
})

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SELECTION_ACTION') {
    const text = window.getSelection()?.toString().trim()
    if (text) runAction(msg.action, text, window.innerWidth / 2, window.innerHeight / 2)
  }
})
