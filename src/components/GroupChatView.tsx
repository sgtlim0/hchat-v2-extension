import { useState, useRef } from 'react'
import { MODELS, streamChatLive, type Message } from '../lib/models'
import type { Config } from '../hooks/useConfig'

interface ModelResponse {
  modelId: string
  text: string
  loading: boolean
  error?: string
  ms?: number
}

interface Props { config: Config }

export function GroupChatView({ config }: Props) {
  const [selectedModels, setSelectedModels] = useState<string[]>([MODELS[0].id])
  const [input, setInput] = useState('')
  const [responses, setResponses] = useState<ModelResponse[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const hasCredentials = !!config.aws.accessKeyId && !!config.aws.secretAccessKey

  const toggleModel = (id: string) => {
    setSelectedModels((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    )
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isRunning || selectedModels.length === 0 || !hasCredentials) return
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
        try {
          await streamChatLive({
            aws: config.aws,
            model: modelId,
            messages: msgs,
            systemPrompt: '당신은 도움이 되는 AI 어시스턴트입니다. 한국어로 답변해주세요.',
            onChunk: (chunk) => {
              setResponses((prev) =>
                prev.map((r) =>
                  r.modelId === modelId ? { ...r, text: r.text + chunk } : r
                )
              )
            },
          })
          setResponses((prev) =>
            prev.map((r) =>
              r.modelId === modelId ? { ...r, loading: false, ms: Date.now() - start } : r
            )
          )
        } catch (err) {
          setResponses((prev) =>
            prev.map((r) =>
              r.modelId === modelId ? { ...r, loading: false, error: String(err) } : r
            )
          )
        }
      })
    )

    setIsRunning(false)
  }

  return (
    <div className="group-chat">
      {/* Model toggles */}
      <div className="group-models">
        <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', flexShrink: 0 }}>모델 선택:</span>
        {MODELS.map((m) => (
          <button
            key={m.id}
            className={`model-toggle ${selectedModels.includes(m.id) ? 'on' : ''}`}
            onClick={() => hasCredentials && toggleModel(m.id)}
            disabled={!hasCredentials}
            style={{ opacity: hasCredentials ? 1 : 0.35 }}
            title={!hasCredentials ? 'AWS 자격증명 필요' : ''}
          >
            <span>{m.emoji}</span>
            <span>{m.shortLabel}</span>
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="group-results" style={{ flex: 1, minHeight: 0 }}>
        {responses.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 12 }}>
            여러 Claude 모델에게 같은 질문을 동시에 던져 비교하세요
          </div>
        ) : (
          responses.map((r) => {
            const model = MODELS.find((m) => m.id === r.modelId)
            return (
              <div key={r.modelId} className="group-col">
                <div className="group-col-header">
                  <span>{model?.emoji}</span>
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
            placeholder={`선택된 ${selectedModels.length}개 모델에게 동시에 질문...`}
            rows={1}
          />
          <div className="input-actions">
            <button className="send-btn" onClick={handleSend} disabled={!input.trim() || isRunning || selectedModels.length === 0 || !hasCredentials}>
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
