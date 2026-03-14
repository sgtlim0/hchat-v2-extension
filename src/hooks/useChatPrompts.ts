import { useState, useEffect } from 'react'
import { PromptLibrary, type Prompt } from '../lib/promptLibrary'

export function useChatPrompts(
  setInput: React.Dispatch<React.SetStateAction<string>>,
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
) {
  const [showPrompts, setShowPrompts] = useState(false)
  const [promptSearch, setPromptSearch] = useState('')
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [promptIdx, setPromptIdx] = useState(0)

  useEffect(() => {
    if (!showPrompts) return
    PromptLibrary.searchByShortcut(promptSearch).then(setPrompts)
  }, [showPrompts, promptSearch])

  const applyPrompt = (p: Prompt) => {
    setInput(p.content.replace('{{content}}', ''))
    setShowPrompts(false)
    PromptLibrary.incrementUsage(p.id)
    textareaRef.current?.focus()
  }

  const handlePromptInput = (value: string) => {
    if (value.startsWith('/')) {
      setShowPrompts(true)
      setPromptSearch(value.slice(1))
      setPromptIdx(0)
    } else {
      setShowPrompts(false)
    }
  }

  const handlePromptKeyDown = (e: React.KeyboardEvent): boolean => {
    if (!showPrompts) return false
    if (e.key === 'ArrowDown') { e.preventDefault(); setPromptIdx((i) => Math.min(i + 1, prompts.length - 1)); return true }
    if (e.key === 'ArrowUp') { e.preventDefault(); setPromptIdx((i) => Math.max(i - 1, 0)); return true }
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (prompts[promptIdx]) applyPrompt(prompts[promptIdx]); return true }
    if (e.key === 'Escape') { setShowPrompts(false); return true }
    return false
  }

  return {
    showPrompts, setShowPrompts,
    prompts, promptIdx,
    applyPrompt, handlePromptInput, handlePromptKeyDown,
  }
}
