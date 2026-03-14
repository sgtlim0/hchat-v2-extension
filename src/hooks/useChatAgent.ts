import { useState } from 'react'
import { getGlobalLocale } from '../i18n'
import { runAgent, type AgentStep } from '../lib/agent'
import { BUILTIN_TOOLS } from '../lib/agentTools'
import { PluginRegistry } from '../lib/pluginRegistry'
import { ChatHistory, type ChatMessage } from '../lib/chatHistory'
import { Usage } from '../lib/usage'
import { trackUsage } from '../lib/userPreferences'
import { AssistantRegistry } from '../lib/assistantBuilder'
import type { Message, ProviderType } from '../lib/providers/types'
import type { AwsCredentials } from './useConfig'

export function formatAgentContent(steps: AgentStep[]): string {
  const isEn = getGlobalLocale() === 'en'
  return steps.map((s) => {
    if (s.type === 'tool_call') return `🔧 ${s.toolName}: ${s.content}`
    if (s.type === 'tool_result') return `📋 ${isEn ? 'Result' : '결과'}: ${s.content.slice(0, 200)}${s.content.length > 200 ? '...' : ''}`
    if (s.type === 'thinking') return s.content ? `💭 ${s.content}` : `💭 ${isEn ? 'Thinking...' : '사고 중...'}`
    return s.content
  }).join('\n\n')
}

export interface ExecuteAgentParams {
  aws: AwsCredentials
  model: string
  providerType: ProviderType
  text: string
  convId: string
  historyMsgs: Message[]
  placeholderId: string
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  signal: AbortSignal
  assistantId: string
  assistantSystemPrompt?: string
  assistantTools?: string[]
  assistantIsBuiltIn?: boolean
}

export async function executeAgentMode(params: ExecuteAgentParams): Promise<void> {
  const {
    aws, model, providerType, text, convId,
    historyMsgs, placeholderId, setMessages, signal,
    assistantId, assistantSystemPrompt, assistantTools, assistantIsBuiltIn,
  } = params

  const agentSteps: AgentStep[] = []
  const customTools = await PluginRegistry.toAgentTools()

  const agentBuiltinTools = (assistantTools && assistantTools.length > 0)
    ? BUILTIN_TOOLS.filter((tool) => assistantTools.includes(tool.name))
    : BUILTIN_TOOLS

  const { finalText, steps } = await runAgent({
    aws,
    model,
    userMessage: text,
    tools: agentBuiltinTools,
    customTools,
    history: historyMsgs.slice(0, -1),
    systemPrompt: assistantSystemPrompt,
    maxSteps: 10,
    signal,
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

  // Side effects (outside state updater)
  ChatHistory.addMessage(convId, {
    role: 'assistant',
    content: finalText,
    model,
    agentSteps: steps,
  })
  Usage.track(model, providerType, text, finalText, 'agent').catch(() => {})

  // Pure state update
  setMessages((prev) => prev.map((m) => m.id === placeholderId
    ? { ...m, content: finalText, streaming: false, agentSteps: steps }
    : m))
  trackUsage('model', model).catch(() => {})
  if (assistantId !== 'ast-default') {
    trackUsage('assistant', assistantId).catch(() => {})
  }
  if (assistantIsBuiltIn === false) {
    AssistantRegistry.incrementUsage(assistantId).catch(() => {})
  }
}

export function useChatAgent() {
  const [agentMode, setAgentMode] = useState(false)
  return { agentMode, setAgentMode }
}
