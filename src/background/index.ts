// Background Service Worker
// Handles: icon click, context menus, alarms, Bedrock toolbar streaming

import { signRequest } from '../lib/aws-sigv4'

chrome.runtime.onInstalled.addListener(() => {
  // Context menu for text selection
  chrome.contextMenus.create({
    id: 'hchat-explain',
    title: '💡 H Chat: 설명',
    contexts: ['selection'],
  })
  chrome.contextMenus.create({
    id: 'hchat-translate',
    title: '🌐 H Chat: 한국어로 번역',
    contexts: ['selection'],
  })
  chrome.contextMenus.create({
    id: 'hchat-summarize',
    title: '📄 H Chat: 요약',
    contexts: ['selection'],
  })
  chrome.contextMenus.create({
    id: 'hchat-rewrite',
    title: '✏️ H Chat: 다듬기',
    contexts: ['selection'],
  })
  chrome.contextMenus.create({
    id: 'hchat-separator',
    type: 'separator',
    contexts: ['selection'],
  })
  chrome.contextMenus.create({
    id: 'hchat-sidepanel',
    title: '🤖 H Chat 사이드패널 열기',
    contexts: ['all'],
  })
})

// Open side panel on icon click
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await chrome.sidePanel.open({ tabId: tab.id })
  }
})

// Context menu handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'hchat-sidepanel') {
    if (tab?.id) await chrome.sidePanel.open({ tabId: tab.id })
    return
  }

  const actionMap: Record<string, string> = {
    'hchat-explain': 'explain',
    'hchat-translate': 'translate',
    'hchat-summarize': 'summarize',
    'hchat-rewrite': 'rewrite',
  }

  const action = actionMap[info.menuItemId as string]
  if (action && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'SELECTION_ACTION', action })
  }
})

// Handle messages
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type === 'OPEN_SIDEPANEL') {
    chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
      if (tab?.id) await chrome.sidePanel.open({ tabId: tab.id })
    })
  }
  if (msg.type === 'CONFIG_UPDATED') {
    chrome.storage.local.set({ 'hchat:config': msg.config })
  }
  if (msg.type === 'SAVE_HIGHLIGHT') {
    handleSaveHighlight(msg.data).then((h) => reply?.({ ok: true, highlight: h }))
    return true
  }
  if (msg.type === 'GET_HIGHLIGHTS') {
    handleGetHighlights(msg.url).then((highlights) => reply?.({ highlights }))
    return true
  }
  reply?.({ ok: true })
  return true
})

// ── Highlight handlers ──
async function handleSaveHighlight(data: {
  text: string; url: string; title: string;
  xpath: string; textOffset: number; color: string; tags: string[]
}) {
  const key = 'hchat:highlights'
  const result = await chrome.storage.local.get(key)
  const all = result[key] ?? []
  const highlight = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  all.unshift(highlight)
  await chrome.storage.local.set({ [key]: all })
  return highlight
}

async function handleGetHighlights(url: string) {
  const key = 'hchat:highlights'
  const result = await chrome.storage.local.get(key)
  const all = result[key] ?? []
  return all.filter((h: { url: string }) => h.url === url)
}

// ── Tab activation → request page context update ──
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'UPDATE_PAGE_CONTEXT' })
  } catch {
    // Content script not loaded on this tab (e.g. chrome:// pages)
  }
})

// ── Toolbar streaming via Bedrock ──
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'toolbar-stream') return

  port.onMessage.addListener(async (msg) => {
    if (msg.type !== 'TOOLBAR_STREAM') return

    const { aws, model, prompt } = msg
    const region = aws.region || 'us-east-1'

    try {
      const bodyObj = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }
      const bodyStr = JSON.stringify(bodyObj)
      const encodedModel = encodeURIComponent(model)
      const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodedModel}/invoke-with-response-stream`

      const signedHeaders = await signRequest({
        method: 'POST',
        url,
        headers: { 'content-type': 'application/json' },
        body: bodyStr,
        accessKeyId: aws.accessKeyId,
        secretAccessKey: aws.secretAccessKey,
        region,
        service: 'bedrock',
      })

      const res = await fetch(url, {
        method: 'POST',
        headers: signedHeaders,
        body: bodyStr,
      })

      if (!res.ok) {
        const errText = await res.text()
        let errMsg = `HTTP ${res.status}`
        try { const j = JSON.parse(errText); errMsg = j.message ?? j.Message ?? errMsg } catch { errMsg = errText || errMsg }
        port.postMessage({ type: 'error', message: errMsg })
        return
      }

      if (!res.body) {
        port.postMessage({ type: 'error', message: '응답 스트림 없음' })
        return
      }

      // Parse Bedrock event stream
      const reader = res.body.getReader()
      let buffer = new Uint8Array(0)

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const merged = new Uint8Array(buffer.length + value.length)
        merged.set(buffer)
        merged.set(value, buffer.length)
        buffer = merged

        while (buffer.length >= 12) {
          const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
          const totalLength = view.getUint32(0)
          const headersLength = view.getUint32(4)
          if (buffer.length < totalLength) break

          const payloadOffset = 12 + headersLength
          const payloadLength = totalLength - headersLength - 16

          if (payloadLength > 0) {
            const payload = buffer.slice(payloadOffset, payloadOffset + payloadLength)
            const payloadStr = new TextDecoder('utf-8').decode(payload)
            try {
              const event = JSON.parse(payloadStr)
              if (event.bytes) {
                const binary = atob(event.bytes)
                const bytes = new Uint8Array(binary.length)
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
                const decoded = new TextDecoder('utf-8').decode(bytes)
                const inner = JSON.parse(decoded)
                if (inner.type === 'content_block_delta' && inner.delta?.text) {
                  port.postMessage({ type: 'chunk', text: inner.delta.text })
                }
              }
            } catch { /* ignore */ }
          }
          buffer = buffer.slice(totalLength)
        }
      }

      port.postMessage({ type: 'done' })
    } catch (err) {
      port.postMessage({ type: 'error', message: String(err) })
    }
  })
})

// ── Keyboard command handlers ──
chrome.commands?.onCommand?.addListener(async (command) => {
  if (command === 'quick-summarize') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      // Open sidepanel with summarize pending
      await chrome.storage.local.set({
        'hchat:quick-action': { action: 'summarize', ts: Date.now() },
      })
      await chrome.sidePanel.open({ tabId: tab.id })
    }
  }
})
