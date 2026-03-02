import { useState, useRef } from 'react'
import { useProvider } from '../hooks/useProvider'
import { useLocale } from '../i18n'
import type { Config } from '../hooks/useConfig'
import type { Message, ProviderType } from '../lib/providers/types'
import { Usage } from '../lib/usage'

interface ModelResponse {
  modelId: string
  text: string
  loading: boolean
  error?: string
  ms?: number
}

const PROVIDER_COLORS: Record<ProviderType, string> = {
  bedrock: '#ff9900',
  openai: '#10a37f',
  gemini: '#4285f4',
}

interface Props { config: Config }

export function GroupChatView({ config }: Props) {
  const { t } = useLocale()
  const { configuredModels, getProvider, getModel } = useProvider(config)
  const [selectedModels, setSelectedModels] = useState<string[]>(
    configuredModels.length > 0 ? [configuredModels[0].id] : []
  )
  const [input, setInput] = useState('')
  const [responses, setResponses] = useState<ModelResponse[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const toggleModel = (id: string) => {
    setSelectedModels((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    )
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isRunning || selectedModels.length === 0) return
    setInput('')
    setIsRunning(true)

    const msgs: Message[] = [{ role: 'user', content: text }]
    const init: ModelResponse[] = selectedModels.map((id) => ({
      modelId: id, text: '', loading: true,
    }))
    setResponses(init)

    await Promise.all(
      selectedModels.map(async (modelId) => {
        const start = Date.now()
        const provider = getProvider(modelId)
        if (!provider?.isConfigured()) {
          setResponses((prev) =>
            prev.map((r) => r.modelId === modelId ? { ...r, loading: false, error: t('common.apiKeyNotSet') } : r)
          )
          return
        }

        try {
          const gen = provider.stream({
            model: modelId,
            messages: msgs,
            systemPrompt: t('group.systemPrompt'),
          })

          let fullText = ''
          for await (const chunk of gen) {
            fullText += chunk
            setResponses((prev) =>
              prev.map((r) => r.modelId === modelId ? { ...r, text: r.text + chunk } : r)
            )
          }

          setResponses((prev) =>
            prev.map((r) => r.modelId === modelId ? { ...r, loading: false, ms: Date.now() - start } : r)
          )

          const model = getModel(modelId)
          Usage.track(modelId, model?.provider ?? 'bedrock', text, fullText, 'group').catch(() => {})
        } catch (err) {
          setResponses((prev) =>
            prev.map((r) => r.modelId === modelId ? { ...r, loading: false, error: String(err) } : r)
          )
        }
      })
    )

    setIsRunning(false)
  }

  // Group models by provider
  const providerGroups = (['bedrock', 'openai', 'gemini'] as ProviderType[])
    .map((type) => ({
      type,
      models: configuredModels.filter((m) => m.provider === type),
    }))
    .filter((g) => g.models.length > 0)

  return (
    <div className="group-chat">
      {/* Model toggles */}
      <div className="group-models">
        <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', flexShrink: 0 }}>{t('group.modelSelect')}</span>
        {providerGroups.map((g) => (
          g.models.map((m) => (
            <button
              key={m.id}
              className={`model-toggle ${selectedModels.includes(m.id) ? 'on' : ''}`}
              onClick={() => toggleModel(m.id)}
              style={{
                borderColor: selectedModels.includes(m.id) ? PROVIDER_COLORS[g.type] : undefined,
              }}
            >
              <span>{m.emoji}</span>
              <span>{m.shortLabel}</span>
            </button>
          ))
        ))}
        {configuredModels.length === 0 && (
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{t('group.setApiKey')}</span>
        )}
      </div>

      {/* Results */}
      <div className="group-results" style={{ flex: 1, minHeight: 0 }}>
        {responses.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 12 }}>
            {t('group.emptyMessage')}
          </div>
        ) : (
          responses.map((r) => {
            const model = getModel(r.modelId)
            const providerColor = model ? PROVIDER_COLORS[model.provider] : 'var(--text3)'
            return (
              <div key={r.modelId} className="group-col">
                <div className="group-col-header">
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: providerColor, display: 'inline-block' }} />
                  <span>{model?.shortLabel ?? r.modelId}</span>
                  {r.ms && <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text3)' }}>{r.ms}ms</span>}
                  {r.loading && <span className="spinner-sm" style={{ marginLeft: 'auto' }} />}
                </div>
                <div className="group-col-body">
                  {r.error ? (
                    <span style={{ color: 'var(--red)', fontSize: 11 }}>⚠ {r.error}</span>
                  ) : (
                    <>
                      {r.text}
                      {r.loading && <span className="cursor">▌</span>}
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Input */}
      <div className="input-area">
        <div className="input-row">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
            }}
            placeholder={t('group.placeholder', { n: selectedModels.length })}
            rows={1}
          />
          <div className="input-actions">
            <button className="send-btn" onClick={handleSend} disabled={!input.trim() || isRunning || selectedModels.length === 0}>
              {isRunning ? <span className="spinner" /> : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
