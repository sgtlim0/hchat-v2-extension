// Background Service Worker
// Handles: icon click, context menus, alarms, streaming via providers

import { createAllProviders, getProviderForModel } from '../lib/providers/provider-factory'
import { SK } from '../lib/storageKeys'

chrome.runtime.onInstalled.addListener(() => {
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
    chrome.storage.local.set({ [SK.CONFIG]: msg.config })
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
  const key = SK.HIGHLIGHTS
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
  const key = SK.HIGHLIGHTS
  const result = await chrome.storage.local.get(key)
  const all = result[key] ?? []
  return all.filter((h: { url: string }) => h.url === url)
}

// ── Tab activation → request page context update ──
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'UPDATE_PAGE_CONTEXT' })
  } catch {
    // Content script not loaded on this tab
  }
})

// ── Helper: get config from storage ──
async function getStoredConfig() {
  const result = await chrome.storage.local.get(SK.CONFIG)
  return result[SK.CONFIG] ?? {}
}

// ── Helper: resolve provider from stored config via provider-factory ──
function resolveProvider(modelId: string, config: Record<string, unknown>) {
  const aws = (config.aws ?? {}) as { accessKeyId?: string; secretAccessKey?: string; region?: string }
  const openai = (config.openai ?? {}) as { apiKey?: string }
  const gemini = (config.gemini ?? {}) as { apiKey?: string }
  const ollama = config.ollama as { baseUrl?: string; modelFilter?: string[] } | undefined
  const openrouter = config.openrouter as { apiKey?: string; siteUrl?: string; siteName?: string } | undefined

  const providers = createAllProviders({
    bedrock: { accessKeyId: aws.accessKeyId ?? '', secretAccessKey: aws.secretAccessKey ?? '', region: aws.region ?? 'us-east-1' },
    openai: { apiKey: openai.apiKey ?? '' },
    gemini: { apiKey: gemini.apiKey ?? '' },
    ollama: ollama?.baseUrl ? ollama : undefined,
    openrouter: openrouter?.apiKey ? openrouter : undefined,
  })

  const provider = getProviderForModel(modelId, providers)
  if (provider?.isConfigured()) return provider

  // Fallback: first configured provider (typically bedrock)
  const fallback = providers.find((p) => p.isConfigured())
  return fallback ?? null
}

// ── Streaming via providers (toolbar-stream and inline-stream) ──
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'toolbar-stream' && port.name !== 'inline-stream') return

  port.onMessage.addListener(async (msg) => {
    if (msg.type !== 'TOOLBAR_STREAM' && msg.type !== 'INLINE_STREAM') return

    const { model, prompt, systemPrompt } = msg

    try {
      // Get config for credentials
      let config: Record<string, unknown>

      if (msg.aws) {
        // Legacy: credentials passed directly
        config = { aws: msg.aws }
      } else {
        config = await getStoredConfig()
      }

      const modelId = model || (config as { defaultModel?: string }).defaultModel || 'us.anthropic.claude-sonnet-4-6'
      const provider = resolveProvider(modelId, config)

      if (!provider) {
        port.postMessage({ type: 'error', message: 'API 키가 설정되지 않았습니다' })
        return
      }

      const gen = provider.stream({
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        systemPrompt,
        maxTokens: msg.maxTokens ?? 1024,
      })

      for await (const chunk of gen) {
        port.postMessage({ type: 'chunk', text: chunk })
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
      await chrome.storage.local.set({
        [SK.QUICK_ACTION]: { action: 'summarize', ts: Date.now() },
      })
      await chrome.sidePanel.open({ tabId: tab.id })
    }
  }
})
