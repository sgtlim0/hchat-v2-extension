import { useState, useCallback, useRef } from 'react'
import { streamDeepResearch, type ResearchProgress, type SourceRef } from '../lib/deepResearch'
import { createAllProviders, getProviderForModel } from '../lib/providers/provider-factory'
import type { Config } from './useConfig'

export function useDeepResearch(
  config: Config,
  currentModel: string,
  sendMessage: (text: string, opts?: { systemPrompt?: string }) => Promise<void>,
  showToast: (msg: string) => void,
  t: (key: string, vars?: Record<string, string>) => string,
  locale: string,
) {
  const [deepResearch, setDeepResearch] = useState(false)
  const [researchProgress, setResearchProgress] = useState<ResearchProgress | null>(null)
  const [researchSources, setResearchSources] = useState<SourceRef[]>([])
  const [researchReport, setResearchReport] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const handleDeepResearch = useCallback(async (question: string) => {
    // Cancel any in-progress research
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    const providers = createAllProviders({
      bedrock: config.aws,
      openai: config.openai,
      gemini: config.gemini,
      ollama: config.ollama.baseUrl ? config.ollama : undefined,
      openrouter: config.openrouter.apiKey ? config.openrouter : undefined,
    })
    const provider = getProviderForModel(currentModel, providers)
    if (!provider) {
      showToast(t('common.apiKeyNotSet'))
      return
    }
    try {
      setResearchProgress({ step: 'generating_queries', detail: '', current: 0, total: 3 })
      setResearchSources([])
      setResearchReport('')

      const gen = streamDeepResearch({
        question,
        provider,
        model: currentModel,
        locale,
        signal: abortRef.current.signal,
        googleApiKey: config.googleSearchApiKey || undefined,
        googleEngineId: config.googleSearchEngineId || undefined,
      })

      let finalReport = ''

      for await (const event of gen) {
        switch (event.type) {
          case 'progress':
            setResearchProgress(event.progress)
            break
          case 'sources_found':
            setResearchSources((prev) => [...prev, ...event.sources])
            break
          case 'report_chunk':
            finalReport += event.chunk
            setResearchReport(finalReport)
            break
          case 'done':
            setResearchProgress(null)
            setResearchSources([])
            setResearchReport('')
            await sendMessage(question, { systemPrompt: t('aiPrompts.deepResearchSystem', { question, report: event.result.report }) })
            break
        }
      }
    } catch (err) {
      setResearchProgress(null)
      setResearchSources([])
      setResearchReport('')
      const errMsg = String(err)
      if (!errMsg.includes(t('deepResearch.cancelled'))) showToast(t('deepResearch.failed', { error: errMsg }))
    }
  }, [config, currentModel, sendMessage, t, locale, showToast])

  return {
    deepResearch, setDeepResearch,
    researchProgress, researchSources, researchReport,
    handleDeepResearch,
  }
}
