// Floating AI toolbar that appears on text selection
// All DOM manipulation - no React needed here

const TOOLBAR_ID = 'hchat-toolbar'
const RESULT_ID = 'hchat-result'

let toolbar: HTMLElement | null = null
let resultPanel: HTMLElement | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null

interface ActionDef {
  id: string
  icon: string
  label: string
  prompt: (text: string) => string
}

const ACTIONS: ActionDef[] = [
  { id: 'explain', icon: '💡', label: '설명', prompt: (t) => `다음을 쉽게 설명해줘:\n\n${t}` },
  { id: 'translate', icon: '🌐', label: '번역', prompt: (t) => `다음을 한국어로 번역해줘:\n\n${t}` },
  { id: 'summarize', icon: '📄', label: '요약', prompt: (t) => `다음을 3줄로 요약해줘:\n\n${t}` },
  { id: 'rewrite', icon: '✏️', label: '다듬기', prompt: (t) => `다음 문장을 더 명확하게 다듬어줘:\n\n${t}` },
  { id: 'formal', icon: '🎩', label: '격식체', prompt: (t) => `다음을 격식 있는 문체로 바꿔줘:\n\n${t}` },
  { id: 'grammar', icon: '✅', label: '교정', prompt: (t) => `다음의 문법과 맞춤법을 교정해줘:\n\n${t}` },
  { id: 'highlight', icon: '🖍️', label: '하이라이트', prompt: () => '' },
]

function getStyles(): string {
  return `
    #hchat-toolbar {
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
    #hchat-toolbar button {
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
    #hchat-toolbar button:hover {
      background: rgba(52,211,153,0.1);
      color: #34d399;
    }
    #hchat-toolbar .h-logo {
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
    #hchat-toolbar .divider {
      width: 1px;
      background: rgba(255,255,255,0.07);
      margin: 4px 2px;
      align-self: stretch;
    }
    #hchat-result {
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
    #hchat-result .r-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      background: rgba(52,211,153,0.05);
      flex-shrink: 0;
    }
    #hchat-result .r-title {
      font-size: 12px;
      font-weight: 600;
      color: #34d399;
      flex: 1;
      font-family: 'IBM Plex Mono', monospace;
    }
    #hchat-result .r-close {
      background: transparent;
      border: none;
      color: #6b7c93;
      cursor: pointer;
      font-size: 14px;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: inherit;
    }
    #hchat-result .r-close:hover { background: rgba(255,255,255,0.06); color: #eef1f5; }
    #hchat-result .r-body {
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
    #hchat-result .r-footer {
      display: flex;
      gap: 6px;
      padding: 8px 12px;
      border-top: 1px solid rgba(255,255,255,0.06);
      flex-shrink: 0;
    }
    #hchat-result .r-btn {
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
    #hchat-result .r-btn:hover { background: rgba(52,211,153,0.08); color: #34d399; border-color: rgba(52,211,153,0.2); }
    .hchat-cursor { display: inline-block; animation: hchat-blink 0.8s step-end infinite; color: #34d399; }
    @keyframes hchat-blink { 0%,100%{opacity:1} 50%{opacity:0} }
  `
}

function injectStyles() {
  if (document.getElementById('hchat-styles')) return
  const style = document.createElement('style')
  style.id = 'hchat-styles'
  style.textContent = getStyles()
  document.head.appendChild(style)
}

function createToolbar(): HTMLElement {
  const el = document.createElement('div')
  el.id = TOOLBAR_ID

  const logo = document.createElement('div')
  logo.className = 'h-logo'
  logo.textContent = 'H'
  el.appendChild(logo)

  const div = document.createElement('div')
  div.className = 'divider'
  el.appendChild(div)

  ACTIONS.forEach((action) => {
    const btn = document.createElement('button')
    btn.innerHTML = `<span>${action.icon}</span><span>${action.label}</span>`
    btn.dataset.action = action.id
    el.appendChild(btn)
  })

  return el
}

function createResultPanel(title: string): HTMLElement {
  const el = document.createElement('div')
  el.id = RESULT_ID

  const header = document.createElement('div')
  header.className = 'r-header'
  header.innerHTML = `<div class="r-logo" style="width:20px;height:20px;background:linear-gradient(135deg,#34d399,#10b981);border-radius:5px;display:flex;align-items:center;justify-content:center;font-family:monospace;font-weight:700;font-size:10px;color:#061210;flex-shrink:0">H</div><span class="r-title">${title}</span>`
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
  copyBtn.textContent = '📋 복사'
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(body.innerText.replace('▌', ''))
    copyBtn.textContent = '✓ 복사됨'
    setTimeout(() => { copyBtn.textContent = '📋 복사' }, 1500)
  }
  const chatBtn = document.createElement('button')
  chatBtn.className = 'r-btn'
  chatBtn.textContent = '💬 채팅에서 계속'
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

function positionElement(el: HTMLElement, x: number, y: number) {
  document.body.appendChild(el)
  const rect = el.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
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
  const action = ACTIONS.find((a) => a.id === actionId)
  if (!action) return

  removeResult()
  removeToolbar()

  const panel = createResultPanel(action.label)
  positionElement(panel, x, y + 30)
  resultPanel = panel

  const body = panel.querySelector('.r-body') as HTMLElement
  body.innerHTML = '<span class="hchat-cursor">▌</span>'

  // Get config
  const result = await chrome.storage.local.get('hchat:config')
  const cfg = result['hchat:config']
  const aws = cfg?.aws ?? {}
  const model = cfg?.defaultModel ?? 'us.anthropic.claude-sonnet-4-6'

  if (!aws.accessKeyId || !aws.secretAccessKey) {
    body.innerHTML = '❌ AWS 자격증명을 설정해주세요. 확장 아이콘 → 설정'
    return
  }

  const prompt = action.prompt(selectedText)
  let text = ''
  body.innerHTML = '<span class="hchat-cursor">▌</span>'

  try {
    // Use background service worker for Bedrock API call via message passing
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
          body.innerHTML = text + '<span class="hchat-cursor">▌</span>'
          body.scrollTop = body.scrollHeight
        } else if (msg.type === 'done') {
          body.innerHTML = text
          resolve()
        } else if (msg.type === 'error') {
          body.textContent = '❌ ' + msg.message
          reject(new Error(msg.message))
        }
      })
      port.onDisconnect.addListener(() => {
        if (!text) reject(new Error('연결 끊김'))
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

  // Visual highlight
  try {
    const mark = document.createElement('mark')
    mark.className = 'hchat-highlight hchat-highlight-yellow'
    mark.dataset.highlightId = crypto.randomUUID()
    range.surroundContents(mark)
  } catch {
    // Can't surround if range crosses elements
  }

  // Save via background
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

    // Check if enabled
    chrome.storage.local.get('hchat:config', (r) => {
      if (!r['hchat:config']?.enableContentScript) return

      injectStyles()
      removeToolbar()

      const el = createToolbar()
      positionElement(el, mouseX, mouseY)
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
  if (!(e.target as HTMLElement).closest(`#${TOOLBAR_ID}, #${RESULT_ID}`)) {
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
      removeToolbar()
      // Don't auto-remove result panel
    }, 200)
  }
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { removeToolbar(); removeResult() }
})

// Listen for messages from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SELECTION_ACTION') {
    const text = window.getSelection()?.toString().trim()
    if (text) runAction(msg.action, text, window.innerWidth / 2, window.innerHeight / 2)
  }
})
