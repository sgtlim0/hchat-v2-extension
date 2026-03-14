import { useState, useCallback, useEffect, useRef } from 'react'
import type { AIProvider, Message, ProviderType, ThinkingDepth } from '../lib/providers/types'
import { getProviderForModel, getModelDef } from '../lib/providers/provider-factory'
import { routeModel } from '../lib/providers/model-router'
import { ChatHistory } from '../lib/chatHistory'
import { AssistantRegistry } from '../lib/assistantBuilder'
import { MessageQueue } from '../lib/messageQueue'
import type { Config } from './useConfig'
import { useChatConversation } from './useChatConversation'
import { useChatStreaming, executeChatMode } from './useChatStreaming'
import { useChatAgent, executeAgentMode } from './useChatAgent'
import { usePIIGuardrail } from './usePIIGuardrail'
import { useChatActions } from './useChatActions'
import { useProvider } from './useProvider'

function resolveProviderType(modelId: string, providers: AIProvider[]): ProviderType {
  const def = getModelDef(modelId, providers)
  return def?.provider ?? 'bedrock'
}

export function useChat(config: Config) {
  const { conv, messages, setMessages, currentModel, setCurrentModel, error, setError, startNew, loadConv } = useChatConversation(config.defaultModel)
  const { isLoading, setIsLoading, isSearching, setIsSearching, abortRef, stop: streamStop } = useChatStreaming()
  const { agentMode, setAgentMode } = useChatAgent()
  const { providers } = useProvider(config)
  const [personaId, setPersonaId] = useState('default')
  const [assistantId, setAssistantId] = useState('ast-default')

  // Refs for frequently-changing values to stabilize sendMessage
  const convRef = useRef(conv)
  const currentModelRef = useRef(currentModel)
  const configRef = useRef(config)
  const providersRef = useRef(providers)
  const isLoadingRef = useRef(isLoading)
  const agentModeRef = useRef(agentMode)
  const personaIdRef = useRef(personaId)
  const assistantIdRef = useRef(assistantId)

  useEffect(() => { convRef.current = conv }, [conv])
  useEffect(() => { currentModelRef.current = currentModel }, [currentModel])
  useEffect(() => { configRef.current = config }, [config])
  useEffect(() => { providersRef.current = providers }, [providers])
  useEffect(() => { isLoadingRef.current = isLoading }, [isLoading])
  useEffect(() => { agentModeRef.current = agentMode }, [agentMode])
  useEffect(() => { personaIdRef.current = personaId }, [personaId])
  useEffect(() => { assistantIdRef.current = assistantId }, [assistantId])

  const sendMessage = useCallback(async (
    text: string,
    opts?: { imageBase64?: string; systemPrompt?: string; forcedModel?: string; thinkingDepth?: ThinkingDepth }
  ) => {
    if (!text.trim() || isLoadingRef.current) return

    const cfg = configRef.current
    const curModel = currentModelRef.current
    const curProviders = providersRef.current

    setError('')
    setIsLoading(true)

    let activeConv = convRef.current
    if (!activeConv) {
      activeConv = await startNew(opts?.forcedModel ?? curModel)
    }

    if (!navigator.onLine) {
      const userMsg = await ChatHistory.addMessage(activeConv.id, {
        role: 'user', content: text,
        imageUrl: opts?.imageBase64?.startsWith('data:') ? opts.imageBase64 : undefined,
      })
      setMessages((prev) => [...prev, userMsg])
      await MessageQueue.enqueue({ convId: activeConv.id, text, model: opts?.forcedModel ?? curModel, opts: opts as Record<string, unknown> | undefined })
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: '(오프라인 — 연결 후 전송됩니다)', ts: Date.now(), streaming: false, model: opts?.forcedModel ?? curModel }])
      setIsLoading(false)
      return
    }

    let model = opts?.forcedModel ?? curModel
    if (!opts?.forcedModel && cfg.autoRouting) {
      const routed = routeModel(text, curProviders, !!opts?.imageBase64)
      if (routed) model = routed
    }

    const providerType = resolveProviderType(model, curProviders)
    const provider = getProviderForModel(model, curProviders)

    if (!provider?.isConfigured() && (!cfg.aws.accessKeyId || !cfg.aws.secretAccessKey)) {
      setError('선택한 모델의 API 키를 설정해주세요')
      setIsLoading(false)
      return
    }

    const userContent = opts?.imageBase64
      ? [{ type: 'image_url' as const, image_url: { url: opts.imageBase64 } }, { type: 'text' as const, text }]
      : text

    const userMsg = await ChatHistory.addMessage(activeConv.id, {
      role: 'user', content: text,
      imageUrl: opts?.imageBase64?.startsWith('data:') ? opts.imageBase64 : undefined,
    })
    setMessages((prev) => [...prev, userMsg])

    const placeholderId = crypto.randomUUID()
    setMessages((prev) => [...prev, { id: placeholderId, role: 'assistant' as const, content: '', ts: Date.now(), streaming: true, model }])

    try {
      const historyMsgs: Message[] = (await ChatHistory.get(activeConv.id))!.messages
        .filter((m) => !m.streaming).slice(-20)
        .map((m) => ({ role: m.role, content: m.imageUrl ? [{ type: 'image_url' as const, image_url: { url: m.imageUrl } }, { type: 'text' as const, text: m.content }] : m.content }))
      if (typeof userContent !== 'string') {
        historyMsgs[historyMsgs.length - 1].content = userContent
      }

      abortRef.current = new AbortController()
      const curAssistantId = assistantIdRef.current
      const assistant = await AssistantRegistry.getById(curAssistantId)

      if (agentModeRef.current) {
        await executeAgentMode({
          aws: cfg.aws, model, providerType, text, convId: activeConv.id,
          historyMsgs, placeholderId, setMessages, signal: abortRef.current.signal,
          assistantId: curAssistantId,
          assistantSystemPrompt: opts?.systemPrompt ?? assistant?.systemPrompt ?? undefined,
          assistantTools: assistant?.tools,
          assistantIsBuiltIn: assistant?.isBuiltIn,
        })
      } else {
        await executeChatMode({
          convId: activeConv.id, model, providerType, text, historyMsgs, placeholderId,
          setMessages, setIsSearching, signal: abortRef.current.signal,
          provider, aws: cfg.aws, personaId: personaIdRef.current, assistantId: curAssistantId,
          assistantSystemPrompt: assistant?.systemPrompt,
          assistantIsBuiltIn: assistant?.isBuiltIn,
          enableWebSearch: cfg.enableWebSearch,
          googleSearchApiKey: cfg.googleSearchApiKey,
          googleSearchEngineId: cfg.googleSearchEngineId,
          thinkingDepth: opts?.thinkingDepth,
          explicitSystemPrompt: opts?.systemPrompt,
        })
      }
    } catch (err) {
      const msg = String(err)
      setMessages((prev) => prev.map((m) => m.id === placeholderId ? { ...m, content: msg, streaming: false, error: true } : m))
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [startNew, abortRef, setMessages, setError, setIsLoading, setIsSearching])

  const stop = useCallback(() => {
    streamStop(setMessages)
  }, [streamStop, setMessages])

  const { piiDetections, pendingMessage, checkPII, confirmSendWithPII } = usePIIGuardrail(sendMessage)

  const sendMessageWithPII = useCallback(async (
    text: string,
    opts?: { imageBase64?: string; systemPrompt?: string; forcedModel?: string; thinkingDepth?: ThinkingDepth }
  ) => {
    const blocked = await checkPII(text)
    if (blocked) return
    await sendMessage(text, opts)
  }, [checkPII, sendMessage])

  const { editAndResend, regenerate, runTemplate } = useChatActions({
    conv, isLoading, messages, setMessages, sendMessage: sendMessageWithPII,
  })

  useEffect(() => {
    const handleOnline = () => {
      MessageQueue.processQueue(async (msg) => {
        await sendMessageWithPII(msg.text, msg.opts as { imageBase64?: string; systemPrompt?: string; forcedModel?: string; thinkingDepth?: ThinkingDepth } | undefined)
      }).catch(() => {})
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [sendMessageWithPII])

  return {
    conv, messages, isLoading, isSearching,
    agentMode, setAgentMode, personaId, setPersonaId, assistantId, setAssistantId,
    error, currentModel, setCurrentModel,
    sendMessage: sendMessageWithPII, startNew, loadConv, stop,
    editAndResend, regenerate, piiDetections, pendingMessage, confirmSendWithPII, runTemplate,
  }
}
