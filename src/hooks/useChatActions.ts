import { useCallback } from 'react'
import { ChatHistory, type ChatMessage, type Conversation } from '../lib/chatHistory'
import { ChatTemplateStore, replaceVariables } from '../lib/chatTemplates'

interface UseChatActionsParams {
  conv: Conversation | null
  isLoading: boolean
  messages: ChatMessage[]
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  sendMessage: (text: string) => Promise<void>
}

export function useChatActions({ conv, isLoading, messages, setMessages, sendMessage }: UseChatActionsParams) {
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
  }, [conv, isLoading, messages, setMessages, sendMessage])

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
  }, [conv, isLoading, messages, setMessages, sendMessage])

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

  return { editAndResend, regenerate, runTemplate }
}
