// Background Service Worker
// Handles: icon click, context menus, alarms, streaming via providers

import { BedrockProvider } from '../lib/providers/bedrock-provider'
import { OpenAIProvider } from '../lib/providers/openai-provider'
import { GeminiProvider } from '../lib/providers/gemini-provider'
import { OllamaProvider } from '../lib/providers/ollama-provider'
import { OpenRouterProvider } from '../lib/providers/openrouter-provider'
import type { AIProvider } from '../lib/providers/types'

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
    // Content script not loaded on this tab
  }
})

// ── Helper: get config from storage ──
async function getStoredConfig() {
  const result = await chrome.storage.local.get('hchat:config')
  return result['hchat:config'] ?? {}
}

// ── Helper: create provider from stored config ──
function createProviderForModel(modelId: string, config: Record<string, unknown>): AIProvider | null {
  const aws = config.aws as { accessKeyId?: string; secretAccessKey?: string; region?: string } | undefined
  const openai = config.openai as { apiKey?: string } | undefined
  const gemini = config.gemini as { apiKey?: string } | undefined
  const ollama = config.ollama as { baseUrl?: string; modelFilter?: string[] } | undefined
  const openrouter = config.openrouter as { apiKey?: string; siteUrl?: string; siteName?: string } | undefined

  // Determine provider type from model ID
  if (modelId.startsWith('us.anthropic') || modelId.startsWith('anthropic')) {
    if (aws?.accessKeyId && aws.secretAccessKey) {
      return new BedrockProvider({
        accessKeyId: aws.accessKeyId,
        secretAccessKey: aws.secretAccessKey,
        region: aws.region ?? 'us-east-1',
      })
    }
  } else if (modelId.startsWith('gpt-')) {
    if (openai?.apiKey) return new OpenAIProvider(openai.apiKey)
  } else if (modelId.startsWith('gemini-')) {
    if (gemini?.apiKey) return new GeminiProvider(gemini.apiKey)
  } else if (openrouter?.apiKey && (modelId.includes('/') || modelId.startsWith('anthropic/'))) {
    return new OpenRouterProvider({ apiKey: openrouter.apiKey, siteUrl: openrouter.siteUrl, siteName: openrouter.siteName })
  } else if (ollama?.baseUrl) {
    return new OllamaProvider({ baseUrl: ollama.baseUrl, modelFilter: ollama.modelFilter })
  }

  // Fallback to bedrock
  if (aws?.accessKeyId && aws.secretAccessKey) {
    return new BedrockProvider({
      accessKeyId: aws.accessKeyId,
      secretAccessKey: aws.secretAccessKey,
      region: aws.region ?? 'us-east-1',
    })
  }

  return null
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
      const provider = createProviderForModel(modelId, config)

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
        'hchat:quick-action': { action: 'summarize', ts: Date.now() },
      })
      await chrome.sidePanel.open({ tabId: tab.id })
    }
  }
})
