import { useState, useCallback, useRef, useEffect } from 'react'
import { getGlobalLocale } from '../i18n'
import type { AIProvider, Message, ProviderType, ThinkingDepth } from '../lib/providers/types'
import { BedrockProvider } from '../lib/providers/bedrock-provider'
import { streamWithRetry } from '../lib/providers/stream-retry'
import { createAllProviders, getProviderForModel, getModelDef } from '../lib/providers/provider-factory'
import { routeModel } from '../lib/providers/model-router'
import { ChatHistory, type ChatMessage, type Conversation } from '../lib/chatHistory'
import { needsWebSearch, extractSearchQuery } from '../lib/searchIntent'
import { webSearch, buildSearchContext } from '../lib/webSearch'
import { runAgent, type AgentStep } from '../lib/agent'
import { BUILTIN_TOOLS } from '../lib/agentTools'
import { PluginRegistry } from '../lib/pluginRegistry'
import { Personas } from '../lib/personas'
import { AssistantRegistry } from '../lib/assistantBuilder'
import { Usage } from '../lib/usage'
import { MessageQueue } from '../lib/messageQueue'
import type { Config } from './useConfig'
import { detectPII, getGuardrailConfig, type PIIDetection } from '../lib/guardrail'
import { ChatTemplateStore, replaceVariables } from '../lib/chatTemplates'
import { trackUsage } from '../lib/userPreferences'
import { shouldSummarize, buildSummaryPrompt, saveSummaryEntry, loadLatestSummary, buildSystemPromptInjection, getDefaultConfig as getSummaryConfig } from '../lib/conversationSummarizer'

function formatAgentContent(steps: AgentStep[]): string {
  const isEn = getGlobalLocale() === 'en'
  return steps.map((s) => {
    if (s.type === 'tool_call') return `🔧 ${s.toolName}: ${s.content}`
    if (s.type === 'tool_result') return `📋 ${isEn ? 'Result' : '결과'}: ${s.content.slice(0, 200)}${s.content.length > 200 ? '...' : ''}`
    if (s.type === 'thinking') return s.content ? `💭 ${s.content}` : `💭 ${isEn ? 'Thinking...' : '사고 중...'}`
    return s.content
  }).join('\n\n')
}

async function streamWithProvider(
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

function resolveProviderType(modelId: string, providers: AIProvider[]): ProviderType {
  const def = getModelDef(modelId, providers)
  return def?.provider ?? 'bedrock'
}

export function useChat(config: Config) {
  const [conv, setConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [agentMode, setAgentMode] = useState(false)
  const [error, setError] = useState('')
  const [currentModel, setCurrentModel] = useState(config.defaultModel)
  const [personaId, setPersonaId] = useState('default')
  const [assistantId, setAssistantId] = useState('ast-default')
  const [piiDetections, setPiiDetections] = useState<PIIDetection[]>([])
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const startNew = useCallback(async (model?: string) => {
    const m = model ?? currentModel
    const c = await ChatHistory.create(m)
    setConv(c)
    setMessages([])
    setError('')
    return c
  }, [currentModel])

  const loadConv = useCallback(async (id: string) => {
    const c = await ChatHistory.get(id)
    if (!c) return
    setConv(c)
    setMessages(c.messages)
    setCurrentModel(c.model)
  }, [])

  const sendMessage = useCallback(async (
    text: string,
    opts?: { imageBase64?: string; systemPrompt?: string; forcedModel?: string; thinkingDepth?: ThinkingDepth }
  ) => {
    if (!text.trim() || isLoading) return

    const guardrailConfig = await getGuardrailConfig()
    if (guardrailConfig.enabled) {
      const detections = detectPII(text, guardrailConfig)
      if (detections.length > 0) {
        setPiiDetections(detections)
        setPendingMessage(text)
        return
      }
    }

    setError('')
    setIsLoading(true)

    let activeConv = conv
    if (!activeConv) {
      activeConv = await startNew(opts?.forcedModel ?? currentModel)
    }

    // Offline: queue message and show placeholder
    if (!navigator.onLine) {
      const userMsg = await ChatHistory.addMessage(activeConv.id, {
        role: 'user',
        content: text,
        imageUrl: opts?.imageBase64?.startsWith('data:') ? opts.imageBase64 : undefined,
      })
      setMessages((prev) => [...prev, userMsg])

      await MessageQueue.enqueue({
        convId: activeConv.id,
        text,
        model: opts?.forcedModel ?? currentModel,
        opts: opts as Record<string, unknown> | undefined,
      })

      const offlinePlaceholder: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '(오프라인 — 연결 후 전송됩니다)',
        ts: Date.now(),
        streaming: false,
        model: opts?.forcedModel ?? currentModel,
      }
      setMessages((prev) => [...prev, offlinePlaceholder])
      setIsLoading(false)
      return
    }

    // Build providers from current config
    const providers = createAllProviders({
      bedrock: config.aws,
      openai: config.openai,
      gemini: config.gemini,
    })

    // Determine model: forced > autoRouting > currentModel
    let model = opts?.forcedModel ?? currentModel
    const hasImage = !!opts?.imageBase64

    if (!opts?.forcedModel && config.autoRouting) {
      const routed = routeModel(text, providers, hasImage)
      if (routed) model = routed
    }

    const providerType = resolveProviderType(model, providers)
    const provider = getProviderForModel(model, providers)

    if (!provider?.isConfigured()) {
      // Fallback to legacy Bedrock check
      if (!config.aws.accessKeyId || !config.aws.secretAccessKey) {
        setError('선택한 모델의 API 키를 설정해주세요')
        setIsLoading(false)
        return
      }
    }

    // Build user message
    const userContent = opts?.imageBase64
      ? [{ type: 'image_url' as const, image_url: { url: opts.imageBase64 } }, { type: 'text' as const, text }]
      : text

    const userMsg = await ChatHistory.addMessage(activeConv.id, {
      role: 'user',
      content: text,
      imageUrl: opts?.imageBase64?.startsWith('data:') ? opts.imageBase64 : undefined,
    })
    setMessages((prev) => [...prev, userMsg])

    // Placeholder
    const placeholderId = crypto.randomUUID()
    const placeholder: ChatMessage = { id: placeholderId, role: 'assistant', content: '', ts: Date.now(), streaming: true, model }
    setMessages((prev) => [...prev, placeholder])

    try {
      const historyMsgs: Message[] = (await ChatHistory.get(activeConv.id))!.messages
        .filter((m) => !m.streaming)
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.imageUrl ? [{ type: 'image_url' as const, image_url: { url: m.imageUrl } }, { type: 'text' as const, text: m.content }] : m.content }))

      // Replace last message with actual content
      if (typeof userContent !== 'string') {
        historyMsgs[historyMsgs.length - 1].content = userContent
      }

      abortRef.current = new AbortController()

      // Load active assistant for model/prompt/tool overrides
      const assistant = await AssistantRegistry.getById(assistantId)

      if (agentMode) {
        // ── Agent mode: multi-turn tool calling loop ──
        const agentSteps: AgentStep[] = []
        const customTools = await PluginRegistry.toAgentTools()

        // Filter built-in tools if assistant has tool bindings
        const agentBuiltinTools = (assistant && assistant.tools.length > 0)
          ? BUILTIN_TOOLS.filter((tool) => assistant.tools.includes(tool.name))
          : BUILTIN_TOOLS

        // Use assistant system prompt if no explicit systemPrompt
        const agentSystemPrompt = opts?.systemPrompt ?? assistant?.systemPrompt ?? undefined

        const { finalText, steps } = await runAgent({
          aws: config.aws,
          model,
          userMessage: text,
          tools: agentBuiltinTools,
          customTools,
          history: historyMsgs.slice(0, -1),
          systemPrompt: agentSystemPrompt,
          maxSteps: 10,
          signal: abortRef.current.signal,
          onStep: (step) => {
            agentSteps.push(step)
            setMessages((prev) =>
              prev.map((m) => m.id === placeholderId
                ? { ...m, content: formatAgentContent(agentSteps), agentSteps: [...agentSteps] }
                : m)
            )
          },
          onChunk: (chunk) => {
            setMessages((prev) =>
              prev.map((m) => m.id === placeholderId
                ? { ...m, content: m.content + chunk }
                : m)
            )
          },
        })

        // Finalize agent message
        setMessages((prev) => {
          const final = prev.find((m) => m.id === placeholderId)
          if (final) {
            ChatHistory.addMessage(activeConv!.id, {
              role: 'assistant',
              content: finalText,
              model,
              agentSteps: steps,
            })
          }
          return prev.map((m) => m.id === placeholderId
            ? { ...m, content: finalText, streaming: false, agentSteps: steps }
            : m)
        })

        Usage.track(model, providerType, text, finalText, 'agent').catch(() => {})
        // Track usage preferences
        trackUsage('model', model).catch(() => {})
        if (assistantId !== 'ast-default') {
          trackUsage('assistant', assistantId).catch(() => {})
        }
        // Increment assistant usage on successful agent response
        if (assistant && !assistant.isBuiltIn) {
          AssistantRegistry.incrementUsage(assistant.id).catch(() => {})
        }
      } else {
        // ── Normal chat mode ──
        const persona = await Personas.getById(personaId)
        // Assistant system prompt takes priority over persona
        let systemPrompt = opts?.systemPrompt ?? assistant?.systemPrompt ?? persona?.systemPrompt ?? '당신은 도움이 되는 AI 어시스턴트입니다. 한국어로 답변해주세요.'
        let searchSources: { title: string; url: string }[] | undefined

        // Inject previous conversation summary if available
        const prevSummary = await loadLatestSummary(activeConv!.id)
        if (prevSummary && prevSummary.summary) {
          systemPrompt = buildSystemPromptInjection(prevSummary.summary) + '\n\n' + systemPrompt
        }

        if (config.enableWebSearch && needsWebSearch(text)) {
          setIsSearching(true)
          try {
            const query = extractSearchQuery(text)
            const results = await webSearch({
              query,
              maxResults: 5,
              googleApiKey: config.googleSearchApiKey || undefined,
              googleEngineId: config.googleSearchEngineId || undefined,
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

        // Use provider system if available, fallback to legacy streamChatLive
        if (provider?.isConfigured()) {
          await streamWithProvider(
            provider,
            model,
            historyMsgs,
            systemPrompt,
            (chunk) => {
              setMessages((prev) =>
                prev.map((m) => m.id === placeholderId ? { ...m, content: m.content + chunk } : m)
              )
            },
            abortRef.current.signal,
            opts?.thinkingDepth,
          )
        } else {
          // Fallback: create BedrockProvider directly from AWS credentials
          const fallback = new BedrockProvider(config.aws)
          await streamWithProvider(
            fallback,
            model,
            historyMsgs,
            systemPrompt,
            (chunk) => {
              setMessages((prev) =>
                prev.map((m) => m.id === placeholderId ? { ...m, content: m.content + chunk } : m)
              )
            },
            abortRef.current.signal,
          )
        }

        // Finalize
        setMessages((prev) => {
          const final = prev.find((m) => m.id === placeholderId)
          if (final) {
            ChatHistory.addMessage(activeConv!.id, { role: 'assistant', content: final.content, model, searchSources })
            Usage.track(model, providerType, text, final.content, 'chat').catch(() => {})
          }
          return prev.map((m) => m.id === placeholderId ? { ...m, streaming: false, searchSources } : m)
        })

        // Track usage preferences
        trackUsage('model', model).catch(() => {})
        if (assistantId !== 'ast-default') {
          trackUsage('assistant', assistantId).catch(() => {})
        }
        // Increment assistant usage on successful chat response
        if (assistant && !assistant.isBuiltIn) {
          AssistantRegistry.incrementUsage(assistant.id).catch(() => {})
        }

        // Auto-summarize when conversation exceeds threshold
        const summaryConfig = getSummaryConfig()
        const updatedConv = await ChatHistory.get(activeConv!.id)
        if (updatedConv && shouldSummarize(updatedConv.messages.length, summaryConfig)) {
          const existingSummary = await loadLatestSummary(activeConv!.id)
          if (!existingSummary || updatedConv.messages.length - existingSummary.messageCount >= 10) {
            const summaryPrompt = buildSummaryPrompt(
              updatedConv.messages.slice(-30).map((m) => ({ role: m.role, content: m.content }))
            )
            saveSummaryEntry({
              convId: activeConv!.id,
              summary: summaryPrompt,
              messageCount: updatedConv.messages.length,
              createdAt: Date.now(),
            }).catch(() => {})
          }
        }
      }
    } catch (err) {
      const msg = String(err)
      setMessages((prev) => prev.map((m) => m.id === placeholderId ? { ...m, content: msg, streaming: false, error: true } : m))
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [conv, isLoading, agentMode, currentModel, personaId, assistantId, config, startNew])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setIsLoading(false)
    setMessages((prev) => prev.map((m) => m.streaming ? { ...m, streaming: false } : m))
  }, [])

  /** Edit a user message and resend from that point */
  const editAndResend = useCallback(async (msgId: string, newContent: string) => {
    if (!conv || isLoading) return
    const msgIdx = messages.findIndex((m) => m.id === msgId)
    if (msgIdx === -1 || messages[msgIdx].role !== 'user') return

    await ChatHistory.updateMessage(conv.id, msgId, newContent)

    const nextAssistantIdx = msgIdx + 1
    if (nextAssistantIdx < messages.length) {
      const nextMsg = messages[nextAssistantIdx]
      await ChatHistory.truncateAfter(conv.id, nextMsg.id)
    }

    const kept = messages.slice(0, msgIdx).concat([{ ...messages[msgIdx], content: newContent }])
    setMessages(kept)

    await sendMessage(newContent)
  }, [conv, isLoading, messages, sendMessage])

  /** Regenerate the last assistant response */
  const regenerate = useCallback(async () => {
    if (!conv || isLoading || messages.length < 2) return

    let lastUserIdx = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { lastUserIdx = i; break }
    }
    if (lastUserIdx === -1) return

    const userText = messages[lastUserIdx].content

    const nextIdx = lastUserIdx + 1
    if (nextIdx < messages.length) {
      await ChatHistory.truncateAfter(conv.id, messages[nextIdx].id)
    }

    setMessages(messages.slice(0, lastUserIdx + 1))

    await sendMessage(userText)
  }, [conv, isLoading, messages, sendMessage])

  const confirmSendWithPII = useCallback(async (action: 'send' | 'mask' | 'cancel') => {
    if (!pendingMessage) return

    if (action === 'cancel') {
      setPendingMessage(null)
      setPiiDetections([])
      return
    }

    const finalText = action === 'mask'
      ? piiDetections.reduce((text, detection) => {
          return text.slice(0, detection.start) + detection.masked + text.slice(detection.end)
        }, pendingMessage)
      : pendingMessage

    setPendingMessage(null)
    setPiiDetections([])

    await sendMessage(finalText)
  }, [pendingMessage, piiDetections, sendMessage])

  // Process queued messages when back online
  useEffect(() => {
    const handleOnline = () => {
      MessageQueue.processQueue(async (msg) => {
        await sendMessage(msg.text, msg.opts as { imageBase64?: string; systemPrompt?: string; forcedModel?: string; thinkingDepth?: ThinkingDepth } | undefined)
      }).catch(() => {})
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [sendMessage])

  const runTemplate = useCallback(async (templateId: string, variables: Record<string, string>) => {
    const template = await ChatTemplateStore.get(templateId)
    if (!template) return

    const steps = replaceVariables(template.steps, variables)
    await ChatTemplateStore.incrementUsage(templateId)

    for (const step of steps) {
      if (step.role === 'user') {
        await sendMessage(step.content)
        if (step.waitForResponse) {
          while (isLoading) {
            await new Promise((resolve) => setTimeout(resolve, 100))
          }
        }
      }
    }
  }, [sendMessage, isLoading])

  return { conv, messages, isLoading, isSearching, agentMode, setAgentMode, personaId, setPersonaId, assistantId, setAssistantId, error, currentModel, setCurrentModel, sendMessage, startNew, loadConv, stop, editAndResend, regenerate, piiDetections, pendingMessage, confirmSendWithPII, runTemplate }
}
