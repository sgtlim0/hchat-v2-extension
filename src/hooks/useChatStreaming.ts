import { useState, useCallback, useRef } from 'react'
import type { AIProvider, Message, ProviderType, ThinkingDepth } from '../lib/providers/types'
import { streamWithRetry } from '../lib/providers/stream-retry'
import { BedrockProvider } from '../lib/providers/bedrock-provider'
import { ChatHistory, type ChatMessage } from '../lib/chatHistory'
import { needsWebSearch, extractSearchQuery } from '../lib/searchIntent'
import { webSearch, buildSearchContext } from '../lib/webSearch'
import { Personas } from '../lib/personas'
import { Usage } from '../lib/usage'
import { trackUsage } from '../lib/userPreferences'
import { AssistantRegistry } from '../lib/assistantBuilder'
import { shouldSummarize, buildSummaryPrompt, saveSummaryEntry, loadLatestSummary, buildSystemPromptInjection, getDefaultConfig as getSummaryConfig } from '../lib/conversationSummarizer'
import type { AwsCredentials } from './useConfig'

export async function streamWithProvider(
  provider: AIProvider,
  model: string,
  messages: Message[],
  systemPrompt: string | undefined,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
  thinkingDepth?: ThinkingDepth,
): Promise<string> {
  let fullText = ''
  const gen = streamWithRetry(provider, { model, messages, systemPrompt, signal, thinkingDepth }, {
    maxRetries: 2,
    retryDelayMs: 1000,
    onRetry: (attempt) => {
      onChunk(`\n\n[네트워크 오류 — 재시도 ${attempt}/2...]\n\n`)
    },
  })
  for await (const chunk of gen) {
    onChunk(chunk)
    fullText += chunk
  }
  return fullText
}

export interface ExecuteChatParams {
  convId: string
  model: string
  providerType: ProviderType
  text: string
  historyMsgs: Message[]
  placeholderId: string
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  setIsSearching: (v: boolean) => void
  signal: AbortSignal
  provider: AIProvider | undefined
  aws: AwsCredentials
  personaId: string
  assistantId: string
  assistantSystemPrompt?: string
  assistantIsBuiltIn?: boolean
  enableWebSearch: boolean
  googleSearchApiKey: string
  googleSearchEngineId: string
  thinkingDepth?: ThinkingDepth
  explicitSystemPrompt?: string
}

export async function executeChatMode(params: ExecuteChatParams): Promise<void> {
  const {
    convId, model, providerType, text, historyMsgs, placeholderId,
    setMessages, setIsSearching, signal, provider, aws,
    personaId, assistantId, assistantSystemPrompt, assistantIsBuiltIn,
    enableWebSearch, googleSearchApiKey, googleSearchEngineId,
    thinkingDepth, explicitSystemPrompt,
  } = params

  const persona = await Personas.getById(personaId)
  let systemPrompt = explicitSystemPrompt ?? assistantSystemPrompt ?? persona?.systemPrompt ?? '당신은 도움이 되는 AI 어시스턴트입니다. 한국어로 답변해주세요.'
  let searchSources: { title: string; url: string }[] | undefined

  const prevSummary = await loadLatestSummary(convId)
  if (prevSummary && prevSummary.summary) {
    systemPrompt = buildSystemPromptInjection(prevSummary.summary) + '\n\n' + systemPrompt
  }

  if (enableWebSearch && needsWebSearch(text)) {
    setIsSearching(true)
    try {
      const query = extractSearchQuery(text)
      const results = await webSearch({
        query,
        maxResults: 5,
        googleApiKey: googleSearchApiKey || undefined,
        googleEngineId: googleSearchEngineId || undefined,
      })
      if (results.length > 0) {
        const searchContext = buildSearchContext(results)
        systemPrompt = searchContext + '\n\n' + systemPrompt
        searchSources = results.map((r) => ({ title: r.title, url: r.url }))
      }
    } catch {
      // Search failed, proceed without search results
    }
    setIsSearching(false)
  }

  const onChunk = (chunk: string) => {
    setMessages((prev) =>
      prev.map((m) => m.id === placeholderId ? { ...m, content: m.content + chunk } : m)
    )
  }

  if (provider?.isConfigured()) {
    await streamWithProvider(provider, model, historyMsgs, systemPrompt, onChunk, signal, thinkingDepth)
  } else {
    const fallback = new BedrockProvider(aws)
    await streamWithProvider(fallback, model, historyMsgs, systemPrompt, onChunk, signal)
  }

  // Finalize
  setMessages((prev) => {
    const final = prev.find((m) => m.id === placeholderId)
    if (final) {
      ChatHistory.addMessage(convId, { role: 'assistant', content: final.content, model, searchSources })
      Usage.track(model, providerType, text, final.content, 'chat').catch(() => {})
    }
    return prev.map((m) => m.id === placeholderId ? { ...m, streaming: false, searchSources } : m)
  })

  // Track usage
  trackUsage('model', model).catch(() => {})
  if (assistantId !== 'ast-default') {
    trackUsage('assistant', assistantId).catch(() => {})
  }
  if (assistantIsBuiltIn === false) {
    AssistantRegistry.incrementUsage(assistantId).catch(() => {})
  }

  // Auto-summarize
  const summaryConfig = getSummaryConfig()
  const updatedConv = await ChatHistory.get(convId)
  if (updatedConv && shouldSummarize(updatedConv.messages.length, summaryConfig)) {
    const existingSummary = await loadLatestSummary(convId)
    if (!existingSummary || updatedConv.messages.length - existingSummary.messageCount >= 10) {
      const summaryPrompt = buildSummaryPrompt(
        updatedConv.messages.slice(-30).map((m) => ({ role: m.role, content: m.content }))
      )
      saveSummaryEntry({
        convId,
        summary: summaryPrompt,
        messageCount: updatedConv.messages.length,
        createdAt: Date.now(),
      }).catch(() => {})
    }
  }
}

export function useChatStreaming() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const stop = useCallback((setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>) => {
    abortRef.current?.abort()
    setIsLoading(false)
    setMessages((prev) => prev.map((m) => m.streaming ? { ...m, streaming: false } : m))
  }, [])

  return {
    isLoading, setIsLoading,
    isSearching, setIsSearching,
    abortRef,
    stop,
  }
}
