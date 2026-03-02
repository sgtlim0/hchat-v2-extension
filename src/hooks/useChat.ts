import { useState, useCallback, useRef } from 'react'
import { getGlobalLocale } from '../i18n'
import { streamChatLive, type Message } from '../lib/models'
import type { AIProvider, ProviderType, ThinkingDepth } from '../lib/providers/types'
import { createAllProviders, getProviderForModel, getModelDef } from '../lib/providers/provider-factory'
import { routeModel } from '../lib/providers/model-router'
import { ChatHistory, type ChatMessage, type Conversation } from '../lib/chatHistory'
import { needsWebSearch, extractSearchQuery } from '../lib/searchIntent'
import { webSearch, buildSearchContext } from '../lib/webSearch'
import { runAgent, type AgentStep } from '../lib/agent'
import { BUILTIN_TOOLS } from '../lib/agentTools'
import { Personas } from '../lib/personas'
import { Usage } from '../lib/usage'
import type { Config } from './useConfig'

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
  const gen = provider.stream({ model, messages, systemPrompt, signal, thinkingDepth })
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
    setError('')
    setIsLoading(true)

    let activeConv = conv
    if (!activeConv) {
      activeConv = await startNew(opts?.forcedModel ?? currentModel)
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

      if (agentMode) {
        // ── Agent mode: multi-turn tool calling loop ──
        const agentSteps: AgentStep[] = []

        const { finalText, steps } = await runAgent({
          aws: config.aws,
          model,
          userMessage: text,
          tools: BUILTIN_TOOLS,
          history: historyMsgs.slice(0, -1),
          systemPrompt: opts?.systemPrompt,
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
      } else {
        // ── Normal chat mode ──
        const persona = await Personas.getById(personaId)
        let systemPrompt = opts?.systemPrompt ?? persona?.systemPrompt ?? '당신은 도움이 되는 AI 어시스턴트입니다. 한국어로 답변해주세요.'
        let searchSources: { title: string; url: string }[] | undefined

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
          await streamChatLive({
            aws: config.aws,
            model,
            messages: historyMsgs,
            systemPrompt,
            onChunk: (chunk) => {
              setMessages((prev) =>
                prev.map((m) => m.id === placeholderId ? { ...m, content: m.content + chunk } : m)
              )
            },
            signal: abortRef.current.signal,
          })
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
      }
    } catch (err) {
      const msg = String(err)
      setMessages((prev) => prev.map((m) => m.id === placeholderId ? { ...m, content: msg, streaming: false, error: true } : m))
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [conv, isLoading, agentMode, currentModel, personaId, config, startNew])

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

  return { conv, messages, isLoading, isSearching, agentMode, setAgentMode, personaId, setPersonaId, error, currentModel, setCurrentModel, sendMessage, startNew, loadConv, stop, editAndResend, regenerate }
}
