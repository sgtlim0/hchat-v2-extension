import { useState, useCallback } from 'react'
import { ChatHistory, type ChatMessage, type Conversation } from '../lib/chatHistory'

export function useChatConversation(defaultModel: string) {
  const [conv, setConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentModel, setCurrentModel] = useState(defaultModel)
  const [error, setError] = useState('')

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

  return {
    conv, setConv,
    messages, setMessages,
    currentModel, setCurrentModel,
    error, setError,
    startNew, loadConv,
  }
}
